from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from models.database import get_db, User, Alert, Case, Entity
from models.schemas import (
    AlertResponse, AlertUpdateRequest, BulkAlertAction, CaseCreateRequest, CaseResponse
)
from services.auth_service import get_current_user, require_role, log_audit
import uuid as uuid_mod
from datetime import datetime, timedelta

router = APIRouter()


def _org_filter(query, model, user):
    """Apply org_id filter if user belongs to an org."""
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("", response_model=dict)
async def list_alerts(
    status: Optional[str] = None,
    alert_type: Optional[str] = None,
    severity: Optional[str] = None,
    assigned_to: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Alert)
    count_query = select(func.count(Alert.id))

    query = _org_filter(query, Alert, user)
    count_query = _org_filter(count_query, Alert, user)

    if status:
        query = query.where(Alert.status == status)
        count_query = count_query.where(Alert.status == status)
    if alert_type:
        query = query.where(Alert.alert_type == alert_type)
        count_query = count_query.where(Alert.alert_type == alert_type)
    if severity:
        query = query.where(Alert.severity == severity)
        count_query = count_query.where(Alert.severity == severity)
    if assigned_to:
        query = query.where(Alert.assigned_to == assigned_to)
        count_query = count_query.where(Alert.assigned_to == assigned_to)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Alert.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    alerts = [AlertResponse.model_validate(a) for a in result.scalars().all()]

    return {"items": alerts, "total": total, "page": page, "page_size": page_size}


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Alert).where(Alert.id == alert_id)
    query = _org_filter(query, Alert, user)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertResponse.model_validate(alert)


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: UUID,
    req: AlertUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst"))
):
    query = select(Alert).where(Alert.id == alert_id)
    query = _org_filter(query, Alert, user)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if req.status:
        alert.status = req.status
        if req.status == "resolved":
            alert.resolved_at = datetime.utcnow()
    if req.assigned_to:
        alert.assigned_to = req.assigned_to
    if req.severity:
        alert.severity = req.severity
    alert.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(alert)
    await log_audit(db, user, "update_alert", "alert", alert_id, {"changes": req.model_dump(exclude_none=True)})
    return AlertResponse.model_validate(alert)


@router.post("/bulk-action", response_model=dict)
async def bulk_alert_action(
    req: BulkAlertAction,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst"))
):
    status_map = {
        "acknowledge": "acknowledged",
        "dismiss": "dismissed",
        "escalate": "escalated"
    }
    new_status = status_map.get(req.action)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Invalid action: {req.action}")

    updates = {"status": new_status, "updated_at": datetime.utcnow()}
    if req.assigned_to:
        updates["assigned_to"] = req.assigned_to

    stmt = update(Alert).where(Alert.id.in_(req.alert_ids))
    if user.org_id:
        stmt = stmt.where(Alert.org_id == user.org_id)
    await db.execute(stmt.values(**updates))
    await db.commit()
    await log_audit(db, user, f"bulk_{req.action}", "alert", None, {"alert_ids": [str(a) for a in req.alert_ids]})
    return {"updated": len(req.alert_ids)}


@router.post("/{alert_id}/create-case", response_model=CaseResponse)
async def create_case_from_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst"))
):
    query = select(Alert).where(Alert.id == alert_id)
    query = _org_filter(query, Alert, user)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Generate case number
    count_q = select(func.count(Case.id))
    if user.org_id:
        count_q = count_q.where(Case.org_id == user.org_id)
    count = (await db.execute(count_q)).scalar() or 0
    case_number = f"CASE-{count + 1:05d}"

    entity_ids = [alert.entity_id] if alert.entity_id else []

    case = Case(
        org_id=user.org_id,
        case_number=case_number,
        title=f"Investigation: {alert.title}",
        description=alert.description,
        status="new",
        priority=alert.severity if alert.severity in ["low", "medium", "high", "critical"] else "medium",
        assigned_to=user.id,
        alert_ids=[alert.id],
        entity_ids=entity_ids,
        sla_deadline=datetime.utcnow() + timedelta(hours=24 if alert.severity in ["critical", "high"] else 72)
    )
    db.add(case)
    await db.flush()

    alert.case_id = case.id
    alert.status = "investigating"
    alert.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(case)
    await log_audit(db, user, "create_case_from_alert", "case", case.id, {"alert_id": str(alert_id)})
    return CaseResponse.model_validate(case)
