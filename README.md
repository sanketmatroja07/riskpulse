# RiskPulse - Investigation Automation Platform

**Detect → Investigate → Mitigate**

A complete, production-grade investigation automation platform for fraud and risk teams. Entity-centric investigations with AI-generated narratives, real-time detection, and mitigation artifact deployment.

## Quick Start

```bash
# Clone and run
cd riskpulse
docker compose up --build
```

That's it. Open:
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **API Health**: http://localhost:8000/api/health

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@riskpulse.io | riskpulse123 |
| Analyst | sarah.chen@riskpulse.io | riskpulse123 |
| Engineer | alex.kumar@riskpulse.io | riskpulse123 |
| Viewer | viewer@riskpulse.io | riskpulse123 |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Frontend (Next.js)               │
│   Dashboard │ Alerts │ Cases │ Entities │ Rules      │
├─────────────────────────────────────────────────────┤
│                      API (FastAPI)                    │
│   Auth │ Detection │ Investigation │ Mitigation       │
├────────────┬────────────┬───────────────────────────┤
│  PostgreSQL │   Redis    │     Worker Process         │
│  (Data)     │  (Queue)   │  (Detection + Demo Sim)   │
└────────────┴────────────┴───────────────────────────┘
```

## Modules

### A) Data Ingestion & Signals
- CSV upload endpoint (`POST /api/events/ingest/csv`)
- Webhook simulator (`POST /api/events/ingest/webhook`)
- Mock enrichment: IP geo, device fingerprint, email risk score
- Core tables: events, transactions, entities, entity_edges, alerts, cases, evidence, rules, features

### B) Detection
- Rule engine v1: threshold, velocity, blacklist, pattern, composite
- Model score simulator (deterministic heuristics)
- Alert types: account_takeover, payment_fraud, promo_abuse, bot_attack, chargeback_risk

### C) Investigation
- Case creation from alerts
- Case workspace: entity graph, timeline, evidence panel, narrative generation
- "Pull relevant signals" pipeline: events, linked entities, velocity stats, geo anomalies
- Evidence citations: narrative references evidence by ID and timestamp
- Case decisions: approve/deny/block/escalate/request_verification

### D) Mitigation
- Suggested rules from case findings
- Suggested features for detection improvement
- Trend pattern identification
- Deploy simulation with versioning and audit logging
- Rollback capability

### E) Collaboration & Ops
- Case assignment, SLA timer, status management
- Comments with @mentions
- Full audit log for every action
- In-app notifications panel

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI (Python), SQLAlchemy async |
| Database | PostgreSQL 16 |
| Queue | Redis 7 |
| LLM | OpenAI/Anthropic/Local fallback |
| State | Zustand |
| Container | Docker Compose |

## LLM Configuration

By default, RiskPulse uses a local rule-based narrative generator (no API key required).

To enable LLM-powered narratives:

```bash
# In .env or docker-compose environment
LLM_PROVIDER=openai        # or "anthropic" or "local"
OPENAI_API_KEY=sk-...       # if using OpenAI
ANTHROPIC_API_KEY=sk-ant-.. # if using Anthropic
```

## Seed Data

Pre-loaded with:
- 200+ transactions
- 60 user entities
- 40 device entities
- 120 IP entities
- 30 card entities
- 30 merchant entities
- 25 alerts (various types and severities)
- 10 cases (various statuses and outcomes)
- 10 detection rules
- 8 features
- Audit logs, comments, decisions, narratives

## API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `GET /api/auth/users` - List users

### Dashboard
- `GET /api/dashboard/stats` - KPIs and metrics

### Alerts
- `GET /api/alerts` - List alerts (filters: status, type, severity)
- `GET /api/alerts/{id}` - Get alert
- `PATCH /api/alerts/{id}` - Update alert
- `POST /api/alerts/bulk-action` - Bulk acknowledge/dismiss/escalate
- `POST /api/alerts/{id}/create-case` - Create case from alert

### Cases
- `GET /api/cases` - List cases
- `POST /api/cases` - Create case
- `GET /api/cases/{id}` - Get case
- `PATCH /api/cases/{id}` - Update case
- `POST /api/cases/{id}/decision` - Make decision
- `GET /api/cases/{id}/evidence` - Get evidence
- `POST /api/cases/{id}/collect-evidence` - Collect evidence
- `GET /api/cases/{id}/narratives` - Get narratives
- `POST /api/cases/{id}/generate-narrative` - Generate AI narrative
- `GET /api/cases/{id}/graph` - Entity graph
- `GET /api/cases/{id}/timeline` - Event timeline
- `GET /api/cases/{id}/comments` - Comments
- `POST /api/cases/{id}/comments` - Add comment
- `GET /api/cases/{id}/mitigations` - Mitigations
- `POST /api/cases/{id}/suggest-mitigations` - Suggest mitigations

### Entities
- `GET /api/entities` - List/search entities
- `GET /api/entities/{id}` - Get entity
- `GET /api/entities/{id}/graph` - Entity graph (configurable depth)
- `GET /api/entities/{id}/events` - Entity events
- `GET /api/entities/{id}/transactions` - Entity transactions
- `GET /api/entities/{id}/alerts` - Entity alerts

### Events
- `GET /api/events` - List events
- `POST /api/events/ingest` - Ingest single event
- `POST /api/events/ingest/webhook` - Batch webhook
- `POST /api/events/ingest/csv` - CSV upload

### Rules & Features
- `GET/POST /api/rules` - List/create rules
- `PATCH /api/rules/{id}` - Update rule
- `POST /api/rules/{id}/toggle` - Enable/disable
- `POST /api/rules/{id}/deploy` - Deploy rule
- `GET/POST /api/features` - List/create features
- `POST /api/features/{id}/deploy` - Deploy feature

### Deployments
- `GET /api/deployments` - Deployment history
- `POST /api/deployments/{id}/rollback` - Rollback

### Search & Notifications
- `GET /api/search?q=` - Global search
- `GET /api/notifications` - User notifications
- `POST /api/notifications/{id}/read` - Mark read

### Metrics
- `GET /api/metrics/system` - System health
- `GET /api/metrics/audit-log` - Audit log

## RBAC

| Permission | Admin | Analyst | Engineer | Read-only |
|-----------|-------|---------|----------|-----------|
| View all | ✅ | ✅ | ✅ | ✅ |
| Manage alerts | ✅ | ✅ | ❌ | ❌ |
| Manage cases | ✅ | ✅ | ❌ | ❌ |
| Create/deploy rules | ✅ | ❌ | ✅ | ❌ |
| Create/deploy features | ✅ | ❌ | ✅ | ❌ |
| View audit log | ✅ | ❌ | ❌ | ❌ |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Open search |
| `g d` | Go to Dashboard |
| `g a` | Go to Alerts |
| `g c` | Go to Cases |
| `g e` | Go to Entities |
| `g r` | Go to Rules |
| `g p` | Go to Deployments |
| `Escape` | Close modals |

## Running Tests

```bash
# Backend tests
docker compose exec api pytest tests/ -v

# Or locally
cd apps/api && python -m pytest tests/ -v
```

## Project Structure

```
riskpulse/
├── docker-compose.yml          # One-command startup
├── .env.example                # Environment config
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── main.py             # App entry point
│   │   ├── config.py           # Settings
│   │   ├── models/
│   │   │   ├── database.py     # SQLAlchemy models
│   │   │   └── schemas.py      # Pydantic schemas
│   │   ├── routes/
│   │   │   ├── auth.py         # Authentication
│   │   │   ├── alerts.py       # Alert management
│   │   │   ├── cases.py        # Case workspace
│   │   │   ├── entities.py     # Entity explorer
│   │   │   ├── events.py       # Event ingestion
│   │   │   ├── rules.py        # Detection rules
│   │   │   ├── features.py     # Feature store
│   │   │   ├── deployments.py  # Deployment history
│   │   │   ├── dashboard.py    # Dashboard stats
│   │   │   ├── search.py       # Global search
│   │   │   ├── notifications.py
│   │   │   └── metrics.py      # Observability
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── detection_service.py
│   │   │   ├── investigation_service.py
│   │   │   ├── narrative_service.py
│   │   │   └── mitigation_service.py
│   │   ├── workers/
│   │   │   └── worker_main.py
│   │   ├── seed/
│   │   │   └── seed_data.py
│   │   └── tests/
│   │       ├── test_detection.py
│   │       └── test_graph.py
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/
│           │   ├── login/
│           │   ├── dashboard/
│           │   ├── alerts/
│           │   ├── cases/[id]/
│           │   ├── entities/
│           │   ├── rules/
│           │   ├── engineering/
│           │   └── deployments/
│           ├── components/
│           │   ├── layout/
│           │   ├── ui/
│           │   └── notifications/
│           └── lib/
│               ├── api.ts
│               ├── store.ts
│               └── utils.ts
├── packages/
│   └── shared/
│       └── types.ts
└── infra/
    └── postgres/
        └── init.sql
```

## Design System

- Background: `#0B1020` (deep navy)
- Surface: `#111A33`
- Primary: `#3B82F6` (blue)
- Accent: `#22C55E` (green)
- Warning: `#F59E0B`
- Danger: `#EF4444`
- Font: Inter/system

## Security Notes

- JWT-based authentication with configurable expiration
- RBAC enforcement on all mutating endpoints
- Audit logging for every significant action
- PII masking in AI-generated narratives
- Safety filters on LLM outputs (blocks fraud/evasion instructions)
- Prompt templates versioned and stored in database
- No real PII in seed data (all synthetic)

## Acceptance Checklist

- [x] Docker Compose one-command startup
- [x] PostgreSQL + Redis + API + Worker + Web
- [x] Seed data: 200+ txns, 60 users, 40 devices, 120 IPs, 30 merchants, 25 alerts, 10 cases
- [x] Authentication with JWT + RBAC (4 roles)
- [x] Detection: rule engine (threshold/velocity/blacklist/pattern/composite)
- [x] Detection: model score simulator
- [x] Alert inbox with filters, bulk actions
- [x] Case workspace: evidence, narrative, timeline, graph, mitigations
- [x] AI narrative generation (OpenAI/Anthropic/local)
- [x] Evidence collection with citations
- [x] Mitigation suggestions (rules, features, patterns)
- [x] Deploy simulation with audit log
- [x] Entity explorer with graph and history
- [x] Global search
- [x] Keyboard shortcuts
- [x] Notifications panel
- [x] Empty/loading/error states
- [x] Demo mode (worker generates events)
- [x] Swagger/OpenAPI at /docs
- [x] Backend unit tests
- [x] RBAC enforcement
- [x] Audit trail
- [x] Structured logging
- [x] Safety filters on LLM output
- [x] Prompt template versioning
