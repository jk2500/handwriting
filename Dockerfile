FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

COPY requirements.txt /app/
COPY packages/ /app/packages/
COPY api/ /app/api/

RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir /app/packages/core_converter \
    && pip install --no-cache-dir /app/api

RUN chown -R appuser:appgroup /app

USER appuser

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD celery -A api.celery_app inspect ping -d celery@$HOSTNAME || exit 1

CMD ["celery", "-A", "api.celery_app", "worker", "--loglevel=info", "--concurrency=2"]
