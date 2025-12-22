"""
Integration tests for the API - testing multiple components together.
"""

import uuid
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

import pytest

from api import models


class TestJobWorkflow:
    """Integration tests for complete job workflows."""

    def test_complete_job_creation_workflow(self, client, mock_celery_task):
        """Test complete workflow from upload to job creation."""
        with patch("api.routers.upload.upload_to_s3") as mock_upload:
            mock_upload.return_value = "uploads/pdfs/test.pdf"
            
            files = {"file": ("test.pdf", b"%PDF-1.4 test", "application/pdf")}
            response = client.post("/upload/pdf", files=files)
            
            assert response.status_code == 202
            job_id = response.json()["job_id"]
            
            status_response = client.get(f"/jobs/{job_id}/status")
            assert status_response.status_code == 200
            assert status_response.json()["status"] == "pending"

    def test_job_status_transitions(self, client, db_session, sample_job):
        """Test job status transitions through the workflow."""
        sample_job.status = models.JobStatus.RENDERING
        db_session.commit()
        
        response = client.get(f"/jobs/{sample_job.id}/status")
        assert response.json()["status"] == "rendering"
        
        sample_job.status = models.JobStatus.PROCESSING_VLM
        db_session.commit()
        
        response = client.get(f"/jobs/{sample_job.id}/status")
        assert response.json()["status"] == "processing_vlm"
        
        sample_job.status = models.JobStatus.AWAITING_SEGMENTATION
        db_session.commit()
        
        response = client.get(f"/jobs/{sample_job.id}/status")
        assert response.json()["status"] == "awaiting_segmentation"

    def test_segmentation_to_compilation_workflow(self, client, db_session, sample_job_with_tex):
        """Test workflow from segmentation to compilation."""
        segmentations = [
            {
                "pageNumber": 0,
                "x": 0.1,
                "y": 0.1,
                "width": 0.2,
                "height": 0.2,
                "label": "DIAGRAM-1"
            }
        ]
        seg_response = client.post(
            f"/jobs/{sample_job_with_tex.id}/segmentations",
            json=segmentations
        )
        assert seg_response.status_code == 201
        
        with patch("api.routers.jobs.compile_final_document") as mock_compile:
            mock_compile.delay = MagicMock()
            
            compile_response = client.post(f"/jobs/{sample_job_with_tex.id}/compile")
            assert compile_response.status_code == 200
            
            mock_compile.delay.assert_called_once()

    def test_completed_job_file_access(self, client, sample_completed_job):
        """Test accessing files for completed job."""
        with patch("api.routers.jobs.download_from_s3") as mock_download:
            mock_download.return_value = b"file content"
            
            tex_response = client.get(f"/jobs/{sample_completed_job.id}/tex")
            assert tex_response.status_code == 200
            
            pdf_response = client.get(f"/jobs/{sample_completed_job.id}/pdf")
            assert pdf_response.status_code == 200


class TestErrorHandling:
    """Integration tests for error handling across components."""

    def test_s3_failure_during_upload(self, client):
        """Test handling S3 failure during upload."""
        with patch("api.routers.upload.upload_to_s3") as mock_upload:
            mock_upload.return_value = None
            
            files = {"file": ("test.pdf", b"%PDF-1.4", "application/pdf")}
            response = client.post("/upload/pdf", files=files)
            
            assert response.status_code == 500

    def test_s3_failure_during_download(self, client, sample_completed_job):
        """Test handling S3 failure during download."""
        with patch("api.routers.jobs.download_from_s3") as mock_download:
            mock_download.return_value = None
            
            response = client.get(f"/jobs/{sample_completed_job.id}/tex")
            
            assert response.status_code == 500

    def test_database_error_handling(self, client):
        """Test handling database errors."""
        with patch("api.routers.jobs.models.Job") as mock_model:
            mock_model.query.side_effect = Exception("Database error")
            
            response = client.get("/jobs")
            
            assert response.status_code == 500

    def test_invalid_uuid_handling(self, client):
        """Test handling invalid UUID in path."""
        response = client.get("/jobs/not-a-uuid/status")
        
        assert response.status_code == 422


class TestConcurrentOperations:
    """Tests for concurrent operations."""

    def test_multiple_job_creation(self, client, mock_celery_task):
        """Test creating multiple jobs concurrently."""
        with patch("api.routers.upload.upload_to_s3") as mock_upload:
            mock_upload.return_value = "uploads/pdfs/test.pdf"
            
            job_ids = []
            for i in range(5):
                files = {"file": (f"test_{i}.pdf", b"%PDF-1.4", "application/pdf")}
                response = client.post("/upload/pdf", files=files)
                assert response.status_code == 202
                job_ids.append(response.json()["job_id"])
            
            response = client.get("/jobs")
            assert response.status_code == 200
            assert len(response.json()) == 5

    def test_multiple_segmentations_same_job(self, client, sample_job_with_tex):
        """Test adding multiple segmentations to same job."""
        for i in range(3):
            segmentations = [
                {
                    "pageNumber": 0,
                    "x": 0.1 + (i * 0.2),
                    "y": 0.1,
                    "width": 0.1,
                    "height": 0.1,
                    "label": f"DIAGRAM-{i+1}"
                }
            ]
            response = client.post(
                f"/jobs/{sample_job_with_tex.id}/segmentations",
                json=segmentations
            )
            assert response.status_code == 201
        
        response = client.get(f"/jobs/{sample_job_with_tex.id}/segmentations")
        assert len(response.json()) == 3


class TestDataIntegrity:
    """Tests for data integrity across operations."""

    def test_job_data_persists(self, client, db_session, mock_celery_task):
        """Test that job data persists correctly."""
        with patch("api.routers.upload.upload_to_s3") as mock_upload:
            mock_upload.return_value = "uploads/pdfs/important.pdf"
            
            files = {"file": ("important.pdf", b"%PDF-1.4", "application/pdf")}
            data = {"model_name": "gpt-4o"}
            response = client.post("/upload/pdf", files=files, data=data)
            
            job_id = response.json()["job_id"]
        
        job = db_session.query(models.Job).filter_by(id=uuid.UUID(job_id)).first()
        assert job is not None
        assert job.input_pdf_filename == "important.pdf"
        assert job.model_used == "gpt-4o"

    def test_segmentation_data_integrity(self, client, sample_job_with_tex, db_session):
        """Test segmentation data is stored correctly."""
        segmentations = [
            {
                "pageNumber": 0,
                "x": 0.123456,
                "y": 0.234567,
                "width": 0.345678,
                "height": 0.456789,
                "label": "TEST-LABEL"
            }
        ]
        client.post(f"/jobs/{sample_job_with_tex.id}/segmentations", json=segmentations)
        
        stored = db_session.query(models.Segmentation).filter_by(
            job_id=sample_job_with_tex.id
        ).first()
        
        assert stored is not None
        assert abs(stored.x - 0.123456) < 0.0001
        assert abs(stored.y - 0.234567) < 0.0001
        assert stored.label == "TEST-LABEL"
