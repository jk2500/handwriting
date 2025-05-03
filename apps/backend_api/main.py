from fastapi import FastAPI
# Add CORS middleware import
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from api.routers import upload, jobs

app = FastAPI(title="Handwritten LaTeX Converter API")

# CORS Configuration
origins = [
    "http://localhost:3000", # Allow Next.js dev server
    # Add other origins if needed (e.g., production frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (GET, POST, etc.)
    allow_headers=["*"], # Allow all headers
)


@app.get("/")
async def read_root():
    """Root endpoint for basic API check."""
    return {"message": "Handwritten LaTeX Converter API is running!"}

# Include routers from the 'routers' directory
app.include_router(upload.router)
app.include_router(jobs.router) 