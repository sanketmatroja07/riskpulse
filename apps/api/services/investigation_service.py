"""
Investigation Service: Collects evidence, builds entity connections, gathers signals.
"""
from datetime import datetime, timedelta
from typing import List
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import (
    Case, Alert, Entity, EntityEdge, Event, Transaction, Evidence
)
from models.schemas import EvidenceResponse
import structlog

logger = structlog.get_logger()


async def collect_evidence(db: AsyncSession, case_id: UUID) -> List[EvidenceResponse]:
    """Gather all relevant signals for a case."""
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        return []

    evidence_items = []
    _org_id = case.org_id

    # 1. Collect alert details
    if case.alert_ids:
        alert_result = await db.execute(select(Alert).where(Alert.id.in_(case.alert_ids)))
        for alert in alert_result.scalars().all():
            ev = Evidence(
                org_id=_org_id,
                case_id=case_id,
                evidence_type="signal",
                title=f"Alert: {alert.title}",
                content=f"Type: {alert.alert_type}\nSeverity: {alert.severity}\nScore: {alert.model_score}\n{alert.description or ''}",
                source="alert_system",
                entity_id=alert.entity_id,
                event_id=alert.event_id,
                metadata_={"alert_id": str(alert.id), "alert_type": alert.alert_type, "severity": alert.severity}
            )
            db.add(ev)
            evidence_items.append(ev)

    # 2. Collect entity details and enrichment
    entity_ids = case.entity_ids or []
    for eid in entity_ids:
        ent_result = await db.execute(select(Entity).where(Entity.id == eid))
        entity = ent_result.scalar_one_or_none()
        if entity:
            # Entity profile
            ev = Evidence(
                org_id=_org_id,
                case_id=case_id,
                evidence_type="entity_link",
                title=f"Entity: {entity.display_name or entity.external_id} ({entity.entity_type})",
                content=f"Type: {entity.entity_type}\nExternal ID: {entity.external_id}\nRisk Score: {entity.risk_score}\nFirst Seen: {entity.first_seen_at}\nLast Seen: {entity.last_seen_at}",
                source="entity_store",
                entity_id=entity.id,
                metadata_={"entity_type": entity.entity_type, "risk_score": entity.risk_score}
            )
            db.add(ev)
            evidence_items.append(ev)

            # Mock enrichment data
            enrichment = generate_mock_enrichment(entity)
            if enrichment:
                ev_enrich = Evidence(
                    org_id=_org_id,
                    case_id=case_id,
                    evidence_type="enrichment",
                    title=f"Enrichment: {entity.entity_type} {entity.external_id}",
                    content=enrichment["content"],
                    source=enrichment["source"],
                    entity_id=entity.id,
                    metadata_=enrichment["metadata"]
                )
                db.add(ev_enrich)
                evidence_items.append(ev_enrich)

    # 3. Collect recent transactions
    if entity_ids:
        txn_result = await db.execute(
            select(Transaction).where(
                Transaction.user_entity_id.in_(entity_ids)
            ).order_by(Transaction.occurred_at.desc()).limit(20)
        )
        for txn in txn_result.scalars().all():
            ev = Evidence(
                org_id=_org_id,
                case_id=case_id,
                evidence_type="transaction",
                title=f"Transaction: {txn.transaction_ref} - ${txn.amount} {txn.currency}",
                content=f"Amount: ${txn.amount} {txn.currency}\nStatus: {txn.status}\nMerchant Category: {txn.merchant_category}\nCountry: {txn.country}\nCity: {txn.city}\nInternational: {txn.is_international}\nRisk Score: {txn.risk_score}",
                source="transaction_store",
                entity_id=txn.user_entity_id,
                metadata_={
                    "amount": float(txn.amount),
                    "currency": txn.currency,
                    "country": txn.country,
                    "risk_score": txn.risk_score
                }
            )
            db.add(ev)
            evidence_items.append(ev)

    # 4. Collect velocity stats
    for eid in entity_ids:
        velocity = await compute_velocity_stats(db, eid)
        if velocity:
            ev = Evidence(
                org_id=_org_id,
                case_id=case_id,
                evidence_type="signal",
                title=f"Velocity Analysis for entity {eid}",
                content=velocity["content"],
                source="velocity_engine",
                entity_id=eid,
                metadata_=velocity["stats"]
            )
            db.add(ev)
            evidence_items.append(ev)

    # 5. Connected entity analysis
    if entity_ids:
        edge_result = await db.execute(
            select(EntityEdge).where(
                EntityEdge.source_entity_id.in_(entity_ids) |
                EntityEdge.target_entity_id.in_(entity_ids)
            )
        )
        edges = edge_result.scalars().all()
        if edges:
            connections = []
            for e in edges:
                connections.append(f"{e.source_entity_id} --[{e.edge_type}]--> {e.target_entity_id}")
            ev = Evidence(
                org_id=_org_id,
                case_id=case_id,
                evidence_type="entity_link",
                title=f"Entity Graph Connections ({len(edges)} links)",
                content="\n".join(connections[:20]),
                source="graph_engine",
                metadata_={"edge_count": len(edges)}
            )
            db.add(ev)
            evidence_items.append(ev)

    await db.commit()

    # Refresh and return
    refreshed = []
    for ev in evidence_items:
        await db.refresh(ev)
        refreshed.append(EvidenceResponse.model_validate(ev))

    logger.info("evidence_collected", case_id=str(case_id), count=len(refreshed))
    return refreshed


def generate_mock_enrichment(entity) -> dict:
    """Generate mock enrichment data for demonstration."""
    import hashlib
    seed = hashlib.md5(str(entity.id).encode()).hexdigest()
    score_seed = int(seed[:4], 16) % 100

    if entity.entity_type == "ip":
        return {
            "source": "ip_geolocation",
            "content": f"IP: {entity.external_id}\nCountry: {'US' if score_seed > 30 else 'RO'}\nCity: {'New York' if score_seed > 30 else 'Bucharest'}\nISP: {'Comcast' if score_seed > 50 else 'VPN Provider'}\nProxy: {'No' if score_seed > 40 else 'Yes'}\nTor: {'No' if score_seed > 80 else 'Yes'}\nRisk Level: {'Low' if score_seed > 60 else 'High'}",
            "metadata": {
                "country": "US" if score_seed > 30 else "RO",
                "is_proxy": score_seed <= 40,
                "is_tor": score_seed <= 20,
                "risk_level": "low" if score_seed > 60 else "high"
            }
        }
    elif entity.entity_type == "device":
        return {
            "source": "device_fingerprint",
            "content": f"Device: {entity.external_id}\nOS: {'iOS 17' if score_seed > 50 else 'Android 14'}\nBrowser: {'Safari' if score_seed > 50 else 'Chrome'}\nScreen: 1920x1080\nTimezone: {'America/New_York' if score_seed > 40 else 'Europe/Bucharest'}\nLanguage: en-US\nEmulator: {'No' if score_seed > 20 else 'Yes'}",
            "metadata": {
                "os": "iOS 17" if score_seed > 50 else "Android 14",
                "is_emulator": score_seed <= 20,
                "timezone_mismatch": score_seed <= 40
            }
        }
    elif entity.entity_type == "email":
        return {
            "source": "email_risk",
            "content": f"Email: {entity.external_id}\nDomain Age: {score_seed + 100} days\nDisposable: {'No' if score_seed > 15 else 'Yes'}\nFree Provider: {'Yes' if score_seed < 70 else 'No'}\nBreached: {'No' if score_seed > 25 else 'Yes'}\nDeliverability: {'Valid' if score_seed > 10 else 'Invalid'}",
            "metadata": {
                "is_disposable": score_seed <= 15,
                "is_breached": score_seed <= 25,
                "domain_age_days": score_seed + 100
            }
        }
    return None


async def compute_velocity_stats(db: AsyncSession, entity_id: UUID) -> dict:
    """Compute velocity statistics for an entity."""
    now = datetime.utcnow()
    windows = {"1h": 1, "24h": 24, "7d": 168}
    stats = {}

    for label, hours in windows.items():
        since = now - timedelta(hours=hours)
        count = (await db.execute(
            select(func.count(Event.id)).where(
                Event.entity_id == entity_id,
                Event.occurred_at >= since
            )
        )).scalar() or 0
        stats[f"events_{label}"] = count

    # Transaction stats
    txn_count = (await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.user_entity_id == entity_id,
            Transaction.occurred_at >= now - timedelta(hours=24)
        )
    )).scalar() or 0

    txn_sum = (await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_entity_id == entity_id,
            Transaction.occurred_at >= now - timedelta(hours=24)
        )
    )).scalar() or 0

    stats["txn_count_24h"] = txn_count
    stats["txn_sum_24h"] = float(txn_sum)

    content_lines = [f"{k}: {v}" for k, v in stats.items()]
    return {
        "content": "\n".join(content_lines),
        "stats": stats
    }
