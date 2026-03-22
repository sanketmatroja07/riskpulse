from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from datetime import datetime
from models.database import get_db, User, Feature, Deployment
from models.schemas import FeatureResponse, FeatureCreateRequest, DeploymentResponse, DeployRequest
from services.auth_service import get_current_user, require_role, log_audit

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("", response_model=dict)
async def list_features(
    feature_type: Optional[str] = None,
    enabled: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Feature)
    count_query = select(func.count(Feature.id))

    query = _org_filter(query, Feature, user)
    count_query = _org_filter(count_query, Feature, user)

    if feature_type:
        query = query.where(Feature.feature_type == feature_type)
        count_query = count_query.where(Feature.feature_type == feature_type)
    if enabled is not None:
        query = query.where(Feature.enabled == enabled)
        count_query = count_query.where(Feature.enabled == enabled)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Feature.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    features = [FeatureResponse.model_validate(f) for f in result.scalars().all()]

    return {"items": features, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=FeatureResponse)
async def create_feature(
    req: FeatureCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "engineer"))
):
    feature = Feature(
        org_id=user.org_id,
        name=req.name,
        description=req.description,
        feature_type=req.feature_type,
        definition_json=req.definition_json,
        enabled=req.enabled,
        created_by=user.id
    )
    db.add(feature)
    await db.commit()
    await db.refresh(feature)
    await log_audit(db, user, "create_feature", "feature", feature.id)
    return FeatureResponse.model_validate(feature)


@router.get("/{feature_id}", response_model=FeatureResponse)
async def get_feature(feature_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Feature).where(Feature.id == feature_id)
    query = _org_filter(query, Feature, user)
    result = await db.execute(query)
    feature = result.scalar_one_or_none()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    return FeatureResponse.model_validate(feature)


@router.post("/{feature_id}/deploy", response_model=DeploymentResponse)
async def deploy_feature(
    feature_id: UUID,
    req: DeployRequest = DeployRequest(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "engineer"))
):
    query = select(Feature).where(Feature.id == feature_id)
    query = _org_filter(query, Feature, user)
    result = await db.execute(query)
    feature = result.scalar_one_or_none()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    deployment = Deployment(
        org_id=user.org_id,
        deployment_type="feature",
        artifact_id=feature.id,
        artifact_name=feature.name,
        action="enable" if feature.enabled else "disable",
        config_snapshot=feature.definition_json,
        deployed_by=user.id,
        notes=req.notes
    )
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)
    await log_audit(db, user, "deploy_feature", "feature", feature_id, {"deployment_id": str(deployment.id)})
    return DeploymentResponse.model_validate(deployment)
