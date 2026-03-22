-- RiskPulse Investigation Automation Platform
-- Database Schema v1

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst', 'engineer', 'readonly')),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- ENTITIES (user, device, ip, card, merchant, email)
-- ============================================================
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('user', 'device', 'ip', 'card', 'merchant', 'email')),
    external_id VARCHAR(500) NOT NULL,
    display_name VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    risk_score FLOAT DEFAULT 0.0,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, external_id)
);

CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_external_id ON entities(external_id);
CREATE INDEX idx_entities_risk_score ON entities(risk_score DESC);
CREATE INDEX idx_entities_metadata ON entities USING GIN(metadata);
CREATE INDEX idx_entities_display_name_trgm ON entities USING GIN(display_name gin_trgm_ops);

-- ============================================================
-- ENTITY EDGES (graph relationships)
-- ============================================================
CREATE TABLE entity_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    edge_type VARCHAR(100) NOT NULL,
    weight FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_entity_id, target_entity_id, edge_type)
);

CREATE INDEX idx_edges_source ON entity_edges(source_entity_id);
CREATE INDEX idx_edges_target ON entity_edges(target_entity_id);
CREATE INDEX idx_edges_type ON entity_edges(edge_type);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'internal',
    entity_id UUID REFERENCES entities(id),
    data JSONB DEFAULT '{}',
    risk_score FLOAT DEFAULT 0.0,
    processed BOOLEAN DEFAULT false,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_entity ON events(entity_id);
CREATE INDEX idx_events_occurred ON events(occurred_at DESC);
CREATE INDEX idx_events_processed ON events(processed);
CREATE INDEX idx_events_data ON events USING GIN(data);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id),
    transaction_ref VARCHAR(100) UNIQUE,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'declined', 'reversed', 'disputed')),
    merchant_entity_id UUID REFERENCES entities(id),
    user_entity_id UUID REFERENCES entities(id),
    card_entity_id UUID REFERENCES entities(id),
    ip_entity_id UUID REFERENCES entities(id),
    device_entity_id UUID REFERENCES entities(id),
    merchant_category VARCHAR(100),
    country VARCHAR(3),
    city VARCHAR(100),
    is_international BOOLEAN DEFAULT false,
    risk_score FLOAT DEFAULT 0.0,
    risk_signals JSONB DEFAULT '[]',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_txn_user ON transactions(user_entity_id);
CREATE INDEX idx_txn_merchant ON transactions(merchant_entity_id);
CREATE INDEX idx_txn_card ON transactions(card_entity_id);
CREATE INDEX idx_txn_ip ON transactions(ip_entity_id);
CREATE INDEX idx_txn_device ON transactions(device_entity_id);
CREATE INDEX idx_txn_occurred ON transactions(occurred_at DESC);
CREATE INDEX idx_txn_amount ON transactions(amount);
CREATE INDEX idx_txn_status ON transactions(status);
CREATE INDEX idx_txn_risk ON transactions(risk_score DESC);

-- ============================================================
-- RULES (detection rules)
-- ============================================================
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('threshold', 'velocity', 'blacklist', 'pattern', 'ml_score', 'composite')),
    condition_json JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    alert_type VARCHAR(100),
    enabled BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rules_enabled ON rules(enabled);
CREATE INDEX idx_rules_type ON rules(rule_type);

-- ============================================================
-- FEATURES (for detection/ml)
-- ============================================================
CREATE TABLE features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    feature_type VARCHAR(50) CHECK (feature_type IN ('count', 'velocity', 'ratio', 'flag', 'score', 'aggregation')),
    definition_json JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(100) NOT NULL CHECK (alert_type IN ('account_takeover', 'payment_fraud', 'promo_abuse', 'bot_attack', 'chargeback_risk', 'custom')),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    entity_id UUID REFERENCES entities(id),
    event_id UUID REFERENCES events(id),
    rule_id UUID REFERENCES rules(id),
    model_score FLOAT,
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'investigating', 'resolved', 'dismissed', 'escalated')),
    assigned_to UUID REFERENCES users(id),
    case_id UUID,
    data JSONB DEFAULT '{}',
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_entity ON alerts(entity_id);
CREATE INDEX idx_alerts_case ON alerts(case_id);
CREATE INDEX idx_alerts_assigned ON alerts(assigned_to);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- ============================================================
-- CASES
-- ============================================================
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'pending_review', 'escalated', 'resolved', 'closed')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    decision VARCHAR(50) CHECK (decision IN ('approve', 'deny', 'block', 'escalate', 'request_verification', NULL)),
    assigned_to UUID REFERENCES users(id),
    alert_ids UUID[] DEFAULT '{}',
    entity_ids UUID[] DEFAULT '{}',
    sla_deadline TIMESTAMPTZ,
    tags VARCHAR(100)[] DEFAULT '{}',
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alerts ADD CONSTRAINT fk_alert_case FOREIGN KEY (case_id) REFERENCES cases(id);

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_priority ON cases(priority);
CREATE INDEX idx_cases_assigned ON cases(assigned_to);
CREATE INDEX idx_cases_number ON cases(case_number);
CREATE INDEX idx_cases_created ON cases(created_at DESC);
CREATE INDEX idx_cases_sla ON cases(sla_deadline);

-- ============================================================
-- EVIDENCE
-- ============================================================
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) NOT NULL CHECK (evidence_type IN ('transaction', 'event', 'entity_link', 'enrichment', 'signal', 'document', 'note', 'external')),
    title VARCHAR(500) NOT NULL,
    content TEXT,
    source VARCHAR(100),
    entity_id UUID REFERENCES entities(id),
    event_id UUID REFERENCES events(id),
    metadata JSONB DEFAULT '{}',
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_case ON evidence(case_id);
CREATE INDEX idx_evidence_type ON evidence(evidence_type);
CREATE INDEX idx_evidence_entity ON evidence(entity_id);

-- ============================================================
-- NARRATIVES (AI-generated case summaries)
-- ============================================================
CREATE TABLE narratives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]',
    model_used VARCHAR(100),
    prompt_version VARCHAR(50),
    safety_filtered BOOLEAN DEFAULT false,
    generation_time_ms INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_narratives_case ON narratives(case_id);

-- ============================================================
-- CASE COMMENTS
-- ============================================================
CREATE TABLE case_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    mentions UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_case ON case_comments(case_id);

-- ============================================================
-- CASE DECISIONS
-- ============================================================
CREATE TABLE case_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    decision VARCHAR(50) NOT NULL CHECK (decision IN ('approve', 'deny', 'block', 'escalate', 'request_verification')),
    rationale TEXT,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_case ON case_decisions(case_id);

-- ============================================================
-- SUGGESTED MITIGATIONS
-- ============================================================
CREATE TABLE suggested_mitigations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id),
    mitigation_type VARCHAR(50) NOT NULL CHECK (mitigation_type IN ('rule', 'feature', 'pattern')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    config_json JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'deployed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mitigations_case ON suggested_mitigations(case_id);
CREATE INDEX idx_mitigations_status ON suggested_mitigations(status);

-- ============================================================
-- DEPLOYMENTS
-- ============================================================
CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_type VARCHAR(50) NOT NULL CHECK (deployment_type IN ('rule', 'feature', 'model', 'config')),
    artifact_id UUID NOT NULL,
    artifact_name VARCHAR(255),
    action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'enable', 'disable', 'rollback')),
    config_snapshot JSONB DEFAULT '{}',
    deployed_by UUID NOT NULL REFERENCES users(id),
    rollback_of UUID REFERENCES deployments(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deployments_type ON deployments(deployment_type);
CREATE INDEX idx_deployments_artifact ON deployments(artifact_id);
CREATE INDEX idx_deployments_created ON deployments(created_at DESC);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT false,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);

-- ============================================================
-- JOB QUEUE (for tracking async jobs)
-- ============================================================
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    payload JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    error TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(job_type);

-- ============================================================
-- PROMPT TEMPLATES (versioned)
-- ============================================================
CREATE TABLE prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    version INTEGER DEFAULT 1,
    template TEXT NOT NULL,
    variables VARCHAR(100)[] DEFAULT '{}',
    model_hint VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, version)
);

-- Insert default prompt templates
INSERT INTO prompt_templates (name, version, template, variables, model_hint, is_active) VALUES
('case_narrative', 1, E'You are a fraud investigation analyst. Generate a detailed investigation narrative for the following case.\n\n## Case Information\nCase: {case_title}\nPriority: {priority}\nAlert Type: {alert_type}\n\n## Evidence Summary\n{evidence_summary}\n\n## Entity Connections\n{entity_graph}\n\n## Transaction History\n{transaction_history}\n\n## Instructions\n1. Summarize the suspicious activity pattern\n2. Highlight key risk indicators\n3. Reference specific evidence items by their IDs (e.g., [EVD-001])\n4. Provide a risk assessment (Low/Medium/High/Critical)\n5. Suggest next investigation steps\n6. Do NOT include any PII in the narrative\n7. Do NOT provide instructions for fraud or evasion\n\nGenerate the narrative now:', ARRAY['case_title', 'priority', 'alert_type', 'evidence_summary', 'entity_graph', 'transaction_history'], 'gpt-4', true),
('suggest_rules', 1, E'Based on the following investigation findings, suggest detection rules that could catch similar fraud patterns.\n\n## Investigation Summary\n{narrative}\n\n## Entities Involved\n{entities}\n\n## Pattern Details\n{patterns}\n\n## Instructions\n1. Suggest 2-3 specific detection rules\n2. For each rule provide: name, type (threshold/velocity/blacklist/pattern), conditions in JSON\n3. Estimate expected false positive rate\n4. Reference the evidence that supports each rule\n5. Do NOT suggest rules that would enable fraud\n\nSuggest rules:', ARRAY['narrative', 'entities', 'patterns'], 'gpt-4', true),
('suggest_features', 1, E'Based on the following investigation, suggest features that could improve fraud detection.\n\n## Investigation Summary\n{narrative}\n\n## Current Features\n{current_features}\n\n## Instructions\n1. Suggest 2-3 new features\n2. For each: name, type, computation logic, expected discriminative power\n3. These are defensive features for fraud DETECTION only\n\nSuggest features:', ARRAY['narrative', 'current_features'], 'gpt-4', true);

-- ============================================================
-- METRICS (for observability)
-- ============================================================
CREATE TABLE metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_value FLOAT NOT NULL,
    labels JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metrics_name ON metrics(metric_name);
CREATE INDEX idx_metrics_recorded ON metrics(recorded_at DESC);
