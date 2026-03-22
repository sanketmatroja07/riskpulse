import hashlib
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import get_db, User, Organization, ApiKey
from config import get_settings

settings = get_settings()
security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_api_key(key: str) -> str:
    """SHA-256 hash for API key storage."""
    return hashlib.sha256(key.encode()).hexdigest()


def create_token(user_id: str, email: str, role: str, org_id: str = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "org_id": org_id,
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_org_from_user(user: User, db: AsyncSession) -> Optional[Organization]:
    """Get the organization for the current user."""
    if not user.org_id:
        return None
    result = await db.execute(select(Organization).where(Organization.id == user.org_id))
    return result.scalar_one_or_none()


async def authenticate_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> tuple:
    """Authenticate a request via API key header. Returns (org, api_key_record)."""
    key = request.headers.get("X-RiskPulse-Key")
    if not key:
        raise HTTPException(status_code=401, detail="Missing API key. Provide X-RiskPulse-Key header.")

    key_hash = hash_api_key(key)
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Get the org
    org_result = await db.execute(
        select(Organization).where(Organization.id == api_key.org_id, Organization.is_active == True)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=403, detail="Organization not found or inactive")

    # Check quota
    if org.events_used >= org.event_quota:
        raise HTTPException(status_code=429, detail="Monthly event quota exceeded. Upgrade your plan.")

    # Update last_used_at
    api_key.last_used_at = datetime.utcnow()
    await db.commit()

    return org, api_key


def require_role(*roles):
    async def role_checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail=f"Role '{user.role}' not authorized. Required: {roles}")
        return user
    return role_checker


async def log_audit(
    db: AsyncSession, user: User, action: str, resource_type: str,
    resource_id: str = None, details: dict = None
):
    from models.database import AuditLog
    log = AuditLog(
        org_id=user.org_id if hasattr(user, 'org_id') else None,
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        details=details or {}
    )
    db.add(log)
    await db.commit()
