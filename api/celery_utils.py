"""
Utility function for FastAPI dependency injection to get the Celery app instance.
"""

from api.celery_app import celery_app
from celery import Celery

def get_celery() -> Celery:
    """Dependency function to get the Celery app instance."""
    return celery_app 