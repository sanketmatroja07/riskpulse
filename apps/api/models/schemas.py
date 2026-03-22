from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID
from enum import Enum


# ============================================================
# ENUMS
# ============================================================
class UserRole(str, Enum):
    admin = "admin"
    analyst = "analyst"
    engineer = "engineer"
    readonly = "readonly"


class AlertType(str, Enum):
    account_takeover = "account_takeover"
    payment_fraud = "payment_fraud"
    promo_abuse = "promo_abuse"
    bot_attack = "bot_attack"
    chargeback_risk = "chargeback_risk"
    custom = "custom"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AlertStatus(str, Enum):
    new = "new"
    acknowledged = "acknowledged"
    investigating = "investigating"
    resolved = "resolved"
    dismissed = "dismissed"
    escalated = "escalated"


class CaseStatus(str, Enum):
    new = "new"
    investigating = "investigating"
    pending_review = "pending_review"
    escalated = "escalated"
    resolved = "resolved"
    closed = "closed"


class CaseDecisionType(str, Enum):
    approve = "approve"
    deny = "deny"
    block = "block"
    escalate = "escalate"
    request_verification = "request_verification"


class EntityType(str, Enum):
    user = "user"
    device = "device"
    ip = "ip"
    card = "card"
    merchant = "merchant"
    email = "email"


# ============================================================
# ORGANIZATION (multi-tenancy)
# ============================================================
class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    event_quota: int
    events_used: int
    max_members: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationUpdateRequest(BaseModel):
    name: Optional[str] = None


# ============================================================
# AUTH
# ============================================================
class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    company_name: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"
    org: Optional[OrganizationResponse] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    is_active: bool
    org_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# API KEYS
# ============================================================
class ApiKeyCreateRequest(BaseModel):
    name: str = "Default"


class ApiKeyResponse(BaseModel):
    id: UUID
    name: str
    key_prefix: str
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApiKeyCreatedResponse(BaseModel):
    """Returned only on creation -- includes the full key (shown once)."""
    id: UUID
    name: str
    key: str  # full key, shown only once
    key_prefix: str
    created_at: datetime


# ============================================================
# ENTITIES
# ============================================================
class EntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    entity_type: str
    external_id: str
    display_name: Optional[str] = None
    metadata: Dict[str, Any] = Field(default={}, validation_alias="metadata_")
    risk_score: float = 0.0
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    created_at: datetime


class EntityGraphNode(BaseModel):
    id: str
    entity_type: str
    external_id: str
    display_name: Optional[str] = None
    risk_score: float = 0.0


class EntityGraphEdge(BaseModel):
    source: str
    target: str
    edge_type: str
    weight: float = 1.0


class EntityGraphResponse(BaseModel):
    nodes: List[EntityGraphNode]
    edges: List[EntityGraphEdge]


# ============================================================
# EVENTS
# ============================================================
class EventResponse(BaseModel):
    id: UUID
    event_type: str
    source: str
    entity_id: Optional[UUID] = None
    data: Dict[str, Any] = {}
    risk_score: float = 0.0
    occurred_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class IngestEventRequest(BaseModel):
    event_type: str
    source: str = "webhook"
    entity_type: Optional[str] = None
    entity_external_id: Optional[str] = None
    data: Dict[str, Any] = {}
    occurred_at: Optional[datetime] = None


# ============================================================
# TRANSACTIONS
# ============================================================
class TransactionResponse(BaseModel):
    id: UUID
    transaction_ref: Optional[str] = None
    amount: float
    currency: str = "USD"
    status: str
    merchant_entity_id: Optional[UUID] = None
    user_entity_id: Optional[UUID] = None
    card_entity_id: Optional[UUID] = None
    ip_entity_id: Optional[UUID] = None
    device_entity_id: Optional[UUID] = None
    merchant_category: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    is_international: bool = False
    risk_score: float = 0.0
    risk_signals: List[Any] = []
    occurred_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# ALERTS
# ============================================================
class AlertResponse(BaseModel):
    id: UUID
    alert_type: str
    severity: str
    title: str
    description: Optional[str] = None
    entity_id: Optional[UUID] = None
    event_id: Optional[UUID] = None
    rule_id: Optional[UUID] = None
    model_score: Optional[float] = None
    status: str
    assigned_to: Optional[UUID] = None
    case_id: Optional[UUID] = None
    data: Dict[str, Any] = {}
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertUpdateRequest(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[UUID] = None
    severity: Optional[str] = None


class BulkAlertAction(BaseModel):
    alert_ids: List[UUID]
    action: str  # acknowledge, dismiss, escalate
    assigned_to: Optional[UUID] = None


# ============================================================
# CASES
# ============================================================
class CaseCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    alert_ids: List[UUID] = []
    assigned_to: Optional[UUID] = None
    tags: List[str] = []


class CaseResponse(BaseModel):
    id: UUID
    case_number: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    decision: Optional[str] = None
    assigned_to: Optional[UUID] = None
    alert_ids: List[UUID] = []
    entity_ids: List[UUID] = []
    sla_deadline: Optional[datetime] = None
    tags: List[str] = []
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CaseUpdateRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[UUID] = None
    tags: Optional[List[str]] = None


class CaseDecisionRequest(BaseModel):
    decision: str
    rationale: str


# ============================================================
# EVIDENCE
# ============================================================
class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    case_id: UUID
    evidence_type: str
    title: str
    content: Optional[str] = None
    source: Optional[str] = None
    entity_id: Optional[UUID] = None
    event_id: Optional[UUID] = None
    metadata: Dict[str, Any] = Field(default={}, validation_alias="metadata_")
    collected_at: Optional[datetime] = None
    created_at: datetime


# ============================================================
# NARRATIVES
# ============================================================
class NarrativeResponse(BaseModel):
    id: UUID
    case_id: UUID
    content: str
    citations: List[Dict[str, Any]] = []
    model_used: Optional[str] = None
    prompt_version: Optional[str] = None
    generation_time_ms: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# COMMENTS
# ============================================================
class CommentCreateRequest(BaseModel):
    content: str
    mentions: List[UUID] = []


class CommentResponse(BaseModel):
    id: UUID
    case_id: UUID
    user_id: UUID
    content: str
    mentions: List[UUID] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# RULES
# ============================================================
class RuleResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    rule_type: str
    condition_json: Dict[str, Any]
    severity: str
    alert_type: Optional[str] = None
    enabled: bool
    version: int
    created_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RuleCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    rule_type: str
    condition_json: Dict[str, Any]
    severity: str = "medium"
    alert_type: Optional[str] = None
    enabled: bool = True


class RuleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition_json: Optional[Dict[str, Any]] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None


# ============================================================
# FEATURES
# ============================================================
class FeatureResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    feature_type: Optional[str] = None
    definition_json: Dict[str, Any]
    enabled: bool
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class FeatureCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    feature_type: Optional[str] = None
    definition_json: Dict[str, Any]
    enabled: bool = True


# ============================================================
# MITIGATIONS
# ============================================================
class MitigationResponse(BaseModel):
    id: UUID
    case_id: UUID
    mitigation_type: str
    title: str
    description: Optional[str] = None
    config_json: Dict[str, Any]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# DEPLOYMENTS
# ============================================================
class DeploymentResponse(BaseModel):
    id: UUID
    deployment_type: str
    artifact_id: UUID
    artifact_name: Optional[str] = None
    action: str
    config_snapshot: Dict[str, Any] = {}
    deployed_by: UUID
    rollback_of: Optional[UUID] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeployRequest(BaseModel):
    notes: Optional[str] = None


# ============================================================
# AUDIT
# ============================================================
class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# NOTIFICATIONS
# ============================================================
class NotificationResponse(BaseModel):
    id: UUID
    notification_type: str
    title: str
    message: Optional[str] = None
    read: bool
    data: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# DASHBOARD
# ============================================================
class DashboardStats(BaseModel):
    total_alerts: int = 0
    open_alerts: int = 0
    total_cases: int = 0
    open_cases: int = 0
    resolved_today: int = 0
    avg_resolution_hours: float = 0.0
    critical_alerts: int = 0
    sla_breaches: int = 0
    alerts_by_type: Dict[str, int] = {}
    alerts_by_severity: Dict[str, int] = {}
    cases_by_status: Dict[str, int] = {}
    recent_activity: List[Dict[str, Any]] = []
    alert_trend: List[Dict[str, Any]] = []
    detection_rate: float = 0.0


# ============================================================
# SEARCH
# ============================================================
class SearchResult(BaseModel):
    type: str  # entity, case, alert
    id: UUID
    title: str
    subtitle: Optional[str] = None
    score: float = 0.0


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int


# ============================================================
# METRICS / OBSERVABILITY
# ============================================================
class MetricsResponse(BaseModel):
    jobs_pending: int = 0
    jobs_running: int = 0
    jobs_failed: int = 0
    events_processed_24h: int = 0
    alerts_generated_24h: int = 0
    avg_processing_time_ms: float = 0.0
    system_health: str = "healthy"
    recent_errors: List[Dict[str, Any]] = []


# ============================================================
# BILLING
# ============================================================
class BillingPlanResponse(BaseModel):
    plan: str
    event_quota: int
    events_used: int
    max_members: int
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None


class UpgradePlanRequest(BaseModel):
    plan: str  # "starter", "pro", "enterprise"


# Resolve forward reference
LoginResponse.model_rebuild()
