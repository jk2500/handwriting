#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Starting Project Build ---"

# 1. Build Frontend (Next.js)
echo "Building frontend application..."
if [ -d "apps/web" ]; then
  cd apps/web
  npm install
  npm run build
  cd ../.. # Back to project root
  echo "Frontend build complete."
else
  echo "apps/web directory not found, skipping frontend build."
fi

# 2. Build Backend and Run Migrations (Python API)
echo "Setting up backend and running database migrations..."
if [ -d "api" ]; then
  cd api
  echo "Installing Python dependencies for API..."
  pip install -r requirements.txt # Alembic should be in requirements.txt
  
  echo "Running Alembic migrations..."
  # Ensure DATABASE_URL is set in Vercel environment variables
  alembic -c alembic.ini upgrade head
  
  cd .. # Back to project root
  echo "Backend setup and migrations complete."
else
  echo "api directory not found, skipping backend setup and migrations."
fi

echo "--- Project Build Finished ---" 