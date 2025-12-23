"""
Pytest configuration and shared fixtures for all tests.
"""

import os
import sys
import uuid
import tempfile
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from typing import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("S3_BUCKET_NAME", "test-bucket")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
os.environ.setdefault("CELERY_RESULT_BACKEND_URL", "memory://")
os.environ.setdefault("OPENAI_API_KEY", "test-key")

from api.database import Base, get_db
from api.main import app
from api import models


SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def test_engine():
    """Create a fresh in-memory SQLite engine for each test."""
    engine = create_engine(
        SQLALCHEMY_TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a fresh database session for each test."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def client(db_session) -> Generator[TestClient, None, None]:
    """Create a test client with overridden database dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_job(db_session) -> models.Job:
    """Create a sample job for testing."""
    job = models.Job(
        id=uuid.uuid4(),
        input_pdf_filename="test_document.pdf",
        input_pdf_s3_path="uploads/pdfs/test_document.pdf",
        status=models.JobStatus.PENDING,
        model_used="gpt-4-vision-preview",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


@pytest.fixture
def sample_job_with_tex(db_session) -> models.Job:
    """Create a sample job with TeX paths for testing."""
    job = models.Job(
        id=uuid.uuid4(),
        input_pdf_filename="test_document.pdf",
        input_pdf_s3_path="uploads/pdfs/test_document.pdf",
        initial_tex_s3_path="outputs/initial_tex/test.tex",
        status=models.JobStatus.AWAITING_SEGMENTATION,
        model_used="gpt-4-vision-preview",
        created_at=datetime.now(timezone.utc),
        segmentation_tasks={"DIAGRAM-1": "A test diagram"},
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


@pytest.fixture
def sample_completed_job(db_session) -> models.Job:
    """Create a completed job for testing."""
    job = models.Job(
        id=uuid.uuid4(),
        input_pdf_filename="test_document.pdf",
        input_pdf_s3_path="uploads/pdfs/test_document.pdf",
        initial_tex_s3_path="outputs/initial_tex/test.tex",
        final_tex_s3_path="outputs/final_tex/test.tex",
        final_pdf_s3_path="outputs/final_pdf/test.pdf",
        status=models.JobStatus.COMPILATION_COMPLETE,
        model_used="gpt-4-vision-preview",
        created_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


@pytest.fixture
def sample_page_images(db_session, sample_job_with_tex) -> list[models.JobPageImage]:
    """Create sample page images for a job."""
    page_images = []
    for i in range(3):
        page_image = models.JobPageImage(
            job_id=sample_job_with_tex.id,
            page_number=i,
            s3_path=f"pages/{sample_job_with_tex.id}/page_{i}.png",
        )
        db_session.add(page_image)
        page_images.append(page_image)
    db_session.commit()
    for pi in page_images:
        db_session.refresh(pi)
    return page_images


@pytest.fixture
def sample_segmentations(db_session, sample_job_with_tex) -> list[models.Segmentation]:
    """Create sample segmentations for a job."""
    segmentations = []
    for i in range(2):
        seg = models.Segmentation(
            job_id=sample_job_with_tex.id,
            page_number=0,
            x=0.1 + (i * 0.2),
            y=0.1,
            width=0.15,
            height=0.15,
            label=f"DIAGRAM-{i+1}",
        )
        db_session.add(seg)
        segmentations.append(seg)
    db_session.commit()
    for seg in segmentations:
        db_session.refresh(seg)
    return segmentations


@pytest.fixture
def mock_s3_client():
    """Mock boto3 S3 client."""
    with patch("api.s3_utils.s3_client") as mock_client:
        mock_client.upload_fileobj = MagicMock(return_value=None)
        mock_client.upload_file = MagicMock(return_value=None)
        mock_client.get_object = MagicMock(return_value={
            "Body": MagicMock(read=MagicMock(return_value=b"test content"), __enter__=MagicMock(), __exit__=MagicMock())
        })
        mock_client.generate_presigned_url = MagicMock(return_value="https://s3.example.com/test-url")
        mock_client.delete_objects = MagicMock(return_value=None)
        yield mock_client


@pytest.fixture
def mock_celery_task():
    """Mock Celery task delay."""
    with patch("api.tasks.process_handwriting_conversion.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="test-task-id")
        yield mock_delay


@pytest.fixture
def temp_dir():
    """Create a temporary directory for file operations."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_pdf_content() -> bytes:
    """Return minimal PDF content for testing."""
    return b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n199\n%%EOF"


@pytest.fixture
def sample_tex_content() -> str:
    """Return sample LaTeX content for testing."""
    return r"""\documentclass{article}
\usepackage{amsmath}
\usepackage{graphicx}

\begin{document}

\section*{Test Document}

This is a test document with an equation:

\[ E = mc^2 \]

% PLACEHOLDER: DIAGRAM-1

\end{document}
"""


@pytest.fixture
def sample_image_bytes() -> bytes:
    """Return a valid PNG image bytes for testing (100x100 red image)."""
    from PIL import Image
    import io
    
    img = Image.new('RGB', (100, 100), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()
