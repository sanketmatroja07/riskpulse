import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import get_db, User, Organization, ApiKey, _uid, _generate_api_key
from models.schemas import (
    LoginRequest, LoginResponse, UserResponse, OrganizationResponse,
    SignupRequest, ApiKeyCreateRequest, ApiKeyResponse, ApiKeyCreatedResponse
)
from services.auth_service import (
    verify_password, hash_password, create_token, hash_api_key,
    get_current_user, require_role, log_audit
)

router = APIRouter()


def _slugify(name: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return slug[:80]


# ─── Signup ───────────────────────────────────────────────────

@router.post("/signup", response_model=LoginResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Validate
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Create organization
    base_slug = _slugify(req.company_name)
    slug = base_slug
    counter = 1
    while True:
        dup = await db.execute(select(Organization).where(Organization.slug == slug))
        if not dup.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(
        name=req.company_name,
        slug=slug,
        plan="starter",
        event_quota=10000,
        max_members=3,
    )
    db.add(org)
    await db.flush()

    # Create admin user
    user = User(
        org_id=org.id,
        email=req.email,
        name=req.name,
        password_hash=hash_password(req.password),
        role="admin",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await db.refresh(org)

    token = create_token(str(user.id), user.email, user.role, str(org.id))

    return LoginResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
        org=OrganizationResponse.model_validate(org),
    )


# ─── Login ────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_token(str(user.id), user.email, user.role, str(user.org_id) if user.org_id else None)
    user.last_login_at = datetime.utcnow()
    await db.commit()

    # Fetch org
    org = None
    if user.org_id:
        org_result = await db.execute(select(Organization).where(Organization.id == user.org_id))
        org_row = org_result.scalar_one_or_none()
        if org_row:
            org = OrganizationResponse.model_validate(org_row)

    return LoginResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
        org=org,
    )


# ─── Me ───────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.get("/org", response_model=OrganizationResponse)
async def get_my_org(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.org_id:
        raise HTTPException(status_code=404, detail="No organization associated")
    result = await db.execute(select(Organization).where(Organization.id == user.org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationResponse.model_validate(org)


# ─── Users ────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(User).where(User.is_active == True)
    if user.org_id:
        query = query.where(User.org_id == user.org_id)
    result = await db.execute(query.order_by(User.name))
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


# ─── Invite team member ──────────────────────────────────────

@router.post("/invite", response_model=UserResponse)
async def invite_member(
    email: str,
    name: str,
    role: str = "analyst",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin"))
):
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")

    # Check member limit
    org_result = await db.execute(select(Organization).where(Organization.id == user.org_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=400, detail="Organization not found")

    member_count = (await db.execute(
        select(func.count(User.id)).where(User.org_id == user.org_id, User.is_active == True)
    )).scalar() or 0
    if member_count >= org.max_members:
        raise HTTPException(status_code=403, detail=f"Member limit reached ({org.max_members}). Upgrade your plan.")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    import secrets
    temp_password = secrets.token_urlsafe(12)

    new_user = User(
        org_id=user.org_id,
        email=email,
        name=name,
        password_hash=hash_password(temp_password),
        role=role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    await log_audit(db, user, "invite_member", "user", new_user.id, {"email": email, "role": role})

    return UserResponse.model_validate(new_user)


# ─── API Keys ─────────────────────────────────────────────────

@router.post("/api-keys", response_model=ApiKeyCreatedResponse)
async def create_api_key(
    req: ApiKeyCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin"))
):
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")

    raw_key = _generate_api_key()
    key_hash = hash_api_key(raw_key)
    key_prefix = raw_key[:16] + "..."

    api_key = ApiKey(
        org_id=user.org_id,
        name=req.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    await log_audit(db, user, "create_api_key", "api_key", api_key.id, {"name": req.name})

    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key=raw_key,
        key_prefix=key_prefix,
        created_at=api_key.created_at,
    )


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin"))
):
    if not user.org_id:
        return []
    result = await db.execute(
        select(ApiKey).where(ApiKey.org_id == user.org_id).order_by(ApiKey.created_at.desc())
    )
    return [ApiKeyResponse.model_validate(k) for k in result.scalars().all()]


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin"))
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.org_id == user.org_id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    await db.commit()
    await log_audit(db, user, "revoke_api_key", "api_key", key_id)
    return {"status": "revoked"}
