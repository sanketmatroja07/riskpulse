from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import get_db, User, Organization
from models.schemas import BillingPlanResponse, UpgradePlanRequest, OrganizationResponse
from services.auth_service import get_current_user, require_role, log_audit
from config import get_settings

settings = get_settings()
router = APIRouter()

PLAN_LIMITS = {
    "starter": {"event_quota": 10_000, "max_members": 3, "price_monthly": 499},
    "pro":     {"event_quota": 100_000, "max_members": 15, "price_monthly": 1499},
    "enterprise": {"event_quota": 1_000_000, "max_members": 100, "price_monthly": 0},  # custom
}


@router.get("/plan", response_model=BillingPlanResponse)
async def get_billing_plan(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")
    result = await db.execute(select(Organization).where(Organization.id == user.org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return BillingPlanResponse(
        plan=org.plan,
        event_quota=org.event_quota,
        events_used=org.events_used or 0,
        max_members=org.max_members,
        stripe_customer_id=org.stripe_customer_id,
        stripe_subscription_id=org.stripe_subscription_id,
    )


@router.post("/upgrade", response_model=OrganizationResponse)
async def upgrade_plan(
    req: UpgradePlanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin"))
):
    if req.plan not in PLAN_LIMITS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}. Choose from: {list(PLAN_LIMITS.keys())}")

    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")

    result = await db.execute(select(Organization).where(Organization.id == user.org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    limits = PLAN_LIMITS[req.plan]

    # If Stripe is configured, create or update subscription
    if settings.STRIPE_SECRET_KEY and req.plan != "enterprise":
        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY

            if not org.stripe_customer_id:
                customer = stripe.Customer.create(
                    email=user.email,
                    name=org.name,
                    metadata={"org_id": str(org.id)},
                )
                org.stripe_customer_id = customer.id
                await db.flush()

            # Create a checkout session URL (return it for frontend redirect)
            # For now, just update the plan directly
        except Exception:
            pass  # Stripe not available, proceed with direct upgrade

    org.plan = req.plan
    org.event_quota = limits["event_quota"]
    org.max_members = limits["max_members"]
    await db.commit()
    await db.refresh(org)

    await log_audit(db, user, "upgrade_plan", "organization", org.id, {"plan": req.plan})
    return OrganizationResponse.model_validate(org)


@router.post("/reset-usage")
async def reset_usage(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin"))
):
    """Admin-only: reset monthly event counter."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")
    result = await db.execute(select(Organization).where(Organization.id == user.org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    from datetime import datetime
    org.events_used = 0
    org.events_reset_at = datetime.utcnow()
    await db.commit()
    return {"status": "reset", "events_used": 0}


@router.get("/plans", response_model=list)
async def list_plans():
    """Public: list available plans."""
    return [
        {
            "name": "Starter",
            "slug": "starter",
            "price": 499,
            "event_quota": 10_000,
            "max_members": 3,
            "features": ["Core detection engine", "Rule builder", "Dashboard", "Email alerts", "CSV upload"],
        },
        {
            "name": "Pro",
            "slug": "pro",
            "price": 1499,
            "event_quota": 100_000,
            "max_members": 15,
            "features": [
                "Everything in Starter", "AI narratives", "Rule backtesting",
                "Entity graph analysis", "API webhooks", "Priority support"
            ],
        },
        {
            "name": "Enterprise",
            "slug": "enterprise",
            "price": 0,
            "event_quota": 1_000_000,
            "max_members": 100,
            "features": [
                "Everything in Pro", "Custom integrations", "Dedicated support",
                "SLA guarantees", "On-premise option", "Custom ML models"
            ],
        },
    ]
