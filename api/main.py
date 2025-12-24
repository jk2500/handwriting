import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_cors_origins, get_logger
from .routers import upload, jobs
from . import models
from .database import engine

logger = get_logger(__name__)

app = FastAPI(title="Handwritten LaTeX Converter API")

origins = get_cors_origins()
logger.info(f"CORS allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.get("/")
async def root():
    return {"message": "Handwriting Conversion API Root (FastAPI)"}

@app.get("/health")
async def health():
    """Health check endpoint for keep-warm pings."""
    return {"status": "ok"}

app.include_router(upload.router)
app.include_router(jobs.router)
