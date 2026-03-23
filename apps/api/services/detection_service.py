"""
Detection Engine: Evaluates rules against events to produce alerts.
Includes rule-based engine and model score simulator.
"""
import hashlib
import math
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import Rule, Alert, Event, Entity, Transaction
import structlog

logger = structlog.get_logger()


async def process_event(db: AsyncSession, event: Event) -> int:
    """Run detection pipeline on a single event. Returns number of alerts created."""
    alerts_created = 0

    # Get enabled rules
    result = await db.execute(select(Rule).where(Rule.enabled == True))
    rules = result.scalars().all()

    for rule in rules:
        triggered = await evaluate_rule(db, rule, event)
        if triggered:
            alert = Alert(
                org_id=event.org_id,
                alert_type=rule.alert_type or "custom",
                severity=rule.severity,
                title=f"[{rule.name}] triggered on event {event.event_type}",
                description=f"Rule '{rule.name}' ({rule.rule_type}) detected suspicious activity.",
                entity_id=event.entity_id,
                event_id=event.id,
                rule_id=rule.id,
                model_score=compute_risk_score(event),
                data={
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type,
                    "event_data": event.data or {}
                }
            )
            db.add(alert)
            alerts_created += 1
            logger.info("alert_created", rule=rule.name, event_id=str(event.id))

    # Also run model score simulator
    score = compute_risk_score(event)
    if score > 0.75:
        alert = Alert(
            org_id=event.org_id,
            alert_type=classify_alert_type(event),
            severity="high" if score > 0.9 else "medium",
            title=f"High risk score ({score:.2f}) on {event.event_type}",
            description=f"Model score simulator flagged this event with score {score:.2f}",
            entity_id=event.entity_id,
            event_id=event.id,
            model_score=score,
            data={"model_score": score, "event_data": event.data or {}}
        )
        db.add(alert)
        alerts_created += 1

    # Persist the computed score for every event so users can inspect risk
    # even when the event does not create an alert.
    event.processed = True
    event.risk_score = score
    await db.commit()

    return alerts_created


async def evaluate_rule(db: AsyncSession, rule: Rule, event: Event) -> bool:
    """Evaluate a single rule against an event."""
    try:
        condition = rule.condition_json
        data = event.data or {}

        if rule.rule_type == "threshold":
            field = condition.get("field", "amount")
            operator = condition.get("operator", ">")
            threshold = condition.get("threshold", 0)
            value = data.get(field, 0)
            try:
                value = float(value)
            except (ValueError, TypeError):
                return False
            if operator == ">" and value > threshold:
                return True
            elif operator == ">=" and value >= threshold:
                return True
            elif operator == "<" and value < threshold:
                return True

        elif rule.rule_type == "velocity":
            entity_id = event.entity_id
            if not entity_id:
                return False
            window_hours = condition.get("window_hours", 1)
            max_count = condition.get("max_count", 5)
            since = datetime.utcnow() - timedelta(hours=window_hours)
            count = (await db.execute(
                select(func.count(Event.id)).where(
                    Event.entity_id == entity_id,
                    Event.occurred_at >= since
                )
            )).scalar() or 0
            return count >= max_count

        elif rule.rule_type == "blacklist":
            field = condition.get("field", "ip")
            blacklist = condition.get("values", [])
            value = data.get(field, "")
            return value in blacklist

        elif rule.rule_type == "pattern":
            # Pattern matching on data fields
            patterns = condition.get("patterns", {})
            for field, pattern in patterns.items():
                value = str(data.get(field, ""))
                if pattern.lower() in value.lower():
                    return True

        elif rule.rule_type == "composite":
            # All sub-conditions must match
            sub_rules = condition.get("rules", [])
            for sub in sub_rules:
                sub_rule = Rule(
                    rule_type=sub.get("type", "threshold"),
                    condition_json=sub.get("condition", {}),
                    severity=rule.severity,
                    alert_type=rule.alert_type,
                    enabled=True,
                    name=rule.name
                )
                if not await evaluate_rule(db, sub_rule, event):
                    return False
            return len(sub_rules) > 0

    except Exception as e:
        logger.error("rule_evaluation_error", rule=rule.name, error=str(e))
        return False

    return False


def evaluate_rule_sync(rule: Rule, event: Event) -> bool:
    """Synchronous rule evaluation for backtesting (no DB calls).
    Velocity rules are approximated by checking event data signals."""
    try:
        condition = rule.condition_json or {}
        data = event.data or {}

        if rule.rule_type == "threshold":
            field = condition.get("field", "amount")
            operator = condition.get("operator", ">")
            threshold = condition.get("threshold", 0)
            value = data.get(field, 0)
            try:
                value = float(value)
            except (ValueError, TypeError):
                return False
            if operator == ">" and value > threshold:
                return True
            elif operator == ">=" and value >= threshold:
                return True
            elif operator == "<" and value < threshold:
                return True

        elif rule.rule_type == "velocity":
            # For backtesting we approximate: flag events with high risk scores
            return (event.risk_score or 0) > 0.6

        elif rule.rule_type == "blacklist":
            field = condition.get("field", "ip")
            blacklist = condition.get("values", [])
            value = data.get(field, "")
            return value in blacklist

        elif rule.rule_type == "pattern":
            patterns = condition.get("patterns", {})
            for field, pattern in patterns.items():
                value = str(data.get(field, ""))
                if pattern.lower() in value.lower():
                    return True

        elif rule.rule_type == "composite":
            sub_rules = condition.get("rules", [])
            for sub in sub_rules:
                sub_rule_obj = type('MockRule', (), {
                    'rule_type': sub.get("type", "threshold"),
                    'condition_json': sub.get("condition", {}),
                    'name': rule.name
                })()
                mock_event = event
                if not evaluate_rule_sync(sub_rule_obj, mock_event):
                    return False
            return len(sub_rules) > 0

    except Exception:
        return False
    return False


def compute_risk_score(event: Event) -> float:
    """Deterministic heuristic risk score (0-1)."""
    score = 0.0
    data = event.data or {}

    # Amount-based risk
    amount = 0
    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        pass

    if amount > 5000:
        score += 0.3
    elif amount > 1000:
        score += 0.15
    elif amount > 500:
        score += 0.05

    # International transaction
    if data.get("is_international", False):
        score += 0.15

    # High-risk country
    high_risk_countries = ["NG", "RO", "BY", "UA", "CN"]
    if data.get("country", "") in high_risk_countries:
        score += 0.2

    # Velocity signals
    if data.get("velocity_flag", False):
        score += 0.2

    # Device signals
    if data.get("new_device", False):
        score += 0.1
    if data.get("device_mismatch", False):
        score += 0.15

    # Event type adjustments
    if event.event_type in ("password_reset", "email_change"):
        score += 0.1
    if event.event_type in ("card_added", "address_change"):
        score += 0.05

    # Ensure 0-1 range
    return min(max(score, 0.0), 1.0)


def classify_alert_type(event: Event) -> str:
    """Classify the alert type based on event characteristics."""
    data = event.data or {}
    event_type = event.event_type

    if event_type in ("login_attempt", "password_reset", "email_change", "phone_change"):
        return "account_takeover"
    if event_type in ("transaction", "payment") and float(data.get("amount", 0)) > 1000:
        return "payment_fraud"
    if event_type in ("promo_apply", "coupon_use", "referral"):
        return "promo_abuse"
    if data.get("is_bot", False) or data.get("automated", False):
        return "bot_attack"
    if event_type == "chargeback":
        return "chargeback_risk"
    return "payment_fraud"
