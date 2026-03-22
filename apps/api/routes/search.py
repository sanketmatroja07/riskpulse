from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import get_db, User, Entity, Case, Alert
from models.schemas import SearchResponse, SearchResult
from services.auth_service import get_current_user

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    results = []

    # Search entities
    ent_query = select(Entity).where(
        or_(Entity.external_id.ilike(f"%{q}%"), Entity.display_name.ilike(f"%{q}%"))
    ).limit(10)
    ent_query = _org_filter(ent_query, Entity, user)
    ent_result = await db.execute(ent_query)
    for e in ent_result.scalars().all():
        results.append(SearchResult(
            type="entity", id=e.id,
            title=e.display_name or e.external_id,
            subtitle=f"{e.entity_type} | Risk: {e.risk_score:.2f}",
            score=e.risk_score or 0
        ))

    # Search cases
    case_query = select(Case).where(
        or_(Case.case_number.ilike(f"%{q}%"), Case.title.ilike(f"%{q}%"))
    ).limit(10)
    case_query = _org_filter(case_query, Case, user)
    case_result = await db.execute(case_query)
    for c in case_result.scalars().all():
        results.append(SearchResult(
            type="case", id=c.id,
            title=f"{c.case_number}: {c.title}",
            subtitle=f"{c.status} | {c.priority}",
            score=0
        ))

    # Search alerts
    alert_query = select(Alert).where(Alert.title.ilike(f"%{q}%")).limit(10)
    alert_query = _org_filter(alert_query, Alert, user)
    alert_result = await db.execute(alert_query)
    for a in alert_result.scalars().all():
        results.append(SearchResult(
            type="alert", id=a.id,
            title=a.title,
            subtitle=f"{a.alert_type} | {a.severity}",
            score=a.model_score or 0
        ))

    return SearchResponse(results=results, total=len(results))
