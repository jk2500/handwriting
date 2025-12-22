"""
Tests for api/config.py - Centralized configuration module.
"""

import os
from unittest.mock import patch

import pytest


class TestLoadEnv:
    """Tests for load_env function."""

    def test_load_env_only_loads_once(self):
        """Verify .env is only loaded once."""
        from api import config
        
        config._env_loaded = False
        config.load_env()
        assert config._env_loaded is True
        
        with patch("api.config.load_dotenv") as mock_load:
            config.load_env()
            mock_load.assert_not_called()


class TestGetLogger:
    """Tests for get_logger function."""

    def test_get_logger_returns_logger(self):
        """Test that get_logger returns a logger instance."""
        from api.config import get_logger
        
        logger = get_logger("test_module")
        assert logger is not None
        assert logger.name == "test_module"

    def test_get_logger_same_name_returns_same_logger(self):
        """Test that calling get_logger with same name returns same instance."""
        from api.config import get_logger
        
        logger1 = get_logger("same_module")
        logger2 = get_logger("same_module")
        assert logger1 is logger2

    def test_get_logger_adds_handler(self):
        """Test that logger has a handler."""
        from api.config import get_logger
        import logging
        
        logger_name = f"test_handler_{id(self)}"
        logger = get_logger(logger_name)
        assert len(logger.handlers) > 0
        assert logger.level == logging.INFO


class TestGetDatabaseUrl:
    """Tests for get_database_url function."""

    def test_get_database_url_returns_url(self):
        """Test that get_database_url returns the DATABASE_URL."""
        from api.config import get_database_url
        
        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://test:test@localhost/testdb"}):
            get_database_url.cache_clear()
            url = get_database_url()
            assert url == "postgresql://test:test@localhost/testdb"

    def test_get_database_url_raises_when_not_set(self):
        """Test that get_database_url raises ValueError when not set."""
        from api.config import get_database_url
        
        with patch.dict(os.environ, {}, clear=True):
            if "DATABASE_URL" in os.environ:
                del os.environ["DATABASE_URL"]
            get_database_url.cache_clear()
            
            with pytest.raises(ValueError, match="DATABASE_URL environment variable not set"):
                get_database_url()


class TestGetS3Config:
    """Tests for get_s3_config function."""

    def test_get_s3_config_returns_config(self):
        """Test that get_s3_config returns S3 configuration."""
        from api.config import get_s3_config
        
        with patch.dict(os.environ, {
            "S3_BUCKET_NAME": "my-bucket",
            "AWS_REGION": "us-west-2"
        }):
            get_s3_config.cache_clear()
            config = get_s3_config()
            assert config["bucket_name"] == "my-bucket"
            assert config["region"] == "us-west-2"


class TestGetCeleryConfig:
    """Tests for get_celery_config function."""

    def test_get_celery_config_returns_config(self):
        """Test that get_celery_config returns Celery configuration."""
        from api.config import get_celery_config
        
        with patch.dict(os.environ, {
            "CELERY_BROKER_URL": "redis://localhost:6379/0",
            "CELERY_RESULT_BACKEND_URL": "redis://localhost:6379/1"
        }):
            get_celery_config.cache_clear()
            config = get_celery_config()
            assert config["broker_url"] == "redis://localhost:6379/0"
            assert config["result_backend"] == "redis://localhost:6379/1"

    def test_get_celery_config_uses_defaults(self):
        """Test that get_celery_config uses default values."""
        from api.config import get_celery_config
        
        with patch.dict(os.environ, {}, clear=True):
            for key in ["CELERY_BROKER_URL", "CELERY_RESULT_BACKEND_URL"]:
                if key in os.environ:
                    del os.environ[key]
            get_celery_config.cache_clear()
            config = get_celery_config()
            assert "redis://localhost:6379/0" in config["broker_url"]


class TestGetCorsOrigins:
    """Tests for get_cors_origins function."""

    def test_get_cors_origins_includes_frontend_url(self):
        """Test that CORS origins includes FRONTEND_URL."""
        from api.config import get_cors_origins
        
        with patch.dict(os.environ, {"FRONTEND_URL": "http://localhost:3000"}):
            get_cors_origins.cache_clear()
            origins = get_cors_origins()
            assert "http://localhost:3000" in origins

    def test_get_cors_origins_includes_vercel_urls(self):
        """Test that CORS origins includes Vercel URLs."""
        from api.config import get_cors_origins
        
        with patch.dict(os.environ, {
            "FRONTEND_URL": "http://localhost:3000",
            "VERCEL_URL": "my-app.vercel.app",
            "VERCEL_BRANCH_URL": "my-app-git-branch.vercel.app"
        }):
            get_cors_origins.cache_clear()
            origins = get_cors_origins()
            assert "https://my-app.vercel.app" in origins
            assert "https://my-app-git-branch.vercel.app" in origins

    def test_get_cors_origins_includes_hardcoded_domain(self):
        """Test that CORS origins includes hardcoded Vercel domain."""
        from api.config import get_cors_origins
        
        get_cors_origins.cache_clear()
        origins = get_cors_origins()
        assert "https://handwriting-omega.vercel.app" in origins

    def test_get_cors_origins_removes_duplicates(self):
        """Test that CORS origins has no duplicates."""
        from api.config import get_cors_origins
        
        with patch.dict(os.environ, {
            "FRONTEND_URL": "http://localhost:3000",
            "VERCEL_URL": "localhost:3000"
        }):
            get_cors_origins.cache_clear()
            origins = get_cors_origins()
            assert len(origins) == len(set(origins))
