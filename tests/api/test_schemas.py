"""
Tests for api/schemas.py - Pydantic schemas for API validation.
"""

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from api import schemas
from api.models import JobStatus


class TestJobSchemas:
    """Tests for Job-related schemas."""

    def test_job_base_optional_fields(self):
        """Test JobBase with optional fields."""
        job = schemas.JobBase()
        assert job.input_pdf_filename is None
        assert job.model_used is None

    def test_job_base_with_values(self):
        """Test JobBase with values."""
        job = schemas.JobBase(
            input_pdf_filename="test.pdf",
            model_used="gpt-4-vision-preview"
        )
        assert job.input_pdf_filename == "test.pdf"
        assert job.model_used == "gpt-4-vision-preview"

    def test_job_schema(self):
        """Test Job schema with all fields."""
        now = datetime.now(timezone.utc)
        job = schemas.Job(
            id=uuid.uuid4(),
            input_pdf_filename="test.pdf",
            status=JobStatus.PENDING,
            created_at=now,
        )
        assert job.status == "pending"
        assert job.created_at == now

    def test_job_status_response(self):
        """Test JobStatusResponse schema."""
        job_id = uuid.uuid4()
        response = schemas.JobStatusResponse(
            job_id=job_id,
            status=JobStatus.PROCESSING_VLM,
            error_message=None,
        )
        assert response.job_id == job_id
        assert response.status == "processing_vlm"

    def test_job_status_response_with_error(self):
        """Test JobStatusResponse with error message."""
        response = schemas.JobStatusResponse(
            job_id=uuid.uuid4(),
            status=JobStatus.FAILED,
            error_message="Something went wrong",
        )
        assert response.error_message == "Something went wrong"


class TestUploadAcceptResponse:
    """Tests for UploadAcceptResponse schema."""

    def test_upload_accept_response(self):
        """Test UploadAcceptResponse creation."""
        job_id = uuid.uuid4()
        response = schemas.UploadAcceptResponse(
            message="PDF accepted",
            job_id=job_id,
            status_url="http://localhost/jobs/123/status",
        )
        assert response.message == "PDF accepted"
        assert response.job_id == job_id


class TestPageImageSchemas:
    """Tests for PageImage-related schemas."""

    def test_page_image_info(self):
        """Test PageImageInfo schema."""
        info = schemas.PageImageInfo(
            page_number=0,
            image_url="https://s3.example.com/page_0.png"
        )
        assert info.page_number == 0
        assert "page_0.png" in info.image_url

    def test_job_page_images_response(self):
        """Test JobPageImagesResponse schema."""
        job_id = uuid.uuid4()
        pages = [
            schemas.PageImageInfo(page_number=0, image_url="http://example.com/0"),
            schemas.PageImageInfo(page_number=1, image_url="http://example.com/1"),
        ]
        response = schemas.JobPageImagesResponse(job_id=job_id, pages=pages)
        assert response.job_id == job_id
        assert len(response.pages) == 2


class TestSegmentationSchemas:
    """Tests for Segmentation-related schemas."""

    def test_segmentation_base_valid(self):
        """Test valid SegmentationBase."""
        seg = schemas.SegmentationBase(
            pageNumber=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
            label="DIAGRAM-1"
        )
        assert seg.page_number == 0
        assert seg.x == 0.1
        assert seg.label == "DIAGRAM-1"

    def test_segmentation_base_alias(self):
        """Test SegmentationBase uses alias for page_number."""
        seg = schemas.SegmentationBase(
            pageNumber=5,
            x=0.1,
            y=0.1,
            width=0.1,
            height=0.1,
        )
        assert seg.page_number == 5

    def test_segmentation_x_bounds(self):
        """Test x must be between 0 and 1."""
        with pytest.raises(ValidationError):
            schemas.SegmentationBase(
                pageNumber=0,
                x=-0.1,
                y=0.1,
                width=0.1,
                height=0.1,
            )
        
        with pytest.raises(ValidationError):
            schemas.SegmentationBase(
                pageNumber=0,
                x=1.5,
                y=0.1,
                width=0.1,
                height=0.1,
            )

    def test_segmentation_y_bounds(self):
        """Test y must be between 0 and 1."""
        with pytest.raises(ValidationError):
            schemas.SegmentationBase(
                pageNumber=0,
                x=0.1,
                y=-0.1,
                width=0.1,
                height=0.1,
            )

    def test_segmentation_width_positive(self):
        """Test width must be greater than 0."""
        with pytest.raises(ValidationError):
            schemas.SegmentationBase(
                pageNumber=0,
                x=0.1,
                y=0.1,
                width=0,
                height=0.1,
            )

    def test_segmentation_height_positive(self):
        """Test height must be greater than 0."""
        with pytest.raises(ValidationError):
            schemas.SegmentationBase(
                pageNumber=0,
                x=0.1,
                y=0.1,
                width=0.1,
                height=0,
            )

    def test_segmentation_x_plus_width_bounds(self):
        """Test x + width must be <= 1."""
        with pytest.raises(ValidationError):
            schemas.SegmentationBase(
                pageNumber=0,
                x=0.8,
                y=0.1,
                width=0.5,
                height=0.1,
            )

    def test_segmentation_y_plus_height_bounds(self):
        """Test y + height must be <= 1."""
        with pytest.raises(ValidationError):
            schemas.SegmentationBase(
                pageNumber=0,
                x=0.1,
                y=0.8,
                width=0.1,
                height=0.5,
            )

    def test_segmentation_valid_edge_case(self):
        """Test valid segmentation at edge of bounds."""
        seg = schemas.SegmentationBase(
            pageNumber=0,
            x=0.0,
            y=0.0,
            width=1.0,
            height=1.0,
        )
        assert seg.x == 0.0
        assert seg.width == 1.0

    def test_segmentation_page_number_non_negative(self):
        """Test page_number must be >= 0."""
        with pytest.raises(ValidationError):
            schemas.SegmentationBase(
                pageNumber=-1,
                x=0.1,
                y=0.1,
                width=0.1,
                height=0.1,
            )

    def test_segmentation_create(self):
        """Test SegmentationCreate schema."""
        seg = schemas.SegmentationCreate(
            pageNumber=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
        )
        assert seg.page_number == 0

    def test_segmentation_full(self):
        """Test full Segmentation schema."""
        now = datetime.now(timezone.utc)
        seg = schemas.Segmentation(
            id=1,
            job_id=uuid.uuid4(),
            pageNumber=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
            label="TEST",
            created_at=now,
        )
        assert seg.id == 1
        assert seg.created_at == now


class TestSegmentationTaskSchemas:
    """Tests for SegmentationTask-related schemas."""

    def test_segmentation_task_item(self):
        """Test SegmentationTaskItem schema."""
        task = schemas.SegmentationTaskItem(
            placeholder="DIAGRAM-1",
            description="A bar chart showing sales data"
        )
        assert task.placeholder == "DIAGRAM-1"
        assert "bar chart" in task.description

    def test_segmentation_task_list_response(self):
        """Test SegmentationTaskListResponse schema."""
        job_id = uuid.uuid4()
        tasks = [
            schemas.SegmentationTaskItem(placeholder="DIAGRAM-1", description="A chart"),
            schemas.SegmentationTaskItem(placeholder="STRUCTURE-1", description="A molecule"),
        ]
        response = schemas.SegmentationTaskListResponse(job_id=job_id, tasks=tasks)
        assert response.job_id == job_id
        assert len(response.tasks) == 2

    def test_segmentation_task_list_empty(self):
        """Test SegmentationTaskListResponse with empty list."""
        response = schemas.SegmentationTaskListResponse(
            job_id=uuid.uuid4(),
            tasks=[]
        )
        assert len(response.tasks) == 0
