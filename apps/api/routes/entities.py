from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from models.database import get_db, User, Entity, EntityEdge, Event, Transaction, Alert
from models.schemas import (
    EntityResponse, EntityGraphResponse, EntityGraphNode, EntityGraphEdge,
    EventResponse, TransactionResponse, AlertResponse
)
from services.auth_service import get_current_user

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("", response_model=dict)
async def list_entities(
    entity_type: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Entity)
    count_query = select(func.count(Entity.id))

    query = _org_filter(query, Entity, user)
    count_query = _org_filter(count_query, Entity, user)

    if entity_type:
        query = query.where(Entity.entity_type == entity_type)
        count_query = count_query.where(Entity.entity_type == entity_type)
    if q:
        filter_cond = or_(
            Entity.external_id.ilike(f"%{q}%"),
            Entity.display_name.ilike(f"%{q}%")
        )
        query = query.where(filter_cond)
        count_query = count_query.where(filter_cond)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Entity.risk_score.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    entities = [EntityResponse.model_validate(e) for e in result.scalars().all()]

    return {"items": entities, "total": total, "page": page, "page_size": page_size}


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(entity_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Entity).where(Entity.id == entity_id)
    query = _org_filter(query, Entity, user)
    result = await db.execute(query)
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return EntityResponse.model_validate(entity)


@router.get("/{entity_id}/graph", response_model=EntityGraphResponse)
async def get_entity_graph(
    entity_id: UUID,
    depth: int = Query(2, ge=1, le=3),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    visited = set()
    to_visit = {entity_id}
    all_edges = []

    for _ in range(depth):
        if not to_visit:
            break
        edge_result = await db.execute(
            select(EntityEdge).where(
                (EntityEdge.source_entity_id.in_(list(to_visit))) |
                (EntityEdge.target_entity_id.in_(list(to_visit)))
            )
        )
        edges = edge_result.scalars().all()
        new_ids = set()
        for e in edges:
            all_edges.append(e)
            new_ids.add(e.source_entity_id)
            new_ids.add(e.target_entity_id)
        visited.update(to_visit)
        to_visit = new_ids - visited

    all_ids = visited | to_visit
    if not all_ids:
        all_ids = {entity_id}

    ent_result = await db.execute(select(Entity).where(Entity.id.in_(list(all_ids))))
    entities = ent_result.scalars().all()

    seen_edges = set()
    unique_edges = []
    for e in all_edges:
        key = (str(e.source_entity_id), str(e.target_entity_id), e.edge_type)
        if key not in seen_edges:
            seen_edges.add(key)
            unique_edges.append(e)

    nodes = [
        EntityGraphNode(
            id=str(e.id), entity_type=e.entity_type,
            external_id=e.external_id, display_name=e.display_name,
            risk_score=e.risk_score or 0
        ) for e in entities
    ]
    edges = [
        EntityGraphEdge(
            source=str(e.source_entity_id), target=str(e.target_entity_id),
            edge_type=e.edge_type, weight=e.weight or 1.0
        ) for e in unique_edges
    ]
    return EntityGraphResponse(nodes=nodes, edges=edges)


@router.get("/{entity_id}/events", response_model=List[EventResponse])
async def get_entity_events(
    entity_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Event).where(Event.entity_id == entity_id).order_by(Event.occurred_at.desc()).limit(limit)
    )
    return [EventResponse.model_validate(e) for e in result.scalars().all()]


@router.get("/{entity_id}/transactions", response_model=List[TransactionResponse])
async def get_entity_transactions(
    entity_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Transaction).where(
            (Transaction.user_entity_id == entity_id) |
            (Transaction.merchant_entity_id == entity_id) |
            (Transaction.card_entity_id == entity_id) |
            (Transaction.ip_entity_id == entity_id) |
            (Transaction.device_entity_id == entity_id)
        ).order_by(Transaction.occurred_at.desc()).limit(limit)
    )
    return [TransactionResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/{entity_id}/alerts", response_model=List[AlertResponse])
async def get_entity_alerts(
    entity_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Alert).where(Alert.entity_id == entity_id).order_by(Alert.created_at.desc()).limit(50)
    )
    return [AlertResponse.model_validate(a) for a in result.scalars().all()]
