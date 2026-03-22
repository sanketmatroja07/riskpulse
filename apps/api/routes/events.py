from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import json
import csv
import io
import random
from models.database import get_db, User, Event, Entity, Transaction, Organization
from models.schemas import EventResponse, IngestEventRequest
from services.auth_service import get_current_user, require_role, log_audit, authenticate_api_key
from services.detection_service import process_event

router = APIRouter()


def _org_filter(query, model, user):
    if user.org_id:
        return query.where(model.org_id == user.org_id)
    return query


@router.get("", response_model=dict)
async def list_events(
    event_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = select(Event)
    count_query = select(func.count(Event.id))

    query = _org_filter(query, Event, user)
    count_query = _org_filter(count_query, Event, user)

    if event_type:
        query = query.where(Event.event_type == event_type)
        count_query = count_query.where(Event.event_type == event_type)
    if entity_id:
        query = query.where(Event.entity_id == entity_id)
        count_query = count_query.where(Event.entity_id == entity_id)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Event.occurred_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    events = [EventResponse.model_validate(e) for e in result.scalars().all()]

    return {"items": events, "total": total, "page": page, "page_size": page_size}


@router.post("/ingest", response_model=dict)
async def ingest_event(
    req: IngestEventRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "analyst", "engineer"))
):
    entity_id = None
    if req.entity_type and req.entity_external_id:
        result = await db.execute(
            select(Entity).where(
                Entity.entity_type == req.entity_type,
                Entity.external_id == req.entity_external_id
            )
        )
        entity = result.scalar_one_or_none()
        if not entity:
            entity = Entity(
                org_id=user.org_id,
                entity_type=req.entity_type,
                external_id=req.entity_external_id,
                display_name=req.entity_external_id
            )
            db.add(entity)
            await db.flush()
        entity_id = entity.id

    event = Event(
        org_id=user.org_id,
        event_type=req.event_type,
        source=req.source,
        entity_id=entity_id,
        data=req.data,
        occurred_at=req.occurred_at or datetime.utcnow()
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    alerts_created = await process_event(db, event)
    await log_audit(db, user, "ingest_event", "event", event.id, {"alerts_created": alerts_created})

    return {"event_id": str(event.id), "alerts_created": alerts_created}


@router.post("/ingest/webhook", response_model=dict)
async def webhook_ingest(
    events: List[IngestEventRequest],
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Webhook endpoint for batch event ingestion, authenticated via API key."""
    # Authenticate via API key
    org, api_key = await authenticate_api_key(request, db)

    total_alerts = 0
    event_ids = []

    for req in events:
        entity_id = None
        if req.entity_type and req.entity_external_id:
            result = await db.execute(
                select(Entity).where(
                    Entity.org_id == org.id,
                    Entity.entity_type == req.entity_type,
                    Entity.external_id == req.entity_external_id
                )
            )
            entity = result.scalar_one_or_none()
            if not entity:
                entity = Entity(
                    org_id=org.id,
                    entity_type=req.entity_type,
                    external_id=req.entity_external_id,
                    display_name=req.entity_external_id
                )
                db.add(entity)
                await db.flush()
            entity_id = entity.id

        event = Event(
            org_id=org.id,
            event_type=req.event_type,
            source=req.source,
            entity_id=entity_id,
            data=req.data,
            occurred_at=req.occurred_at or datetime.utcnow()
        )
        db.add(event)
        await db.flush()
        event_ids.append(str(event.id))

        alerts = await process_event(db, event)
        total_alerts += alerts

    # Increment usage counter
    org.events_used = (org.events_used or 0) + len(event_ids)
    await db.commit()

    return {"events_ingested": len(event_ids), "alerts_created": total_alerts, "org": org.slug}


@router.post("/ingest/csv", response_model=dict)
async def csv_ingest(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin", "engineer"))
):
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    count = 0
    alerts_total = 0
    for row in reader:
        event = Event(
            org_id=user.org_id,
            event_type=row.get("event_type", "transaction"),
            source="csv_upload",
            data=dict(row),
            occurred_at=datetime.fromisoformat(row["occurred_at"]) if "occurred_at" in row else datetime.utcnow()
        )
        db.add(event)
        await db.flush()
        alerts = await process_event(db, event)
        alerts_total += alerts
        count += 1

    await db.commit()
    await log_audit(db, user, "csv_ingest", "event", None, {"rows": count, "filename": file.filename})
    return {"rows_ingested": count, "alerts_created": alerts_total}


@router.post("/simulate", response_model=dict)
async def simulate_events(
    count: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Simulate random fraud events for demo mode."""
    entity_query = select(Entity).where(Entity.entity_type == "user")
    entity_query = _org_filter(entity_query, Entity, user)
    entities_result = await db.execute(entity_query.limit(60))
    entities = entities_result.scalars().all()
    if not entities:
        raise HTTPException(status_code=400, detail="No entities in database. Run seed first.")

    merchant_query = select(Entity).where(Entity.entity_type == "merchant")
    merchant_query = _org_filter(merchant_query, Entity, user)
    merchants_result = await db.execute(merchant_query.limit(30))
    merchants = merchants_result.scalars().all()

    event_types = ["transaction", "login_attempt", "password_reset", "card_added", "email_change"]
    countries = ["US", "US", "US", "US", "GB", "CA", "DE", "RO", "NG", "BY"]
    scenarios = [
        {"name": "normal", "weight": 50, "amount_range": (10, 500), "risk_country": False},
        {"name": "high_value", "weight": 15, "amount_range": (2000, 12000), "risk_country": False},
        {"name": "suspicious_geo", "weight": 10, "amount_range": (100, 3000), "risk_country": True},
        {"name": "velocity_burst", "weight": 10, "amount_range": (50, 200), "risk_country": False},
        {"name": "new_device_high_amount", "weight": 10, "amount_range": (1000, 8000), "risk_country": False},
        {"name": "ato_signal", "weight": 5, "amount_range": (0, 0), "risk_country": True},
    ]
    weights = [s["weight"] for s in scenarios]

    created_events = 0
    total_alerts = 0

    for _ in range(count):
        scenario = random.choices(scenarios, weights=weights, k=1)[0]
        entity = random.choice(entities)
        merchant = random.choice(merchants) if merchants else None

        if scenario["name"] == "ato_signal":
            et = random.choice(["password_reset", "email_change", "login_attempt"])
        elif scenario["name"] == "velocity_burst":
            et = "transaction"
        else:
            et = random.choices(event_types, weights=[60, 15, 5, 5, 5], k=1)[0]

        amount = round(random.uniform(*scenario["amount_range"]), 2) if et == "transaction" else 0
        country = random.choice(["NG", "RO", "BY", "UA"]) if scenario["risk_country"] else random.choice(countries[:6])

        event = Event(
            org_id=user.org_id,
            event_type=et,
            source="demo_simulation",
            entity_id=entity.id,
            data={
                "amount": amount,
                "currency": "USD",
                "country": country,
                "is_international": country != "US",
                "new_device": scenario["name"] == "new_device_high_amount" or random.random() > 0.85,
                "merchant": merchant.display_name if merchant else "Unknown",
                "ip": f"{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}",
                "scenario": scenario["name"],
            },
            occurred_at=datetime.utcnow()
        )
        db.add(event)
        await db.flush()

        alerts = await process_event(db, event)
        total_alerts += alerts
        created_events += 1

    await db.commit()
    await log_audit(db, user, "demo_simulate", "event", None, {"count": created_events, "alerts": total_alerts})

    return {
        "events_created": created_events,
        "alerts_created": total_alerts,
        "message": f"Simulated {created_events} events, generated {total_alerts} alerts"
    }
