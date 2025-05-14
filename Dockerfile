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
COPY api/ /app/api/

# Install packages and dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir /app/packages/core_converter
RUN pip install --no-cache-dir /app/api

# Set environment variable
ENV PYTHONPATH=/app

# Command to run the worker
CMD ["celery", "-A", "api.celery_app", "worker", "--loglevel=info", "--concurrency=2"] 