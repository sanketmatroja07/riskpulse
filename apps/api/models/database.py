import uuid
import json
import secrets
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Boolean, Integer, Text, DateTime,
    ForeignKey, Numeric, BigInteger, UniqueConstraint, Index, event
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.types import TypeDecorator, TEXT
from config import get_settings

Base = declarative_base()
settings = get_settings()

# ── Portable column types (work with both SQLite and PostgreSQL) ──

class JSONType(TypeDecorator):
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return None


class UUIDType(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            return str(value)
        return value


class ArrayType(TypeDecorator):
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps([str(v) for v in value])
        return '[]'

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return []


# ── Engine setup ──

_is_sqlite = settings.is_sqlite

if _is_sqlite:
    async_engine = create_async_engine(settings.DATABASE_URL, echo=False)
    sync_engine = create_engine(settings.DATABASE_URL_SYNC)
else:
    async_engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=20, max_overflow=10)
    sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_size=5)

AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
SyncSessionLocal = sessionmaker(bind=sync_engine)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def get_sync_db():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


async def init_db():
    """Create all tables (for local dev / SQLite mode)."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def _uid():
    return str(uuid.uuid4())


def _generate_api_key():
    return f"rp_live_{secrets.token_urlsafe(32)}"


# ══════════════════════════════════════════════════════════════════
#  MULTI-TENANCY: Organization
# ══════════════════════════════════════════════════════════════════

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUIDType, primary_key=True, default=_uid)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    plan = Column(String(50), default="starter")  # starter, pro, enterprise
    stripe_customer_id = Column(String(255))
    stripe_subscription_id = Column(String(255))
    event_quota = Column(Integer, default=10000)  # monthly event limit
    events_used = Column(Integer, default=0)
    events_reset_at = Column(DateTime)
    max_members = Column(Integer, default=3)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), default="Default")
    key_hash = Column(String(255), nullable=False)     # SHA-256 hash of the key
    key_prefix = Column(String(20), nullable=False)     # first 12 chars for display: rp_live_xxxx
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index("ix_api_keys_key_hash", "key_hash"),)


# ══════════════════════════════════════════════════════════════════
#  CORE MODELS (all have org_id for multi-tenancy)
# ══════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="analyst")
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Entity(Base):
    __tablename__ = "entities"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    entity_type = Column(String(50), nullable=False)
    external_id = Column(String(500), nullable=False)
    display_name = Column(String(500))
    metadata_ = Column("metadata", JSONType, default={})
    risk_score = Column(Float, default=0.0)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("org_id", "entity_type", "external_id"),
        Index("ix_entities_org", "org_id"),
    )


class EntityEdge(Base):
    __tablename__ = "entity_edges"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    source_entity_id = Column(UUIDType, ForeignKey("entities.id"), nullable=False)
    target_entity_id = Column(UUIDType, ForeignKey("entities.id"), nullable=False)
    edge_type = Column(String(100), nullable=False)
    weight = Column(Float, default=1.0)
    metadata_ = Column("metadata", JSONType, default={})
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("source_entity_id", "target_entity_id", "edge_type"),
        Index("ix_entity_edges_org", "org_id"),
    )


class Event(Base):
    __tablename__ = "events"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    event_type = Column(String(100), nullable=False)
    source = Column(String(100), default="internal")
    entity_id = Column(UUIDType, ForeignKey("entities.id"))
    data = Column(JSONType, default={})
    risk_score = Column(Float, default=0.0)
    processed = Column(Boolean, default=False)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    ingested_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index("ix_events_org", "org_id"),)


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    event_id = Column(UUIDType, ForeignKey("events.id"))
    transaction_ref = Column(String(100), unique=True)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(String(50), default="completed")
    merchant_entity_id = Column(UUIDType, ForeignKey("entities.id"))
    user_entity_id = Column(UUIDType, ForeignKey("entities.id"))
    card_entity_id = Column(UUIDType, ForeignKey("entities.id"))
    ip_entity_id = Column(UUIDType, ForeignKey("entities.id"))
    device_entity_id = Column(UUIDType, ForeignKey("entities.id"))
    merchant_category = Column(String(100))
    country = Column(String(3))
    city = Column(String(100))
    is_international = Column(Boolean, default=False)
    risk_score = Column(Float, default=0.0)
    risk_signals = Column(JSONType, default=[])
    occurred_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class Rule(Base):
    __tablename__ = "rules"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    rule_type = Column(String(50), nullable=False)
    condition_json = Column(JSONType, nullable=False)
    severity = Column(String(20), default="medium")
    alert_type = Column(String(100))
    enabled = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_by = Column(UUIDType, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index("ix_rules_org", "org_id"),)


class Feature(Base):
    __tablename__ = "features"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    feature_type = Column(String(50))
    definition_json = Column(JSONType, nullable=False)
    enabled = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_by = Column(UUIDType, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("org_id", "name"),
        Index("ix_features_org", "org_id"),
    )


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    alert_type = Column(String(100), nullable=False)
    severity = Column(String(20), default="medium")
    title = Column(String(500), nullable=False)
    description = Column(Text)
    entity_id = Column(UUIDType, ForeignKey("entities.id"))
    event_id = Column(UUIDType, ForeignKey("events.id"))
    rule_id = Column(UUIDType, ForeignKey("rules.id"))
    model_score = Column(Float)
    status = Column(String(50), default="new")
    assigned_to = Column(UUIDType, ForeignKey("users.id"))
    case_id = Column(UUIDType, ForeignKey("cases.id"))
    data = Column(JSONType, default={})
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index("ix_alerts_org", "org_id"),)


class Case(Base):
    __tablename__ = "cases"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    case_number = Column(String(20), unique=True, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="new")
    priority = Column(String(20), default="medium")
    decision = Column(String(50))
    assigned_to = Column(UUIDType, ForeignKey("users.id"))
    alert_ids = Column(ArrayType, default=[])
    entity_ids = Column(ArrayType, default=[])
    sla_deadline = Column(DateTime)
    tags = Column(ArrayType, default=[])
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index("ix_cases_org", "org_id"),)


class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    case_id = Column(UUIDType, ForeignKey("cases.id"), nullable=False)
    evidence_type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    content = Column(Text)
    source = Column(String(100))
    entity_id = Column(UUIDType, ForeignKey("entities.id"))
    event_id = Column(UUIDType, ForeignKey("events.id"))
    metadata_ = Column("metadata", JSONType, default={})
    collected_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class Narrative(Base):
    __tablename__ = "narratives"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    case_id = Column(UUIDType, ForeignKey("cases.id"), nullable=False)
    content = Column(Text, nullable=False)
    citations = Column(JSONType, default=[])
    model_used = Column(String(100))
    prompt_version = Column(String(50))
    safety_filtered = Column(Boolean, default=False)
    generation_time_ms = Column(Integer)
    created_by = Column(UUIDType, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class CaseComment(Base):
    __tablename__ = "case_comments"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    case_id = Column(UUIDType, ForeignKey("cases.id"), nullable=False)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    mentions = Column(ArrayType, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class CaseDecision(Base):
    __tablename__ = "case_decisions"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    case_id = Column(UUIDType, ForeignKey("cases.id"), nullable=False)
    decision = Column(String(50), nullable=False)
    rationale = Column(Text)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SuggestedMitigation(Base):
    __tablename__ = "suggested_mitigations"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    case_id = Column(UUIDType, ForeignKey("cases.id"), nullable=False)
    mitigation_type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    config_json = Column(JSONType, nullable=False)
    status = Column(String(50), default="suggested")
    created_at = Column(DateTime, default=datetime.utcnow)


class Deployment(Base):
    __tablename__ = "deployments"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    deployment_type = Column(String(50), nullable=False)
    artifact_id = Column(UUIDType, nullable=False)
    artifact_name = Column(String(255))
    action = Column(String(50), nullable=False)
    config_snapshot = Column(JSONType, default={})
    deployed_by = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    rollback_of = Column(UUIDType, ForeignKey("deployments.id"))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    user_id = Column(UUIDType, ForeignKey("users.id"))
    user_email = Column(String(255))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(255))
    details = Column(JSONType, default={})
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    notification_type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    message = Column(Text)
    read = Column(Boolean, default=False)
    data = Column(JSONType, default={})
    created_at = Column(DateTime, default=datetime.utcnow)


class Job(Base):
    __tablename__ = "jobs"
    id = Column(UUIDType, primary_key=True, default=_uid)
    org_id = Column(UUIDType, ForeignKey("organizations.id"))
    job_type = Column(String(100), nullable=False)
    status = Column(String(50), default="pending")
    payload = Column(JSONType, default={})
    result = Column(JSONType, default={})
    error = Column(Text)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"
    id = Column(UUIDType, primary_key=True, default=_uid)
    name = Column(String(255), nullable=False)
    version = Column(Integer, default=1)
    template = Column(Text, nullable=False)
    variables = Column(ArrayType, default=[])
    model_hint = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Metric(Base):
    __tablename__ = "metrics"
    id = Column(Integer, primary_key=True, autoincrement=True)
    metric_name = Column(String(255), nullable=False)
    metric_value = Column(Float, nullable=False)
    labels = Column(JSONType, default={})
    recorded_at = Column(DateTime, default=datetime.utcnow)
