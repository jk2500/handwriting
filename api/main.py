print("--- PYTHON SCRIPT api/main.py STARTED ---")
print("--- ABOUT TO IMPORT SYS AND OS ---")
import sys
import os
print("--- SYS AND OS IMPORTED ---")

# --- AWS SDK Debug Logging ---
import logging
logging.basicConfig(level=logging.INFO) # General logging for your app
logging.getLogger('botocore').setLevel(logging.DEBUG)
logging.getLogger('s3transfer').setLevel(logging.DEBUG)
print("--- AWS SDK DEBUG LOGGING ENABLED ---")
# --- End AWS SDK Debug Logging ---

# --- Load .env file --- 
from dotenv import load_dotenv
# Determine project root to find .env, similar to celery_app.py
# __file__ is api/main.py, parent is api/, parent.parent is project root
PROJECT_ROOT_FOR_MAIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOTENV_PATH_FOR_MAIN = os.path.join(PROJECT_ROOT_FOR_MAIN, ".env")

if os.path.exists(DOTENV_PATH_FOR_MAIN):
    print(f"FastAPI main.py: Loading .env from {DOTENV_PATH_FOR_MAIN}")
    load_dotenv(dotenv_path=DOTENV_PATH_FOR_MAIN, override=True) # Kept override=True, removed verbose
else:
    print(f"Warning: FastAPI main.py could not find .env file at {DOTENV_PATH_FOR_MAIN}. Relying on shell environment variables.")
# --- End .env loading ---

# Add project root to sys.path to allow absolute imports from 'packages' etc.
# __file__ is api/main.py, parent is api/, parent.parent is project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT) # Insert at beginning for precedence

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Use relative imports now that files are within the api/ directory
from .routers import upload, jobs
from . import models
from .database import engine

# Create database tables (consider using Alembic for production)
# models.Base.metadata.create_all(bind=engine) # Commented out - handled by Alembic build step

app = FastAPI(title="Handwritten LaTeX Converter API")

# --- CORS Configuration ---
# Define the allowed origins. For production, restrict this to your frontend's domain.
# Get the frontend URL from an environment variable or use a default for development
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000") # Default to localhost:3000 for local dev
VERCEL_URL = os.getenv("VERCEL_URL") # Vercel automatically sets this system env var for preview/prod deployments
VERCEL_BRANCH_URL = os.getenv("VERCEL_BRANCH_URL") # Vercel automatically sets this for preview deployments based on git branch
NEXT_PUBLIC_API_URL_FROM_ENV = os.getenv("NEXT_PUBLIC_API_URL") # See if backend sees this

origins = [
    FRONTEND_URL, # For local development
    # Add other origins if needed, e.g., your custom domain
]

# Add Vercel deployment URLs if available
if VERCEL_URL:
    # This is typically the main deployment URL (e.g., project.vercel.app)
    origins.append(f"https://{VERCEL_URL}") 
if VERCEL_BRANCH_URL:
    # This is specific to preview deployments (e.g., project-git-branch-org.vercel.app)
    origins.append(f"https://{VERCEL_BRANCH_URL}")

# Also explicitly add the user's current specific Vercel domain just in case
origins.append("https://handwriting-omega.vercel.app") 

# Remove potential duplicates and filter out None/empty strings
origins = list(filter(None, set(origins)))

print(f"[CORS Setup] Allowed Origins: {origins}") # Log allowed origins for debugging

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # List of origins allowed
    allow_credentials=True, # Allow cookies
    allow_methods=["*"],    # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],    # Allow all headers
)
# --- End CORS Configuration ---

@app.get("/")
async def root():
    # This path is NOT affected by the /api/ route in vercel.json
    # Accessing the base URL (e.g., https://handwriting-omega.vercel.app/) 
    # might hit the frontend first based on vercel.json rules.
    # The /api/ prefix is handled by Vercel routing *before* it hits FastAPI.
    # FastAPI itself doesn't see the /api part here.
    return {"message": "Handwriting Conversion API Root (FastAPI)"}

# Optional: Add endpoint to check loaded environment variables (for debugging)
# Access this via /api/debug/env in your Vercel deployment
@app.get("/debug/env")
async def debug_env():
    return {
        "database_url_set": "DATABASE_URL" in os.environ,
        "s3_bucket_set": "S3_BUCKET_NAME" in os.environ,
        "aws_region_set": "AWS_REGION" in os.environ,
        "celery_broker_set": "CELERY_BROKER_URL" in os.environ,
        "celery_backend_set": "CELERY_RESULT_BACKEND_URL" in os.environ,
        "frontend_url_env": os.getenv("FRONTEND_URL"),
        "vercel_url_env": VERCEL_URL,
        "vercel_branch_url_env": VERCEL_BRANCH_URL,
        "next_public_api_url_env": NEXT_PUBLIC_API_URL_FROM_ENV,
        "cors_origins_configured": origins
    }

# Note: If you are running this with `uvicorn main:app --reload`, 
# make sure your working directory is `apps/backend_api`
# Or run from project root: `uvicorn apps.backend_api.src.backend_api.main:app --reload`

# Include routers
app.include_router(upload.router)
app.include_router(jobs.router) 