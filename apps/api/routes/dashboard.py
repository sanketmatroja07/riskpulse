from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from models.database import get_db, User, Alert, Case, Event, AuditLog
from models.schemas import DashboardStats
from services.auth_service import get_current_user

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total alerts
    q = select(func.count(Alert.id))
    q = _org_filter(q, Alert, user)
    total_alerts = (await db.execute(q)).scalar() or 0

    q2 = select(func.count(Alert.id)).where(Alert.status.in_(["new", "acknowledged", "investigating"]))
    q2 = _org_filter(q2, Alert, user)
    open_alerts = (await db.execute(q2)).scalar() or 0

    q3 = select(func.count(Alert.id)).where(Alert.severity == "critical", Alert.status.in_(["new", "acknowledged"]))
    q3 = _org_filter(q3, Alert, user)
    critical_alerts = (await db.execute(q3)).scalar() or 0

    # Total cases
    q4 = select(func.count(Case.id))
    q4 = _org_filter(q4, Case, user)
    total_cases = (await db.execute(q4)).scalar() or 0

    q5 = select(func.count(Case.id)).where(Case.status.in_(["new", "investigating", "pending_review", "escalated"]))
    q5 = _org_filter(q5, Case, user)
    open_cases = (await db.execute(q5)).scalar() or 0

    q6 = select(func.count(Case.id)).where(Case.resolved_at >= today_start)
    q6 = _org_filter(q6, Case, user)
    resolved_today = (await db.execute(q6)).scalar() or 0

    # SLA breaches
    q7 = select(func.count(Case.id)).where(
        Case.sla_deadline < now,
        Case.status.in_(["new", "investigating", "pending_review"])
    )
    q7 = _org_filter(q7, Case, user)
    sla_breaches = (await db.execute(q7)).scalar() or 0

    # Alerts by type
    q8 = select(Alert.alert_type, func.count(Alert.id)).group_by(Alert.alert_type)
    q8 = _org_filter(q8, Alert, user)
    type_rows = (await db.execute(q8)).all()
    alerts_by_type = {r[0]: r[1] for r in type_rows}

    # Alerts by severity
    q9 = select(Alert.severity, func.count(Alert.id)).group_by(Alert.severity)
    q9 = _org_filter(q9, Alert, user)
    sev_rows = (await db.execute(q9)).all()
    alerts_by_severity = {r[0]: r[1] for r in sev_rows}

    # Cases by status
    q10 = select(Case.status, func.count(Case.id)).group_by(Case.status)
    q10 = _org_filter(q10, Case, user)
    status_rows = (await db.execute(q10)).all()
    cases_by_status = {r[0]: r[1] for r in status_rows}

    # Recent activity
    q11 = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(20)
    q11 = _org_filter(q11, AuditLog, user)
    recent = (await db.execute(q11)).scalars().all()
    recent_activity = [
        {
            "action": a.action, "resource_type": a.resource_type,
            "resource_id": a.resource_id, "user_email": a.user_email,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in recent
    ]

    # Alert trend (last 7 days)
    alert_trend = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        next_day = day + timedelta(days=1)
        q12 = select(func.count(Alert.id)).where(Alert.created_at >= day, Alert.created_at < next_day)
        q12 = _org_filter(q12, Alert, user)
        count = (await db.execute(q12)).scalar() or 0
        alert_trend.append({"date": day.strftime("%Y-%m-%d"), "count": count})

    return DashboardStats(
        total_alerts=total_alerts,
        open_alerts=open_alerts,
        total_cases=total_cases,
        open_cases=open_cases,
        resolved_today=resolved_today,
        critical_alerts=critical_alerts,
        sla_breaches=sla_breaches,
        alerts_by_type=alerts_by_type,
        alerts_by_severity=alerts_by_severity,
        cases_by_status=cases_by_status,
        recent_activity=recent_activity,
        alert_trend=alert_trend,
        avg_resolution_hours=0.0,
        detection_rate=0.85
    )
