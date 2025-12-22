"""
Tests for API endpoints - jobs and upload routers.
"""

import io
import uuid
from unittest.mock import patch, MagicMock

import pytest
from fastapi import status

from api import models


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_endpoint(self, client):
        """Test root endpoint returns welcome message."""
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()


class TestUploadEndpoints:
    """Tests for /upload endpoints."""

    def test_upload_pdf_success(self, client, mock_s3_client, mock_celery_task):
        """Test successful PDF upload."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            with patch("api.s3_utils.upload_to_s3") as mock_upload:
                mock_upload.return_value = "uploads/pdfs/test.pdf"
                
                files = {"file": ("test.pdf", b"%PDF-1.4", "application/pdf")}
                response = client.post("/upload/pdf", files=files)
                
                assert response.status_code == 202
                data = response.json()
                assert "job_id" in data
                assert "status_url" in data
                assert data["message"] == "PDF accepted for processing."

    def test_upload_pdf_no_filename(self, client):
        """Test upload fails without filename."""
        files = {"file": ("", b"%PDF-1.4", "application/pdf")}
        response = client.post("/upload/pdf", files=files)
        
        assert response.status_code in [400, 422]

    def test_upload_pdf_wrong_content_type(self, client):
        """Test upload fails with wrong content type."""
        files = {"file": ("test.txt", b"text content", "text/plain")}
        response = client.post("/upload/pdf", files=files)
        
        assert response.status_code == 400
        assert "PDF" in response.json()["detail"]

    def test_upload_pdf_s3_failure(self, client):
        """Test upload fails when S3 upload fails."""
        with patch("api.routers.upload.upload_to_s3") as mock_upload:
            mock_upload.return_value = None
            
            files = {"file": ("test.pdf", b"%PDF-1.4", "application/pdf")}
            response = client.post("/upload/pdf", files=files)
            
            assert response.status_code == 500

    def test_upload_pdf_with_model_name(self, client, mock_s3_client, mock_celery_task):
        """Test upload with custom model name."""
        with patch("api.routers.upload.upload_to_s3") as mock_upload:
            mock_upload.return_value = "uploads/pdfs/test.pdf"
            
            files = {"file": ("test.pdf", b"%PDF-1.4", "application/pdf")}
            data = {"model_name": "gpt-4o"}
            response = client.post("/upload/pdf", files=files, data=data)
            
            assert response.status_code == 202


class TestJobsEndpoints:
    """Tests for /jobs endpoints."""

    def test_list_jobs_empty(self, client):
        """Test listing jobs when none exist."""
        response = client.get("/jobs")
        
        assert response.status_code == 200
        assert response.json() == []

    def test_list_jobs_with_data(self, client, sample_job):
        """Test listing jobs with existing data."""
        response = client.get("/jobs")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(sample_job.id)

    def test_list_jobs_pagination(self, client, db_session):
        """Test jobs list pagination."""
        for i in range(5):
            job = models.Job(
                id=uuid.uuid4(),
                input_pdf_filename=f"test_{i}.pdf",
                input_pdf_s3_path=f"uploads/test_{i}.pdf",
                status=models.JobStatus.PENDING,
            )
            db_session.add(job)
        db_session.commit()
        
        response = client.get("/jobs?skip=2&limit=2")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_job_status(self, client, sample_job):
        """Test getting job status."""
        response = client.get(f"/jobs/{sample_job.id}/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == str(sample_job.id)
        assert data["status"] == "pending"

    def test_get_job_status_not_found(self, client):
        """Test getting status of non-existent job."""
        fake_id = uuid.uuid4()
        response = client.get(f"/jobs/{fake_id}/status")
        
        assert response.status_code == 404

    def test_get_job_tex_awaiting_segmentation(self, client, sample_job_with_tex):
        """Test getting TeX for job awaiting segmentation."""
        with patch("api.routers.jobs.download_from_s3") as mock_download:
            mock_download.return_value = b"\\documentclass{article}"
            
            response = client.get(f"/jobs/{sample_job_with_tex.id}/tex")
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "text/plain; charset=utf-8"

    def test_get_job_tex_not_available(self, client, sample_job):
        """Test getting TeX when not available (job pending)."""
        response = client.get(f"/jobs/{sample_job.id}/tex")
        
        assert response.status_code == 409

    def test_get_job_tex_completed(self, client, sample_completed_job):
        """Test getting TeX for completed job."""
        with patch("api.routers.jobs.download_from_s3") as mock_download:
            mock_download.return_value = b"\\documentclass{article}"
            
            response = client.get(f"/jobs/{sample_completed_job.id}/tex")
            
            assert response.status_code == 200

    def test_get_job_pdf(self, client, sample_completed_job):
        """Test getting PDF for completed job."""
        with patch("api.routers.jobs.download_from_s3") as mock_download:
            mock_download.return_value = b"%PDF-1.4"
            
            response = client.get(f"/jobs/{sample_completed_job.id}/pdf")
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/pdf"

    def test_get_job_pdf_not_completed(self, client, sample_job_with_tex):
        """Test getting PDF when job not completed."""
        response = client.get(f"/jobs/{sample_job_with_tex.id}/pdf")
        
        assert response.status_code == 409

    def test_get_page_images(self, client, sample_job_with_tex, sample_page_images):
        """Test getting page images."""
        with patch("api.routers.jobs.get_s3_presigned_url") as mock_presign:
            mock_presign.return_value = "https://s3.example.com/presigned"
            
            response = client.get(f"/jobs/{sample_job_with_tex.id}/pages")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data["pages"]) == 3

    def test_get_page_images_not_found(self, client, sample_job):
        """Test getting page images when none exist."""
        response = client.get(f"/jobs/{sample_job.id}/pages")
        
        assert response.status_code == 404


class TestSegmentationEndpoints:
    """Tests for segmentation endpoints."""

    def test_get_segmentations_empty(self, client, sample_job_with_tex):
        """Test getting segmentations when none exist."""
        response = client.get(f"/jobs/{sample_job_with_tex.id}/segmentations")
        
        assert response.status_code == 200
        assert response.json() == []

    def test_get_segmentations_with_data(self, client, sample_job_with_tex, sample_segmentations):
        """Test getting existing segmentations."""
        response = client.get(f"/jobs/{sample_job_with_tex.id}/segmentations")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_create_segmentations(self, client, sample_job_with_tex):
        """Test creating segmentations."""
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
        response = client.post(
            f"/jobs/{sample_job_with_tex.id}/segmentations",
            json=segmentations
        )
        
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 1
        assert data[0]["label"] == "DIAGRAM-1"

    def test_create_segmentations_invalid_bounds(self, client, sample_job_with_tex):
        """Test creating segmentation with invalid bounds."""
        segmentations = [
            {
                "pageNumber": 0,
                "x": 0.9,
                "y": 0.1,
                "width": 0.5,
                "height": 0.2,
            }
        ]
        response = client.post(
            f"/jobs/{sample_job_with_tex.id}/segmentations",
            json=segmentations
        )
        
        assert response.status_code == 422

    def test_get_segmentation_tasks(self, client, sample_job_with_tex):
        """Test getting segmentation tasks."""
        response = client.get(f"/jobs/{sample_job_with_tex.id}/segmentation-tasks")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["tasks"]) == 1
        assert data["tasks"][0]["placeholder"] == "DIAGRAM-1"

    def test_get_segmentation_tasks_empty(self, client, sample_job):
        """Test getting segmentation tasks when none exist."""
        response = client.get(f"/jobs/{sample_job.id}/segmentation-tasks")
        
        assert response.status_code == 200
        data = response.json()
        assert data["tasks"] == []


class TestCompilationEndpoints:
    """Tests for compilation endpoints."""

    def test_trigger_compilation(self, client, sample_job_with_tex, db_session):
        """Test triggering compilation."""
        with patch("api.routers.jobs.compile_final_document") as mock_task:
            mock_task.delay = MagicMock()
            
            response = client.post(f"/jobs/{sample_job_with_tex.id}/compile")
            
            assert response.status_code == 200
            mock_task.delay.assert_called_once()

    def test_trigger_compilation_wrong_status(self, client, sample_job):
        """Test triggering compilation with wrong status."""
        response = client.post(f"/jobs/{sample_job.id}/compile")
        
        assert response.status_code == 400


class TestPreviewEndpoints:
    """Tests for preview endpoints."""

    def test_preview_no_latexmk(self, client, sample_job_with_tex):
        """Test preview fails when latexmk not found."""
        with patch("shutil.which") as mock_which:
            mock_which.return_value = None
            
            response = client.post(
                f"/jobs/{sample_job_with_tex.id}/preview",
                content="\\documentclass{article}\\begin{document}Test\\end{document}",
                headers={"Content-Type": "text/plain"}
            )
            
            assert response.status_code == 500
            assert "latexmk" in response.json()["detail"]


class TestUpdateTexEndpoint:
    """Tests for PUT /jobs/{job_id}/tex endpoint."""

    def test_update_tex_success(self, client, sample_job_with_tex):
        """Test successful TeX update."""
        with patch("api.routers.jobs.upload_content_to_s3") as mock_upload:
            mock_upload.return_value = "outputs/initial_tex/test.tex"
            
            response = client.put(
                f"/jobs/{sample_job_with_tex.id}/tex",
                content="\\documentclass{article}\\begin{document}Updated\\end{document}",
                headers={"Content-Type": "text/plain"}
            )
            
            assert response.status_code == 200
            assert "updated successfully" in response.json()["message"]

    def test_update_tex_not_found(self, client):
        """Test updating TeX for non-existent job."""
        fake_id = uuid.uuid4()
        response = client.put(
            f"/jobs/{fake_id}/tex",
            content="content",
            headers={"Content-Type": "text/plain"}
        )
        
        assert response.status_code == 404

    def test_update_tex_upload_failure(self, client, sample_job_with_tex):
        """Test TeX update when S3 upload fails."""
        with patch("api.routers.jobs.upload_content_to_s3") as mock_upload:
            mock_upload.return_value = None
            
            response = client.put(
                f"/jobs/{sample_job_with_tex.id}/tex",
                content="content",
                headers={"Content-Type": "text/plain"}
            )
            
            assert response.status_code == 500
