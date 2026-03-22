// RiskPulse Shared Types

export type UserRole = 'admin' | 'analyst' | 'engineer' | 'readonly';

export type AlertType = 'account_takeover' | 'payment_fraud' | 'promo_abuse' | 'bot_attack' | 'chargeback_risk' | 'custom';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type AlertStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed' | 'escalated';

export type CaseStatus = 'new' | 'investigating' | 'pending_review' | 'escalated' | 'resolved' | 'closed';

export type CaseDecision = 'approve' | 'deny' | 'block' | 'escalate' | 'request_verification';

export type EntityType = 'user' | 'device' | 'ip' | 'card' | 'merchant' | 'email';

export type RuleType = 'threshold' | 'velocity' | 'blacklist' | 'pattern' | 'ml_score' | 'composite';

export type FeatureType = 'count' | 'velocity' | 'ratio' | 'flag' | 'score' | 'aggregation';

export type MitigationType = 'rule' | 'feature' | 'pattern';

export type DeploymentAction = 'create' | 'update' | 'enable' | 'disable' | 'rollback';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Entity {
  id: string;
  entity_type: EntityType;
  external_id: string;
  display_name?: string;
  metadata: Record<string, any>;
  risk_score: number;
  first_seen_at?: string;
  last_seen_at?: string;
  created_at: string;
}

export interface Alert {
  id: string;
  alert_type: AlertType;
  severity: Severity;
  title: string;
  description?: string;
  entity_id?: string;
  event_id?: string;
  rule_id?: string;
  model_score?: number;
  status: AlertStatus;
  assigned_to?: string;
  case_id?: string;
  data: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  status: CaseStatus;
  priority: Severity;
  decision?: CaseDecision;
  assigned_to?: string;
  alert_ids: string[];
  entity_ids: string[];
  sla_deadline?: string;
  tags: string[];
  resolved_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  evidence_type: string;
  title: string;
  content?: string;
  source?: string;
  entity_id?: string;
  event_id?: string;
  metadata: Record<string, any>;
  collected_at?: string;
  created_at: string;
}

export interface Narrative {
  id: string;
  case_id: string;
  content: string;
  citations: Array<{ id: string; evidence_id: string; title: string; type: string; timestamp?: string }>;
  model_used?: string;
  prompt_version?: string;
  generation_time_ms?: number;
  created_at: string;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  rule_type: RuleType;
  condition_json: Record<string, any>;
  severity: Severity;
  alert_type?: AlertType;
  enabled: boolean;
  version: number;
  created_at: string;
}

export interface Feature {
  id: string;
  name: string;
  description?: string;
  feature_type?: FeatureType;
  definition_json: Record<string, any>;
  enabled: boolean;
  version: number;
  created_at: string;
}

export interface Deployment {
  id: string;
  deployment_type: string;
  artifact_id: string;
  artifact_name?: string;
  action: DeploymentAction;
  config_snapshot: Record<string, any>;
  deployed_by: string;
  rollback_of?: string;
  notes?: string;
  created_at: string;
}

export interface GraphNode {
  id: string;
  entity_type: EntityType;
  external_id: string;
  display_name?: string;
  risk_score: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  edge_type: string;
  weight: number;
}

export interface EntityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
