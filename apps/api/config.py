import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

class Settings:
    def __init__(self):
        self.MODE = os.environ.get("MODE", "local")  # "local", "docker", "production"

        # Database: prefer DATABASE_URL env var (Railway/Heroku/Render set this automatically)
        db_url = os.environ.get("DATABASE_URL", "")

        if db_url:
            # Production: use provided DATABASE_URL
            # Railway gives postgres:// but SQLAlchemy needs postgresql://
            if db_url.startswith("postgres://"):
                db_url = db_url.replace("postgres://", "postgresql://", 1)
            self.DATABASE_URL_SYNC = db_url
            # Async version
            if "postgresql://" in db_url:
                async_db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

                # psycopg2 accepts sslmode=require, but asyncpg expects ssl=require.
                if "sslmode=" in async_db_url:
                    parsed = urlparse(async_db_url)
                    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
                    if "sslmode" in query and "ssl" not in query:
                        query["ssl"] = query.pop("sslmode")
                    async_db_url = urlunparse(parsed._replace(query=urlencode(query)))

                self.DATABASE_URL = async_db_url
            else:
                self.DATABASE_URL = db_url
        elif self.MODE == "docker":
            self.DATABASE_URL = "postgresql+asyncpg://riskpulse:riskpulse_dev@postgres:5432/riskpulse"
            self.DATABASE_URL_SYNC = "postgresql://riskpulse:riskpulse_dev@postgres:5432/riskpulse"
        else:
            # Local dev: SQLite
            _db_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
            os.makedirs(_db_dir, exist_ok=True)
            _sqlite_path = os.path.join(_db_dir, "riskpulse.db")
            self.DATABASE_URL = f"sqlite+aiosqlite:///{_sqlite_path}"
            self.DATABASE_URL_SYNC = f"sqlite:///{_sqlite_path}"

        self.REDIS_URL = os.environ.get("REDIS_URL", "")
        self.JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production-abc123")
        self.JWT_ALGORITHM = "HS256"
        self.JWT_EXPIRATION_HOURS = int(os.environ.get("JWT_EXPIRATION_HOURS", "24"))
        self.OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
        self.ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
        self.LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "local")
        self.LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
        self.CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
        self.STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
        self.STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
        self.SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
        self.BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
        self.FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    @property
    def is_sqlite(self):
        return "sqlite" in self.DATABASE_URL

    @property
    def is_production(self):
        return self.MODE == "production" or bool(os.environ.get("DATABASE_URL"))


_settings = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
