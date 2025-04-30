from fastapi import FastAPI

# Change to absolute imports
from backend_api.routers import upload, jobs

app = FastAPI(title="Handwritten LaTeX Converter API")

@app.get("/")
async def read_root():
    """Root endpoint for basic API check."""
    return {"message": "Handwritten LaTeX Converter API is running!"}

# Include routers
app.include_router(upload.router)
app.include_router(jobs.router) 