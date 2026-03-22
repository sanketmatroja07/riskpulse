"""
Mitigation Service: Generates suggested rules, features, and patterns from case findings.
"""
from typing import List
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import (
    Case, Alert, Evidence, Entity, EntityEdge, Transaction,
    SuggestedMitigation, Narrative
)
from models.schemas import MitigationResponse
import structlog
import hashlib

logger = structlog.get_logger()


async def suggest_mitigations(db: AsyncSession, case_id: UUID) -> List[MitigationResponse]:
    """Generate mitigation suggestions from a case."""
    # Get case
    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        return []

    # Get alerts
    alerts = []
    if case.alert_ids:
        alert_result = await db.execute(select(Alert).where(Alert.id.in_(case.alert_ids)))
        alerts = alert_result.scalars().all()

    # Get evidence
    evidence_result = await db.execute(select(Evidence).where(Evidence.case_id == case_id))
    evidence_items = evidence_result.scalars().all()

    # Get entities
    entities = []
    if case.entity_ids:
        ent_result = await db.execute(select(Entity).where(Entity.id.in_(case.entity_ids)))
        entities = ent_result.scalars().all()

    mitigations = []
    _org_id = case.org_id

    # 1. Suggest rules based on alert type
    for alert in alerts:
        rule_suggestions = _suggest_rules_for_alert(alert, entities, evidence_items)
        for suggestion in rule_suggestions:
            existing = await db.execute(
                select(SuggestedMitigation).where(
                    SuggestedMitigation.case_id == case_id,
                    SuggestedMitigation.title == suggestion["title"]
                )
            )
            if existing.scalar_one_or_none():
                continue

            mit = SuggestedMitigation(
                org_id=_org_id,
                case_id=case_id,
                mitigation_type="rule",
                title=suggestion["title"],
                description=suggestion["description"],
                config_json=suggestion["config"],
                status="suggested"
            )
            db.add(mit)
            mitigations.append(mit)

    # 2. Suggest features
    feature_suggestions = _suggest_features(alerts, entities, evidence_items)
    for suggestion in feature_suggestions:
        existing = await db.execute(
            select(SuggestedMitigation).where(
                SuggestedMitigation.case_id == case_id,
                SuggestedMitigation.title == suggestion["title"]
            )
        )
        if existing.scalar_one_or_none():
            continue

        mit = SuggestedMitigation(
            org_id=_org_id,
            case_id=case_id,
            mitigation_type="feature",
            title=suggestion["title"],
            description=suggestion["description"],
            config_json=suggestion["config"],
            status="suggested"
        )
        db.add(mit)
        mitigations.append(mit)

    # 3. Suggest patterns
    pattern_suggestions = _suggest_patterns(alerts, entities, evidence_items)
    for suggestion in pattern_suggestions:
        existing = await db.execute(
            select(SuggestedMitigation).where(
                SuggestedMitigation.case_id == case_id,
                SuggestedMitigation.title == suggestion["title"]
            )
        )
        if existing.scalar_one_or_none():
            continue

        mit = SuggestedMitigation(
            org_id=_org_id,
            case_id=case_id,
            mitigation_type="pattern",
            title=suggestion["title"],
            description=suggestion["description"],
            config_json=suggestion["config"],
            status="suggested"
        )
        db.add(mit)
        mitigations.append(mit)

    await db.commit()

    result = []
    for m in mitigations:
        await db.refresh(m)
        result.append(MitigationResponse.model_validate(m))

    logger.info("mitigations_suggested", case_id=str(case_id), count=len(result))
    return result


def _suggest_rules_for_alert(alert, entities, evidence_items) -> list:
    """Generate rule suggestions based on alert characteristics."""
    suggestions = []

    if alert.alert_type == "account_takeover":
        # IP-based rule
        ip_entities = [e for e in entities if e.entity_type == "ip"]
        if ip_entities:
            suggestions.append({
                "title": f"Block suspicious IP cluster from ATO case",
                "description": f"Velocity rule: block logins from IPs associated with account takeover attempt",
                "config": {
                    "rule_type": "velocity",
                    "alert_type": "account_takeover",
                    "severity": "high",
                    "condition": {
                        "field": "ip",
                        "window_hours": 1,
                        "max_count": 3,
                        "action": "block",
                        "ip_list": [e.external_id for e in ip_entities[:5]]
                    }
                }
            })

        # Device-based rule
        device_entities = [e for e in entities if e.entity_type == "device"]
        if device_entities:
            suggestions.append({
                "title": f"Flag new device logins for ATO pattern",
                "description": "Pattern rule: flag logins from new devices associated with credential changes",
                "config": {
                    "rule_type": "pattern",
                    "alert_type": "account_takeover",
                    "severity": "medium",
                    "condition": {
                        "patterns": {
                            "event_sequence": ["password_reset", "login", "address_change"],
                            "window_minutes": 30,
                            "new_device": True
                        }
                    }
                }
            })

    elif alert.alert_type == "payment_fraud":
        suggestions.append({
            "title": "High-value transaction velocity rule",
            "description": "Threshold rule: flag transactions exceeding velocity threshold",
            "config": {
                "rule_type": "velocity",
                "alert_type": "payment_fraud",
                "severity": "high",
                "condition": {
                    "field": "amount",
                    "window_hours": 24,
                    "max_count": 5,
                    "threshold": 1000,
                    "action": "review"
                }
            }
        })
        suggestions.append({
            "title": "Cross-border transaction threshold",
            "description": "Threshold rule: flag international transactions above threshold",
            "config": {
                "rule_type": "threshold",
                "alert_type": "payment_fraud",
                "severity": "medium",
                "condition": {
                    "field": "amount",
                    "operator": ">",
                    "threshold": 2000,
                    "additional": {"is_international": True}
                }
            }
        })

    elif alert.alert_type == "promo_abuse":
        suggestions.append({
            "title": "Device reuse promo abuse rule",
            "description": "Pattern rule: flag multiple accounts sharing device fingerprint using promotions",
            "config": {
                "rule_type": "pattern",
                "alert_type": "promo_abuse",
                "severity": "medium",
                "condition": {
                    "patterns": {
                        "shared_device_accounts": {"min_count": 3},
                        "promo_usage": {"window_days": 7}
                    }
                }
            }
        })

    elif alert.alert_type == "bot_attack":
        suggestions.append({
            "title": "Bot velocity detection rule",
            "description": "Velocity rule: flag IPs with excessive request rates",
            "config": {
                "rule_type": "velocity",
                "alert_type": "bot_attack",
                "severity": "high",
                "condition": {
                    "field": "requests",
                    "window_hours": 1,
                    "max_count": 100,
                    "action": "block"
                }
            }
        })

    return suggestions


def _suggest_features(alerts, entities, evidence_items) -> list:
    """Generate feature suggestions."""
    suggestions = []

    # Device reuse count
    device_entities = [e for e in entities if e.entity_type == "device"]
    if device_entities:
        suggestions.append({
            "title": "Device reuse count feature",
            "description": "Count of unique accounts associated with same device fingerprint in rolling 30-day window",
            "config": {
                "feature_type": "count",
                "name": "device_reuse_count_30d",
                "definition": {
                    "entity_type": "device",
                    "aggregation": "count_distinct",
                    "target": "user",
                    "window_days": 30
                }
            }
        })

    # IP-based features
    ip_entities = [e for e in entities if e.entity_type == "ip"]
    if ip_entities:
        suggestions.append({
            "title": "IP geo-distance feature",
            "description": "Maximum geographic distance between consecutive transactions from same user",
            "config": {
                "feature_type": "score",
                "name": "max_geo_distance_24h",
                "definition": {
                    "entity_type": "user",
                    "computation": "max_haversine_distance",
                    "field": "ip_geolocation",
                    "window_hours": 24
                }
            }
        })

    # Transaction velocity feature
    suggestions.append({
        "title": "Transaction amount deviation feature",
        "description": "Standard deviation of transaction amounts vs 90-day baseline",
        "config": {
            "feature_type": "score",
            "name": "txn_amount_stddev_ratio",
            "definition": {
                "entity_type": "user",
                "computation": "stddev_ratio",
                "field": "amount",
                "baseline_days": 90,
                "current_window_hours": 24
            }
        }
    })

    return suggestions


def _suggest_patterns(alerts, entities, evidence_items) -> list:
    """Generate pattern suggestions."""
    suggestions = []

    for alert in alerts:
        if alert.alert_type == "payment_fraud":
            # Extract patterns from evidence
            merchant_cats = set()
            countries = set()
            for ev in evidence_items:
                meta = ev.metadata_ or {}
                if "country" in meta:
                    countries.add(meta["country"])

            suggestions.append({
                "title": "Merchant + Country combination pattern",
                "description": "Track this specific combination of merchant categories and countries for elevated monitoring",
                "config": {
                    "pattern_type": "combination",
                    "fields": ["merchant_category", "country"],
                    "observed_values": {
                        "countries": list(countries)[:5],
                    },
                    "monitoring_level": "elevated",
                    "expiry_days": 30
                }
            })

    if not suggestions:
        suggestions.append({
            "title": "Entity cluster monitoring pattern",
            "description": "Monitor the identified entity cluster for similar activity patterns",
            "config": {
                "pattern_type": "cluster",
                "entity_ids": [str(e.id) for e in entities[:5]],
                "monitoring_level": "elevated",
                "expiry_days": 14
            }
        })

    return suggestions
