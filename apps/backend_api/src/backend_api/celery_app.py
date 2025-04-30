import os
from celery import Celery
from dotenv import load_dotenv

# Ensure .env is loaded - path adjusted for new location
# apps/backend_api/src/backend_api/celery_app.py -> up 4 levels
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DOTENV_PATH = os.path.join(PROJECT_ROOT, ".env")
if os.path.exists(DOTENV_PATH):
    load_dotenv(dotenv_path=DOTENV_PATH)
else:
    print(f"Warning: celery_app.py could not find .env file at {DOTENV_PATH}")

CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND_URL = os.getenv('CELERY_RESULT_BACKEND_URL', 'redis://localhost:6379/0')

# Update include path for the new package structure
celery_app = Celery(
    "tasks",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND_URL,
    # Point to the tasks module within the new package
    include=['backend_api.tasks'] 
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

if __name__ == '__main__':
    celery_app.start() 