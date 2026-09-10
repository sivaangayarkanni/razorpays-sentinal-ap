"""Application settings loaded from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Sentinel-AP"
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel_ap"
    database_url_sync: str = "postgresql://sentinel:sentinel@localhost:5432/sentinel_ap"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    admin_email: str = "admin@sentinel-ap.local"
    admin_password: str = "admin123"

    # Razorpay (test keys — never hardcode production secrets)
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""  # optional; if empty, webhook skips verify in test
    razorpay_mock: bool = True  # use mock when keys empty

    # Bank health defaults
    bank_health_threshold: float = 0.95
    bank_health_mock_success_rate: float = 0.98

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    def model_post_init(self, __context) -> None:
        """Normalize Render/Heroku-style postgres URLs for asyncpg + sync drivers."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and "+asyncpg" not in url:
            object.__setattr__(self, "database_url", url.replace("postgresql://", "postgresql+asyncpg://", 1))
        sync = self.database_url_sync
        if sync.startswith("postgres://"):
            object.__setattr__(self, "database_url_sync", "postgresql://" + sync[len("postgres://") :])
        # If sync not set separately and async was rewritten, keep sync without asyncpg
        if self.database_url_sync.startswith("postgresql+asyncpg://"):
            object.__setattr__(
                self,
                "database_url_sync",
                self.database_url_sync.replace("postgresql+asyncpg://", "postgresql://", 1),
            )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
