# Deploying Celery Worker to Render

This guide provides step-by-step instructions for deploying a Celery worker as a background worker service on Render.

## Prerequisites

- A Render account (https://render.com)
- Your code repository connected to Render
- Redis instance for message broker (e.g., Vercel KV or Upstash Redis)
- PostgreSQL database (e.g., Vercel Postgres)

## Deployment Steps

### 1. Create a Background Worker Service on Render

1. Log in to your Render dashboard
2. Click "New +" and select "Background Worker"
3. Connect your repository
4. Fill in the service details:
   - **Name**: `handwriting-celery-worker` (or your preferred name)
   - **Environment**: Docker
   - **Repository**: Your repository URL
   - **Branch**: `main` (or your main branch)
   - **Root Directory**: Leave blank to use repository root

### 2. Configure Environment Variables

Add the following environment variables:

- `CELERY_BROKER_URL`: Your Redis URL (from Vercel KV or other provider)
- `CELERY_RESULT_BACKEND_URL`: Same as broker URL or your PostgreSQL URL (depends on your setup)
- `DATABASE_URL`: Your PostgreSQL connection string (from Vercel Postgres)
- Add any other environment variables your tasks require (e.g., AWS credentials, API keys)

### 3. Configure Advanced Options

- **Health Check Path**: Leave blank (not needed for background workers)
- **Auto-Deploy**: On (recommended)

### 4. Create the Service

Click "Create Background Worker" to deploy your service.

### 5. Monitor the Deployment

- Watch the build and deployment logs to ensure everything is working correctly
- Check for any errors in the build process
- Verify that the worker connects to Redis and PostgreSQL successfully

### 6. Test the Worker

After deployment:

1. Trigger a task from your application
2. Check the worker logs to see if the task was received and processed
3. Verify that the task completed successfully

## Troubleshooting

- If the worker fails to start, check the logs for errors
- Ensure environment variables are correctly set
- Verify that Redis and PostgreSQL are accessible from Render
- Check if the Celery worker can import all required modules

## Maintenance

- Monitor the worker's performance and logs regularly
- Update your code repository when changes are needed
- Render will automatically redeploy if auto-deploy is enabled 