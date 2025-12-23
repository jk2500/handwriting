"""
Tests for api/models.py - SQLAlchemy ORM models.
"""

import uuid
from datetime import datetime, timezone

import pytest

from api import models


class TestJobStatus:
    """Tests for JobStatus enum."""

    def test_all_statuses_exist(self):
        """Test all expected statuses are defined."""
        expected_statuses = [
            "PENDING", "RENDERING", "PROCESSING_VLM", "AWAITING_SEGMENTATION",
            "SEGMENTATION_COMPLETE", "COMPILATION_PENDING", "COMPILATION_COMPLETE",
            "COMPLETED", "FAILED"
        ]
        for status in expected_statuses:
            assert hasattr(models.JobStatus, status)

    def test_status_values(self):
        """Test status enum values."""
        assert models.JobStatus.PENDING.value == "pending"
        assert models.JobStatus.FAILED.value == "failed"
        assert models.JobStatus.COMPILATION_COMPLETE.value == "compilation_complete"


class TestJobModel:
    """Tests for Job model."""

    def test_create_job(self, db_session):
        """Test creating a job."""
        job = models.Job(
            id=uuid.uuid4(),
            input_pdf_filename="test.pdf",
            input_pdf_s3_path="uploads/test.pdf",
            status=models.JobStatus.PENDING,
        )
        db_session.add(job)
        db_session.commit()
        
        assert job.id is not None
        assert job.input_pdf_filename == "test.pdf"
        assert job.status == models.JobStatus.PENDING

    def test_job_default_status(self, db_session):
        """Test job default status is PENDING."""
        job = models.Job(
            id=uuid.uuid4(),
            input_pdf_filename="test.pdf",
            input_pdf_s3_path="uploads/test.pdf",
        )
        db_session.add(job)
        db_session.commit()
        
        assert job.status == models.JobStatus.PENDING

    def test_job_optional_fields(self, db_session):
        """Test job optional fields can be null."""
        job = models.Job(
            id=uuid.uuid4(),
            input_pdf_filename="test.pdf",
            input_pdf_s3_path="uploads/test.pdf",
        )
        db_session.add(job)
        db_session.commit()
        
        assert job.initial_tex_s3_path is None
        assert job.final_tex_s3_path is None
        assert job.final_pdf_s3_path is None
        assert job.model_used is None
        assert job.error_message is None
        assert job.completed_at is None
        assert job.segmentation_tasks is None

    def test_job_with_segmentation_tasks(self, db_session):
        """Test job with segmentation_tasks JSON field."""
        tasks = {"DIAGRAM-1": "A chart", "STRUCTURE-1": "A molecule"}
        job = models.Job(
            id=uuid.uuid4(),
            input_pdf_filename="test.pdf",
            input_pdf_s3_path="uploads/test.pdf",
            segmentation_tasks=tasks,
        )
        db_session.add(job)
        db_session.commit()
        db_session.refresh(job)
        
        assert job.segmentation_tasks == tasks

    def test_job_repr(self, sample_job):
        """Test job string representation."""
        repr_str = repr(sample_job)
        
        assert "Job" in repr_str
        assert str(sample_job.id) in repr_str
        assert "PENDING" in repr_str

    def test_job_page_images_relationship(self, db_session, sample_job):
        """Test job-page_images relationship."""
        page_image = models.JobPageImage(
            job_id=sample_job.id,
            page_number=0,
            s3_path="pages/page_0.png",
        )
        db_session.add(page_image)
        db_session.commit()
        db_session.refresh(sample_job)
        
        assert len(sample_job.page_images) == 1
        assert sample_job.page_images[0].page_number == 0

    def test_job_cascade_delete_page_images(self, db_session, sample_job):
        """Test page images are deleted when job is deleted."""
        page_image = models.JobPageImage(
            job_id=sample_job.id,
            page_number=0,
            s3_path="pages/page_0.png",
        )
        db_session.add(page_image)
        db_session.commit()
        
        page_image_id = page_image.id
        
        db_session.delete(sample_job)
        db_session.commit()
        
        result = db_session.query(models.JobPageImage).filter_by(id=page_image_id).first()
        assert result is None


class TestJobPageImageModel:
    """Tests for JobPageImage model."""

    def test_create_page_image(self, db_session, sample_job):
        """Test creating a page image."""
        page_image = models.JobPageImage(
            job_id=sample_job.id,
            page_number=0,
            s3_path="pages/page_0.png",
        )
        db_session.add(page_image)
        db_session.commit()
        
        assert page_image.id is not None
        assert page_image.job_id == sample_job.id
        assert page_image.page_number == 0

    def test_page_image_repr(self, db_session, sample_job):
        """Test page image string representation."""
        page_image = models.JobPageImage(
            job_id=sample_job.id,
            page_number=5,
            s3_path="pages/page_5.png",
        )
        db_session.add(page_image)
        db_session.commit()
        
        repr_str = repr(page_image)
        
        assert "JobPageImage" in repr_str
        assert "page=5" in repr_str

    def test_page_image_job_relationship(self, db_session, sample_job):
        """Test page image-job relationship."""
        page_image = models.JobPageImage(
            job_id=sample_job.id,
            page_number=0,
            s3_path="pages/page_0.png",
        )
        db_session.add(page_image)
        db_session.commit()
        db_session.refresh(page_image)
        
        assert page_image.job is not None
        assert page_image.job.id == sample_job.id


class TestSegmentationModel:
    """Tests for Segmentation model."""

    def test_create_segmentation(self, db_session, sample_job):
        """Test creating a segmentation."""
        seg = models.Segmentation(
            job_id=sample_job.id,
            page_number=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
            label="DIAGRAM-1",
        )
        db_session.add(seg)
        db_session.commit()
        
        assert seg.id is not None
        assert seg.x == 0.1
        assert seg.y == 0.2
        assert seg.width == 0.3
        assert seg.height == 0.4
        assert seg.label == "DIAGRAM-1"

    def test_segmentation_repr(self, db_session, sample_job):
        """Test segmentation string representation."""
        seg = models.Segmentation(
            job_id=sample_job.id,
            page_number=2,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
            label="STRUCTURE-1",
        )
        db_session.add(seg)
        db_session.commit()
        
        repr_str = repr(seg)
        
        assert "Segmentation" in repr_str
        assert "page=2" in repr_str
        assert "STRUCTURE-1" in repr_str

    def test_segmentation_job_relationship(self, db_session, sample_job):
        """Test segmentation-job relationship."""
        seg = models.Segmentation(
            job_id=sample_job.id,
            page_number=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
        )
        db_session.add(seg)
        db_session.commit()
        db_session.refresh(seg)
        
        assert seg.job is not None
        assert seg.job.id == sample_job.id

    def test_segmentation_cascade_delete_configured(self, db_session, sample_job):
        """Test segmentation cascade delete is configured correctly.
        
        Note: SQLite doesn't enforce foreign keys by default, so we test
        that the model is configured correctly instead of actual cascade.
        """
        fk = list(models.Segmentation.__table__.c.job_id.foreign_keys)[0]
        assert fk.ondelete == "CASCADE"

    def test_segmentation_nullable_label(self, db_session, sample_job):
        """Test segmentation with null label."""
        seg = models.Segmentation(
            job_id=sample_job.id,
            page_number=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
            label=None,
        )
        db_session.add(seg)
        db_session.commit()
        
        assert seg.label is None

    def test_segmentation_enhancement_fields(self, db_session, sample_job):
        """Test segmentation enhancement fields."""
        seg = models.Segmentation(
            job_id=sample_job.id,
            page_number=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
            label="DIAGRAM-1",
        )
        db_session.add(seg)
        db_session.commit()
        
        assert seg.enhanced_s3_path is None
        assert seg.use_enhanced is False

    def test_segmentation_with_enhanced_path(self, db_session, sample_job):
        """Test segmentation with enhanced S3 path."""
        seg = models.Segmentation(
            job_id=sample_job.id,
            page_number=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
            label="DIAGRAM-1",
            enhanced_s3_path="enhanced/job_id/DIAGRAM-1.png",
            use_enhanced=True,
        )
        db_session.add(seg)
        db_session.commit()
        db_session.refresh(seg)
        
        assert seg.enhanced_s3_path == "enhanced/job_id/DIAGRAM-1.png"
        assert seg.use_enhanced is True

    def test_segmentation_toggle_use_enhanced(self, db_session, sample_job):
        """Test toggling use_enhanced field."""
        seg = models.Segmentation(
            job_id=sample_job.id,
            page_number=0,
            x=0.1,
            y=0.2,
            width=0.3,
            height=0.4,
            label="DIAGRAM-1",
            enhanced_s3_path="enhanced/path.png",
            use_enhanced=False,
        )
        db_session.add(seg)
        db_session.commit()
        
        assert seg.use_enhanced is False
        
        seg.use_enhanced = True
        db_session.commit()
        db_session.refresh(seg)
        
        assert seg.use_enhanced is True
