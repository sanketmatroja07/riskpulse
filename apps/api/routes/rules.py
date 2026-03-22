from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
from models.database import get_db, User, Rule, Deployment, Event, Alert
from models.schemas import RuleResponse, RuleCreateRequest, RuleUpdateRequest, DeploymentResponse, DeployRequest
from services.auth_service import get_current_user, require_role, log_audit
from services.detection_service import evaluate_rule_sync

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("", response_model=dict)
async def list_rules(
    rule_type: Optional[str] = None,
    enabled: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Rule)
    count_query = select(func.count(Rule.id))

    query = _org_filter(query, Rule, user)
    count_query = _org_filter(count_query, Rule, user)

    if rule_type:
        query = query.where(Rule.rule_type == rule_type)
        count_query = count_query.where(Rule.rule_type == rule_type)
    if enabled is not None:
        query = query.where(Rule.enabled == enabled)
        count_query = count_query.where(Rule.enabled == enabled)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Rule.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rules = [RuleResponse.model_validate(r) for r in result.scalars().all()]

    return {"items": rules, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=RuleResponse)
async def create_rule(
    req: RuleCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "engineer"))
):
    rule = Rule(
        org_id=user.org_id,
        name=req.name,
        description=req.description,
        rule_type=req.rule_type,
        condition_json=req.condition_json,
        severity=req.severity,
        alert_type=req.alert_type,
        enabled=req.enabled,
        created_by=user.id
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    await log_audit(db, user, "create_rule", "rule", rule.id)
    return RuleResponse.model_validate(rule)


@router.get("/{rule_id}", response_model=RuleResponse)
async def get_rule(rule_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Rule).where(Rule.id == rule_id)
    query = _org_filter(query, Rule, user)
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return RuleResponse.model_validate(rule)


@router.patch("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: UUID,
    req: RuleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "engineer"))
):
    query = select(Rule).where(Rule.id == rule_id)
    query = _org_filter(query, Rule, user)
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if req.name is not None:
        rule.name = req.name
    if req.description is not None:
        rule.description = req.description
    if req.condition_json is not None:
        rule.condition_json = req.condition_json
    if req.severity is not None:
        rule.severity = req.severity
    if req.enabled is not None:
        rule.enabled = req.enabled
    rule.version += 1
    rule.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(rule)
    await log_audit(db, user, "update_rule", "rule", rule_id, {"changes": req.model_dump(exclude_none=True)})
    return RuleResponse.model_validate(rule)


@router.post("/{rule_id}/deploy", response_model=DeploymentResponse)
async def deploy_rule(
    rule_id: UUID,
    req: DeployRequest = DeployRequest(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "engineer"))
):
    query = select(Rule).where(Rule.id == rule_id)
    query = _org_filter(query, Rule, user)
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    deployment = Deployment(
        org_id=user.org_id,
        deployment_type="rule",
        artifact_id=rule.id,
        artifact_name=rule.name,
        action="enable" if rule.enabled else "disable",
        config_snapshot=rule.condition_json,
        deployed_by=user.id,
        notes=req.notes
    )
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)
    await log_audit(db, user, "deploy_rule", "rule", rule_id, {"deployment_id": str(deployment.id)})
    return DeploymentResponse.model_validate(deployment)


@router.post("/{rule_id}/toggle", response_model=RuleResponse)
async def toggle_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "engineer"))
):
    query = select(Rule).where(Rule.id == rule_id)
    query = _org_filter(query, Rule, user)
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.enabled = not rule.enabled
    rule.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(rule)
    await log_audit(db, user, "toggle_rule", "rule", rule_id, {"enabled": rule.enabled})
    return RuleResponse.model_validate(rule)


@router.post("/{rule_id}/backtest", response_model=dict)
async def backtest_rule(
    rule_id: UUID,
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst", "engineer"))
):
    query = select(Rule).where(Rule.id == rule_id)
    query = _org_filter(query, Rule, user)
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    cutoff = datetime.utcnow() - timedelta(days=days)
    event_query = select(Event).where(Event.occurred_at >= cutoff).order_by(Event.occurred_at.desc()).limit(1000)
    event_query = _org_filter(event_query, Event, user)
    events_result = await db.execute(event_query)
    events = events_result.scalars().all()

    existing_alerts = (await db.execute(
        select(func.count(Alert.id)).where(Alert.rule_id == rule_id)
    )).scalar() or 0

    matched = []
    false_positives = 0
    true_positives = 0
    total_checked = len(events)
    daily_hits: dict = {}

    for ev in events:
        hit = evaluate_rule_sync(rule, ev)
        if hit:
            day_key = ev.occurred_at.strftime("%Y-%m-%d") if ev.occurred_at else "unknown"
            daily_hits[day_key] = daily_hits.get(day_key, 0) + 1

            risk = ev.risk_score or 0
            if risk >= 0.5:
                true_positives += 1
            else:
                false_positives += 1

            matched.append({
                "event_id": str(ev.id),
                "event_type": ev.event_type,
                "risk_score": ev.risk_score,
                "occurred_at": ev.occurred_at.isoformat() if ev.occurred_at else None,
                "data_preview": {k: v for k, v in (ev.data or {}).items() if k in ("amount", "country", "ip", "merchant")}
            })

    total_matched = len(matched)
    precision = round(true_positives / total_matched, 3) if total_matched > 0 else 0
    hit_rate = round(total_matched / total_checked, 4) if total_checked > 0 else 0

    sorted_daily = sorted(daily_hits.items())

    await log_audit(db, user, "backtest_rule", "rule", rule_id, {
        "days": days, "events_checked": total_checked, "matched": total_matched
    })

    return {
        "rule_id": str(rule_id),
        "rule_name": rule.name,
        "period_days": days,
        "events_checked": total_checked,
        "events_matched": total_matched,
        "hit_rate": hit_rate,
        "estimated_precision": precision,
        "true_positives": true_positives,
        "false_positives": false_positives,
        "existing_alerts": existing_alerts,
        "daily_hits": [{"date": d, "count": c} for d, c in sorted_daily],
        "sample_matches": matched[:20],
    }
