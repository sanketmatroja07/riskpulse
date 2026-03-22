from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from models.database import get_db, User, Deployment, Rule, Feature
from models.schemas import DeploymentResponse
from services.auth_service import get_current_user, require_role, log_audit

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("", response_model=dict)
async def list_deployments(
    deployment_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Deployment)
    count_query = select(func.count(Deployment.id))

    query = _org_filter(query, Deployment, user)
    count_query = _org_filter(count_query, Deployment, user)

    if deployment_type:
        query = query.where(Deployment.deployment_type == deployment_type)
        count_query = count_query.where(Deployment.deployment_type == deployment_type)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Deployment.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    deployments = [DeploymentResponse.model_validate(d) for d in result.scalars().all()]

    return {"items": deployments, "total": total, "page": page, "page_size": page_size}


@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(deployment_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Deployment).where(Deployment.id == deployment_id)
    query = _org_filter(query, Deployment, user)
    result = await db.execute(query)
    deployment = result.scalar_one_or_none()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return DeploymentResponse.model_validate(deployment)


@router.post("/{deployment_id}/rollback", response_model=DeploymentResponse)
async def rollback_deployment(
    deployment_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "engineer"))
):
    query = select(Deployment).where(Deployment.id == deployment_id)
    query = _org_filter(query, Deployment, user)
    result = await db.execute(query)
    orig = result.scalar_one_or_none()
    if not orig:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if orig.deployment_type == "rule":
        rule_result = await db.execute(select(Rule).where(Rule.id == orig.artifact_id))
        rule = rule_result.scalar_one_or_none()
        if rule:
            rule.enabled = not rule.enabled
    elif orig.deployment_type == "feature":
        feat_result = await db.execute(select(Feature).where(Feature.id == orig.artifact_id))
        feat = feat_result.scalar_one_or_none()
        if feat:
            feat.enabled = not feat.enabled

    rollback = Deployment(
        org_id=user.org_id,
        deployment_type=orig.deployment_type,
        artifact_id=orig.artifact_id,
        artifact_name=orig.artifact_name,
        action="rollback",
        config_snapshot=orig.config_snapshot,
        deployed_by=user.id,
        rollback_of=deployment_id,
        notes=f"Rollback of deployment {deployment_id}"
    )
    db.add(rollback)
    await db.commit()
    await db.refresh(rollback)
    await log_audit(db, user, "rollback_deployment", "deployment", deployment_id)
    return DeploymentResponse.model_validate(rollback)
