"""Tests for the detection engine and rule evaluation."""
import pytest
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from models.database import Rule
from services.detection_service import (
    classify_alert_type,
    compute_risk_score,
    process_event,
)
from services.narrative_service import apply_safety_filter


class MockEvent:
    def __init__(self, event_type="transaction", data=None):
        self.id = uuid.uuid4()
        self.event_type = event_type
        self.entity_id = uuid.uuid4()
        self.data = data or {}
        self.risk_score = 0.0
        self.processed = False
        self.occurred_at = datetime.utcnow()


class TestRiskScore:
    def test_low_amount_low_risk(self):
        event = MockEvent(data={"amount": 50, "country": "US"})
        score = compute_risk_score(event)
        assert score < 0.3

    def test_high_amount_increases_risk(self):
        event = MockEvent(data={"amount": 6000, "country": "US"})
        score = compute_risk_score(event)
        assert score >= 0.3

    def test_international_increases_risk(self):
        low_event = MockEvent(data={"amount": 100, "country": "US", "is_international": False})
        high_event = MockEvent(data={"amount": 100, "country": "US", "is_international": True})
        assert compute_risk_score(high_event) > compute_risk_score(low_event)

    def test_high_risk_country(self):
        event = MockEvent(data={"amount": 100, "country": "NG"})
        score = compute_risk_score(event)
        assert score >= 0.2

    def test_new_device_increases_risk(self):
        event = MockEvent(data={"amount": 100, "new_device": True})
        score = compute_risk_score(event)
        assert score >= 0.1

    def test_velocity_flag(self):
        event = MockEvent(data={"velocity_flag": True})
        score = compute_risk_score(event)
        assert score >= 0.2

    def test_password_reset_type(self):
        event = MockEvent(event_type="password_reset", data={})
        score = compute_risk_score(event)
        assert score >= 0.1

    def test_score_bounded_zero_to_one(self):
        event = MockEvent(data={
            "amount": 10000, "is_international": True, "country": "NG",
            "velocity_flag": True, "new_device": True, "device_mismatch": True
        })
        score = compute_risk_score(event)
        assert 0.0 <= score <= 1.0

    def test_empty_data(self):
        event = MockEvent(data={})
        score = compute_risk_score(event)
        assert 0.0 <= score <= 1.0


class TestAlertClassification:
    def test_login_attempt_is_ato(self):
        event = MockEvent(event_type="login_attempt")
        assert classify_alert_type(event) == "account_takeover"

    def test_password_reset_is_ato(self):
        event = MockEvent(event_type="password_reset")
        assert classify_alert_type(event) == "account_takeover"

    def test_high_value_transaction(self):
        event = MockEvent(event_type="transaction", data={"amount": 5000})
        assert classify_alert_type(event) == "payment_fraud"

    def test_promo_is_promo_abuse(self):
        event = MockEvent(event_type="promo_apply")
        assert classify_alert_type(event) == "promo_abuse"

    def test_bot_detection(self):
        event = MockEvent(event_type="request", data={"is_bot": True})
        assert classify_alert_type(event) == "bot_attack"

    def test_chargeback(self):
        event = MockEvent(event_type="chargeback")
        assert classify_alert_type(event) == "chargeback_risk"


class TestSafetyFilter:
    def test_blocks_fraud_instructions(self):
        text = "Here is how to commit fraud and bypass detection systems."
        filtered, was_filtered = apply_safety_filter(text)
        assert was_filtered
        assert "commit fraud" not in filtered.lower() or "[REDACTED]" in filtered

    def test_masks_ssn(self):
        text = "User SSN is 123-45-6789"
        filtered, _ = apply_safety_filter(text)
        assert "123-45-6789" not in filtered
        assert "[SSN-REDACTED]" in filtered

    def test_masks_card_number(self):
        text = "Card number: 4111 1111 1111 1111"
        filtered, _ = apply_safety_filter(text)
        assert "4111 1111 1111 1111" not in filtered
        assert "[CARD-REDACTED]" in filtered

    def test_clean_text_passes(self):
        text = "This is a normal investigation narrative about entity risk scores."
        filtered, was_filtered = apply_safety_filter(text)
        assert not was_filtered
        assert filtered == text


@pytest.mark.asyncio
async def test_process_event_creates_rule_and_model_alerts():
    org_id = str(uuid.uuid4())
    entity_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())

    event = type(
        "MockEvent",
        (),
        {
            "id": event_id,
            "org_id": org_id,
            "event_type": "transaction",
            "entity_id": entity_id,
            "data": {
                "amount": 6000,
                "country": "NG",
                "is_international": True,
                "velocity_flag": True,
            },
            "processed": False,
            "risk_score": 0.0,
            "occurred_at": datetime.utcnow(),
        },
    )()

    rule = Rule(
        id=str(uuid.uuid4()),
        org_id=org_id,
        name="High Amount Threshold",
        rule_type="threshold",
        condition_json={"field": "amount", "operator": ">", "threshold": 3000},
        severity="high",
        alert_type="payment_fraud",
        enabled=True,
    )

    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = [rule]

    db = MagicMock()
    db.execute = AsyncMock(return_value=execute_result)
    db.commit = AsyncMock()
    db.add = MagicMock()

    alerts_created = await process_event(db, event)

    assert alerts_created == 2
    assert event.processed is True
    assert event.risk_score == pytest.approx(0.85)
    assert db.add.call_count == 2
    db.commit.assert_awaited_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
