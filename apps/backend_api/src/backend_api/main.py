from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Change to absolute imports
from backend_api.routers import upload, jobs

app = FastAPI(title="Handwritten LaTeX Converter API")

# Add CORS middleware
origins = [
    "http://localhost:3000", # Allow your frontend origin
    # You can add other origins here if needed (e.g., deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

@app.get("/")
async def read_root():
    """Root endpoint for basic API check."""
    return {"message": "Handwritten LaTeX Converter API is running!"}

# Include routers
app.include_router(upload.router)
app.include_router(jobs.router) 