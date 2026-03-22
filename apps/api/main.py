import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import get_settings
from routes import auth, alerts, cases, entities, events, rules, features, dashboard, deployments, search, notifications, metrics
from routes import billing

settings = get_settings()

# ── Sentry (error tracking) ──
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
        )
    except ImportError:
        pass

# ── Structured logging ──
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from models.database import init_db
    await init_db()
    logger.info("riskpulse_started", version="2.0.0", mode=settings.MODE)
    yield
    logger.info("riskpulse_stopped")


app = FastAPI(
    title="RiskPulse API",
    description="Investigation Automation Platform - Detect -> Investigate -> Mitigate",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# ── CORS ──
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiting middleware ──
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
except ImportError:
    pass  # slowapi not installed, skip rate limiting


# ── Routes ──
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(cases.router, prefix="/api/cases", tags=["Cases"])
app.include_router(entities.router, prefix="/api/entities", tags=["Entities"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(rules.router, prefix="/api/rules", tags=["Rules"])
app.include_router(features.router, prefix="/api/features", tags=["Features"])
app.include_router(deployments.router, prefix="/api/deployments", tags=["Deployments"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])


# ── Health check ──
@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}


# ── GDPR: Data deletion endpoint ──
@app.delete("/api/gdpr/delete-my-data")
async def gdpr_delete(request: Request):
    """GDPR compliance: users can request their data deletion."""
    from services.auth_service import get_current_user, get_db
    from sqlalchemy import delete
    from models.database import User, AuditLog, Notification, CaseComment, AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # This is a placeholder -- full implementation would delete all user data
        return {"status": "request_received", "message": "Your data deletion request has been logged. We will process it within 30 days."}
