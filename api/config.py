"""
Centralized configuration and logging setup for the API.
"""

import os
import logging
from functools import lru_cache
from dotenv import load_dotenv

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOTENV_PATH = os.path.join(PROJECT_ROOT, ".env")

_env_loaded = False

def load_env() -> None:
    """Load environment variables from .env file (only once)."""
    global _env_loaded
    if _env_loaded:
        return
    
    if os.path.exists(DOTENV_PATH):
        load_dotenv(dotenv_path=DOTENV_PATH, override=True)
    _env_loaded = True

load_env()

def get_logger(name: str) -> logging.Logger:
    """Get a configured logger instance."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger

@lru_cache()
def get_database_url() -> str:
    """Get database URL from environment."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL environment variable not set.")
    return url

@lru_cache()
def get_s3_config() -> dict:
    """Get S3 configuration from environment."""
    return {
        "bucket_name": os.getenv("S3_BUCKET_NAME"),
        "region": os.getenv("AWS_REGION"),
    }

@lru_cache()
def get_celery_config() -> dict:
    """Get Celery configuration from environment."""
    return {
        "broker_url": os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
        "result_backend": os.getenv("CELERY_RESULT_BACKEND_URL", "redis://localhost:6379/0"),
    }

@lru_cache()
def get_cors_origins() -> list:
    """Get CORS allowed origins."""
    cors_origins = os.getenv("CORS_ORIGINS", "")
    if cors_origins:
        return [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    origins = [frontend_url, "http://localhost:3000"]
    
    return list(filter(None, set(origins)))
