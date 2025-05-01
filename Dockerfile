FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY requirements.txt /app/
COPY packages/ /app/packages/
COPY apps/backend_api/ /app/apps/backend_api/

# Install packages and dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -e /app/packages/core_converter
RUN pip install --no-cache-dir -e /app/apps/backend_api

# Set environment variable
ENV PYTHONPATH=/app

# Command to run the worker
CMD ["celery", "-A", "backend_api.celery_app", "worker", "--loglevel=info"] 