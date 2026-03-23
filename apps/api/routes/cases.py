from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
from models.database import (
    get_db, User, Case, Alert, Evidence, Narrative, CaseComment,
    CaseDecision, Entity, EntityEdge, Event, Transaction, SuggestedMitigation
)
from models.schemas import (
    CaseCreateRequest, CaseResponse, CaseUpdateRequest, CaseDecisionRequest,
    EvidenceResponse, NarrativeResponse, CommentCreateRequest, CommentResponse,
    EntityGraphResponse, EntityGraphNode, EntityGraphEdge, MitigationResponse
)
from services.auth_service import get_current_user, require_role, log_audit
from services.narrative_service import generate_narrative
from services.investigation_service import collect_evidence
from services.mitigation_service import suggest_mitigations

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


async def _next_case_number(db: AsyncSession) -> str:
    """Generate a globally unique case number.

    Case numbers are globally unique in the database, so they cannot be based
    only on the current org's case count.
    """
    count = (await db.execute(select(func.count(Case.id)))).scalar() or 0
    return f"CASE-{count + 1:05d}"


@router.get("", response_model=dict)
async def list_cases(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Case)
    count_query = select(func.count(Case.id))

    query = _org_filter(query, Case, user)
    count_query = _org_filter(count_query, Case, user)

    if status:
        query = query.where(Case.status == status)
        count_query = count_query.where(Case.status == status)
    if priority:
        query = query.where(Case.priority == priority)
        count_query = count_query.where(Case.priority == priority)
    if assigned_to:
        query = query.where(Case.assigned_to == assigned_to)
        count_query = count_query.where(Case.assigned_to == assigned_to)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Case.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    cases = [CaseResponse.model_validate(c) for c in result.scalars().all()]

    return {"items": cases, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=CaseResponse)
async def create_case(
    req: CaseCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst"))
):
    case_number = await _next_case_number(db)

    case = Case(
        org_id=user.org_id,
        case_number=case_number,
        title=req.title,
        description=req.description,
        priority=req.priority,
        assigned_to=req.assigned_to or user.id,
        alert_ids=req.alert_ids,
        tags=req.tags,
        sla_deadline=datetime.utcnow() + timedelta(hours=24 if req.priority in ["critical", "high"] else 72)
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    await log_audit(db, user, "create_case", "case", case.id)
    return CaseResponse.model_validate(case)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(case_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Case).where(Case.id == case_id)
    query = _org_filter(query, Case, user)
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseResponse.model_validate(case)


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: UUID,
    req: CaseUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst"))
):
    query = select(Case).where(Case.id == case_id)
    query = _org_filter(query, Case, user)
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if req.status:
        case.status = req.status
        if req.status in ("resolved", "closed"):
            case.resolved_at = datetime.utcnow()
    if req.priority:
        case.priority = req.priority
    if req.assigned_to:
        case.assigned_to = req.assigned_to
    if req.tags is not None:
        case.tags = req.tags
    case.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(case)
    await log_audit(db, user, "update_case", "case", case_id, {"changes": req.model_dump(exclude_none=True)})
    return CaseResponse.model_validate(case)


@router.post("/{case_id}/decision", response_model=dict)
async def make_decision(
    case_id: UUID,
    req: CaseDecisionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst"))
):
    query = select(Case).where(Case.id == case_id)
    query = _org_filter(query, Case, user)
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    decision = CaseDecision(
        org_id=user.org_id,
        case_id=case_id,
        decision=req.decision,
        rationale=req.rationale,
        user_id=user.id
    )
    db.add(decision)

    case.decision = req.decision
    if req.decision in ("approve", "deny", "block"):
        case.status = "resolved"
        case.resolved_at = datetime.utcnow()
    elif req.decision == "escalate":
        case.status = "escalated"
    case.updated_at = datetime.utcnow()

    await db.commit()
    await log_audit(db, user, "case_decision", "case", case_id, {"decision": req.decision})
    return {"status": "ok", "decision": req.decision}


# Evidence
@router.get("/{case_id}/evidence", response_model=List[EvidenceResponse])
async def get_evidence(case_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Evidence).where(Evidence.case_id == case_id).order_by(Evidence.collected_at.desc())
    )
    return [EvidenceResponse.model_validate(e) for e in result.scalars().all()]


@router.post("/{case_id}/collect-evidence", response_model=List[EvidenceResponse])
async def collect_case_evidence(
    case_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst"))
):
    evidence_list = await collect_evidence(db, case_id)
    await log_audit(db, user, "collect_evidence", "case", case_id, {"count": len(evidence_list)})
    return evidence_list


# Narrative
@router.get("/{case_id}/narratives", response_model=List[NarrativeResponse])
async def get_narratives(case_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Narrative).where(Narrative.case_id == case_id).order_by(Narrative.created_at.desc())
    )
    return [NarrativeResponse.model_validate(n) for n in result.scalars().all()]


@router.post("/{case_id}/generate-narrative", response_model=NarrativeResponse)
async def generate_case_narrative(
    case_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst"))
):
    narrative = await generate_narrative(db, case_id, user.id)
    await log_audit(db, user, "generate_narrative", "case", case_id)
    return NarrativeResponse.model_validate(narrative)


# Entity Graph
@router.get("/{case_id}/graph", response_model=EntityGraphResponse)
async def get_case_graph(case_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Case).where(Case.id == case_id)
    query = _org_filter(query, Case, user)
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    entity_ids = case.entity_ids or []
    if not entity_ids:
        return EntityGraphResponse(nodes=[], edges=[])

    ent_result = await db.execute(select(Entity).where(Entity.id.in_(entity_ids)))
    entities = ent_result.scalars().all()

    connected_ids = set(entity_ids)
    edge_result = await db.execute(
        select(EntityEdge).where(
            (EntityEdge.source_entity_id.in_(entity_ids)) |
            (EntityEdge.target_entity_id.in_(entity_ids))
        )
    )
    edges_raw = edge_result.scalars().all()
    for e in edges_raw:
        connected_ids.add(e.source_entity_id)
        connected_ids.add(e.target_entity_id)

    all_ent_result = await db.execute(select(Entity).where(Entity.id.in_(list(connected_ids))))
    all_entities = all_ent_result.scalars().all()

    nodes = [
        EntityGraphNode(
            id=str(e.id), entity_type=e.entity_type,
            external_id=e.external_id, display_name=e.display_name,
            risk_score=e.risk_score or 0
        )
        for e in all_entities
    ]
    edges = [
        EntityGraphEdge(
            source=str(e.source_entity_id), target=str(e.target_entity_id),
            edge_type=e.edge_type, weight=e.weight or 1.0
        )
        for e in edges_raw
    ]
    return EntityGraphResponse(nodes=nodes, edges=edges)


# Timeline
@router.get("/{case_id}/timeline", response_model=List[dict])
async def get_case_timeline(case_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Case).where(Case.id == case_id)
    query = _org_filter(query, Case, user)
    result = await db.execute(query)
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    timeline = []
    entity_ids = case.entity_ids or []

    if entity_ids:
        events_result = await db.execute(
            select(Event).where(Event.entity_id.in_(entity_ids)).order_by(Event.occurred_at.desc()).limit(50)
        )
        for ev in events_result.scalars().all():
            timeline.append({
                "type": "event", "id": str(ev.id), "event_type": ev.event_type,
                "data": ev.data, "risk_score": ev.risk_score,
                "occurred_at": ev.occurred_at.isoformat() if ev.occurred_at else None
            })

    ev_result = await db.execute(
        select(Evidence).where(Evidence.case_id == case_id).order_by(Evidence.collected_at.desc())
    )
    for e in ev_result.scalars().all():
        timeline.append({
            "type": "evidence", "id": str(e.id), "title": e.title,
            "evidence_type": e.evidence_type,
            "collected_at": e.collected_at.isoformat() if e.collected_at else None
        })

    comm_result = await db.execute(
        select(CaseComment).where(CaseComment.case_id == case_id).order_by(CaseComment.created_at.desc())
    )
    for c in comm_result.scalars().all():
        timeline.append({
            "type": "comment", "id": str(c.id), "content": c.content,
            "user_id": str(c.user_id),
            "created_at": c.created_at.isoformat() if c.created_at else None
        })

    dec_result = await db.execute(
        select(CaseDecision).where(CaseDecision.case_id == case_id).order_by(CaseDecision.created_at.desc())
    )
    for d in dec_result.scalars().all():
        timeline.append({
            "type": "decision", "id": str(d.id), "decision": d.decision,
            "rationale": d.rationale, "user_id": str(d.user_id),
            "created_at": d.created_at.isoformat() if d.created_at else None
        })

    def get_ts(item):
        for key in ["occurred_at", "collected_at", "created_at"]:
            if key in item and item[key]:
                return item[key]
        return ""
    timeline.sort(key=get_ts, reverse=True)
    return timeline


# Comments
@router.get("/{case_id}/comments", response_model=List[CommentResponse])
async def get_comments(case_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(CaseComment).where(CaseComment.case_id == case_id).order_by(CaseComment.created_at.asc())
    )
    return [CommentResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/{case_id}/comments", response_model=CommentResponse)
async def add_comment(
    case_id: UUID,
    req: CommentCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst", "engineer"))
):
    comment = CaseComment(
        org_id=user.org_id,
        case_id=case_id,
        user_id=user.id,
        content=req.content,
        mentions=req.mentions
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    await log_audit(db, user, "add_comment", "case", case_id)
    return CommentResponse.model_validate(comment)


# Mitigations
@router.get("/{case_id}/mitigations", response_model=List[MitigationResponse])
async def get_mitigations(case_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(SuggestedMitigation).where(SuggestedMitigation.case_id == case_id).order_by(SuggestedMitigation.created_at.desc())
    )
    return [MitigationResponse.model_validate(m) for m in result.scalars().all()]


@router.post("/{case_id}/suggest-mitigations", response_model=List[MitigationResponse])
async def suggest_case_mitigations(
    case_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst", "engineer"))
):
    mitigations = await suggest_mitigations(db, case_id)
    await log_audit(db, user, "suggest_mitigations", "case", case_id, {"count": len(mitigations)})
    return mitigations
