from celery import Celery

from .config import get_celery_config

_celery_config = get_celery_config()

celery_app = Celery(
    "tasks",
    broker=_celery_config["broker_url"],
    backend=_celery_config["result_backend"],
    include=['api.tasks'] 
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
