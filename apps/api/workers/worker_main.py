"""
Worker process: handles background jobs including detection, enrichment, and demo simulation.
"""
import asyncio
import json
import time
import signal
import sys
from datetime import datetime, timedelta
import structlog
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from models.database import SyncSessionLocal, Event, Alert, Entity, EntityEdge, Job, Metric, Notification, Case, User
from services.detection_service import compute_risk_score
from config import get_settings

settings = get_settings()
logger = structlog.get_logger()

# Redis is optional in local mode
redis_client = None
if settings.REDIS_URL:
    try:
        import redis
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        redis_client.ping()
    except Exception:
        redis_client = None
        logger.info("redis_not_available", msg="Running without Redis (local mode)")

running = True


def signal_handler(sig, frame):
    global running
    logger.info("worker_shutdown_signal")
    running = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def process_detection_job(db: Session, payload: dict):
    """Process a detection job from the queue."""
    event_id = payload.get("event_id")
    if not event_id:
        return

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or event.processed:
        return

    score = compute_risk_score(event)
    event.risk_score = score
    event.processed = True

    if score > 0.75:
        alert = Alert(
            alert_type="payment_fraud",
            severity="high" if score > 0.9 else "medium",
            title=f"High risk score ({score:.2f}) on {event.event_type}",
            description=f"Automated detection flagged event with score {score:.2f}",
            entity_id=event.entity_id,
            event_id=event.id,
            model_score=score,
            data={"model_score": score}
        )
        db.add(alert)
        logger.info("worker_alert_created", event_id=event_id, score=score)

    db.commit()


def process_enrichment_job(db: Session, payload: dict):
    """Enrich an entity with mock external data."""
    entity_id = payload.get("entity_id")
    if not entity_id:
        return

    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        return

    import hashlib
    seed = int(hashlib.md5(str(entity.id).encode()).hexdigest()[:4], 16) % 100

    if entity.entity_type == "ip":
        entity.metadata_ = {
            **(entity.metadata_ or {}),
            "geo": {"country": "US" if seed > 30 else "RO", "city": "New York" if seed > 30 else "Bucharest"},
            "is_proxy": seed <= 40,
            "is_tor": seed <= 20,
            "isp": "Comcast" if seed > 50 else "VPN Provider"
        }
    elif entity.entity_type == "device":
        entity.metadata_ = {
            **(entity.metadata_ or {}),
            "os": "iOS 17" if seed > 50 else "Android 14",
            "browser": "Safari" if seed > 50 else "Chrome",
            "is_emulator": seed <= 20,
            "screen": "1920x1080"
        }

    entity.updated_at = datetime.utcnow()
    db.commit()
    logger.info("entity_enriched", entity_id=entity_id, entity_type=entity.entity_type)


def record_metric(db: Session, name: str, value: float, labels: dict = None):
    """Record a system metric."""
    metric = Metric(
        metric_name=name,
        metric_value=value,
        labels=labels or {}
    )
    db.add(metric)
    db.commit()


def run_demo_simulation(db: Session):
    """Generate a simulated event for demo mode."""
    import random
    import uuid

    users = db.query(Entity).filter(Entity.entity_type == "user").limit(60).all()
    if not users:
        return

    user_entity = random.choice(users)

    event_types = ["transaction", "login_attempt", "password_reset", "card_added"]
    event_type = random.choice(event_types)

    data = {}
    if event_type == "transaction":
        data = {
            "amount": round(random.uniform(10, 5000), 2),
            "currency": "USD",
            "merchant": f"merchant_{random.randint(1, 30)}",
            "country": random.choice(["US", "US", "US", "GB", "CA", "RO", "NG"]),
            "is_international": random.random() > 0.7,
            "new_device": random.random() > 0.8
        }
    elif event_type == "login_attempt":
        data = {
            "success": random.random() > 0.2,
            "new_device": random.random() > 0.7,
            "country": random.choice(["US", "US", "GB", "RO"])
        }

    event = Event(
        event_type=event_type,
        source="demo_simulator",
        entity_id=user_entity.id,
        data=data,
        occurred_at=datetime.utcnow()
    )
    db.add(event)
    db.commit()

    logger.info("demo_event_generated", event_type=event_type, entity=str(user_entity.id))

    # Queue for detection (if Redis available)
    if redis_client:
        redis_client.rpush("jobs:detection", json.dumps({
            "event_id": str(event.id),
            "type": "detection"
        }))
    else:
        # Process inline in local mode
        process_detection_job(db, {"event_id": str(event.id)})


def main_loop():
    """Main worker loop."""
    logger.info("worker_started")
    demo_mode = True
    last_demo = time.time()
    last_metric = time.time()

    while running:
        db = SyncSessionLocal()
        try:
            # Process detection jobs from Redis queue (if available)
            if redis_client:
                job_data = redis_client.lpop("jobs:detection")
                if job_data:
                    payload = json.loads(job_data)
                    process_detection_job(db, payload)

                enrich_data = redis_client.lpop("jobs:enrichment")
                if enrich_data:
                    payload = json.loads(enrich_data)
                    process_enrichment_job(db, payload)

            # Demo simulation (every 30 seconds)
            if demo_mode and time.time() - last_demo > 30:
                run_demo_simulation(db)
                last_demo = time.time()

            # Record metrics (every 60 seconds)
            if time.time() - last_metric > 60:
                alert_count = db.query(Alert).filter(Alert.status == "new").count()
                record_metric(db, "open_alerts", float(alert_count))
                case_count = db.query(Case).filter(Case.status.in_(["new", "investigating"])).count()
                record_metric(db, "open_cases", float(case_count))
                last_metric = time.time()

        except Exception as e:
            logger.error("worker_error", error=str(e))
        finally:
            db.close()

        time.sleep(1)

    logger.info("worker_stopped")


if __name__ == "__main__":
    main_loop()
