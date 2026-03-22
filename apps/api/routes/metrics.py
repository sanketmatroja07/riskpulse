from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from typing import Optional
from models.database import get_db, User, Job, Event, Alert, AuditLog
from models.schemas import MetricsResponse, AuditLogResponse
from services.auth_service import get_current_user, require_role

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("/system", response_model=MetricsResponse)
async def get_system_metrics(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    day_ago = now - timedelta(hours=24)

    q1 = select(func.count(Job.id)).where(Job.status == "pending")
    q1 = _org_filter(q1, Job, user)
    jobs_pending = (await db.execute(q1)).scalar() or 0

    q2 = select(func.count(Job.id)).where(Job.status == "running")
    q2 = _org_filter(q2, Job, user)
    jobs_running = (await db.execute(q2)).scalar() or 0

    q3 = select(func.count(Job.id)).where(Job.status == "failed")
    q3 = _org_filter(q3, Job, user)
    jobs_failed = (await db.execute(q3)).scalar() or 0

    q4 = select(func.count(Event.id)).where(Event.created_at >= day_ago)
    q4 = _org_filter(q4, Event, user)
    events_24h = (await db.execute(q4)).scalar() or 0

    q5 = select(func.count(Alert.id)).where(Alert.created_at >= day_ago)
    q5 = _org_filter(q5, Alert, user)
    alerts_24h = (await db.execute(q5)).scalar() or 0

    q6 = select(AuditLog).where(AuditLog.action.like("%error%")).order_by(AuditLog.created_at.desc()).limit(10)
    q6 = _org_filter(q6, AuditLog, user)
    errors = (await db.execute(q6)).scalars().all()
    recent_errors = [
        {"action": e.action, "details": e.details, "created_at": e.created_at.isoformat() if e.created_at else None}
        for e in errors
    ]

    return MetricsResponse(
        jobs_pending=jobs_pending,
        jobs_running=jobs_running,
        jobs_failed=jobs_failed,
        events_processed_24h=events_24h,
        alerts_generated_24h=alerts_24h,
        avg_processing_time_ms=45.0,
        system_health="healthy" if jobs_failed < 5 else "degraded",
        recent_errors=recent_errors
    )


@router.get("/audit-log", response_model=dict)
async def get_audit_log(
    resource_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin"))
):
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    query = _org_filter(query, AuditLog, user)
    count_query = _org_filter(count_query, AuditLog, user)

    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
        count_query = count_query.where(AuditLog.resource_type == resource_type)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = [AuditLogResponse.model_validate(l) for l in result.scalars().all()]

    return {"items": logs, "total": total, "page": page, "page_size": page_size}
