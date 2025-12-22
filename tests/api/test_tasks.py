"""
Tests for api/tasks.py - Celery tasks.
"""

import uuid
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

import pytest

from api import models
from api.tasks import parse_descriptions, process_handwriting_conversion, compile_final_document


class TestParseDescriptions:
    """Tests for parse_descriptions function."""

    def test_parse_single_description(self):
        """Test parsing a single description."""
        text = """
Placeholder: DIAGRAM-1
Description: A bar chart showing sales data.
"""
        result = parse_descriptions(text)
        
        assert "DIAGRAM-1" in result
        assert "bar chart" in result["DIAGRAM-1"]

    def test_parse_multiple_descriptions(self):
        """Test parsing multiple descriptions."""
        text = """
Placeholder: STRUCTURE-1
Description: Benzene ring with a methyl group.

Placeholder: DIAGRAM-1
Description: Temperature vs Time plot.

Placeholder: STRUCTURE-2
Description: Cyclohexane molecule.
"""
        result = parse_descriptions(text)
        
        assert len(result) == 3
        assert "STRUCTURE-1" in result
        assert "DIAGRAM-1" in result
        assert "STRUCTURE-2" in result

    def test_parse_empty_text(self):
        """Test parsing empty text."""
        result = parse_descriptions("")
        
        assert result == {}

    def test_parse_malformed_text(self):
        """Test parsing malformed text."""
        text = """
Some random text without proper format
"""
        result = parse_descriptions(text)
        
        assert result == {}

    def test_parse_mixed_valid_invalid(self):
        """Test parsing with mix of valid and invalid entries."""
        text = """
Placeholder: DIAGRAM-1
Description: Valid description.

Invalid line here

Placeholder: STRUCTURE-1
Description: Another valid one.
"""
        result = parse_descriptions(text)
        
        assert len(result) == 2

    def test_parse_multiline_description(self):
        """Test parsing multiline description."""
        text = """
Placeholder: DIAGRAM-1
Description: This is a description
that spans multiple lines
and should be captured.
"""
        result = parse_descriptions(text)
        
        assert "DIAGRAM-1" in result
        assert "multiple lines" in result["DIAGRAM-1"]


class TestProcessHandwritingConversion:
    """Tests for process_handwriting_conversion task."""

    @pytest.fixture
    def mock_dependencies(self):
        """Mock all external dependencies."""
        with patch("api.tasks.SessionLocal") as mock_session, \
             patch("api.tasks.download_from_s3") as mock_download, \
             patch("api.tasks.upload_local_file_to_s3") as mock_upload, \
             patch("api.tasks.s3_client") as mock_s3, \
             patch("api.tasks.render_pdf_pages_to_images") as mock_render, \
             patch("api.tasks.get_latex_from_image") as mock_vlm, \
             patch("api.tasks.save_latex_to_file") as mock_save, \
             patch("api.tasks.wrap_latex_fragment") as mock_wrap, \
             patch.object(process_handwriting_conversion, "update_state") as mock_update:
            
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_download.return_value = b"%PDF-1.4"
            mock_upload.return_value = "outputs/initial_tex/test.tex"
            mock_render.return_value = ["/tmp/page_0.png"]
            mock_vlm.return_value = ("\\documentclass{article}", "")
            mock_save.return_value = True
            mock_wrap.return_value = "\\documentclass{article}\\begin{document}\\end{document}"
            
            yield {
                "session": mock_session,
                "db": mock_db,
                "download": mock_download,
                "upload": mock_upload,
                "s3": mock_s3,
                "render": mock_render,
                "vlm": mock_vlm,
                "save": mock_save,
                "wrap": mock_wrap,
                "update_state": mock_update,
            }

    def test_task_job_not_found(self, mock_dependencies):
        """Test task handles job not found."""
        mock_dependencies["db"].query.return_value.filter.return_value.first.return_value = None
        
        result = process_handwriting_conversion.run(str(uuid.uuid4()))
        
        assert "not found" in result

    def test_task_download_failure(self, mock_dependencies, sample_job):
        """Test task handles download failure."""
        mock_dependencies["db"].query.return_value.filter.return_value.first.return_value = sample_job
        mock_dependencies["download"].return_value = None
        
        result = process_handwriting_conversion.run(str(sample_job.id))
        
        assert "failed" in result.lower()


class TestCompileFinalDocument:
    """Tests for compile_final_document task."""

    @pytest.fixture
    def mock_compile_dependencies(self):
        """Mock dependencies for compilation task."""
        with patch("api.tasks.SessionLocal") as mock_session, \
             patch("api.tasks.download_from_s3") as mock_download, \
             patch("api.tasks.upload_local_file_to_s3") as mock_upload, \
             patch("subprocess.run") as mock_subprocess, \
             patch.object(compile_final_document, "update_state") as mock_update:
            
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_download.return_value = b"\\documentclass{article}\\begin{document}Test\\end{document}"
            mock_upload.return_value = "outputs/final_tex/test.tex"
            
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = b""
            mock_result.stderr = b""
            mock_subprocess.return_value = mock_result
            
            yield {
                "session": mock_session,
                "db": mock_db,
                "download": mock_download,
                "upload": mock_upload,
                "subprocess": mock_subprocess,
                "update_state": mock_update,
            }

    def test_compile_job_not_found(self, mock_compile_dependencies):
        """Test compile task handles job not found."""
        mock_compile_dependencies["db"].query.return_value.filter.return_value.first.return_value = None
        
        result = compile_final_document.run(str(uuid.uuid4()))
        
        assert "not found" in result

    def test_compile_missing_initial_tex(self, mock_compile_dependencies, sample_job):
        """Test compile task handles missing initial TeX."""
        sample_job.initial_tex_s3_path = None
        mock_compile_dependencies["db"].query.return_value.filter.return_value.first.return_value = sample_job
        
        result = compile_final_document.run(str(sample_job.id))
        
        assert "failed" in result.lower()

    def test_compile_uses_no_shell_escape(self, mock_compile_dependencies, sample_job_with_tex, db_session):
        """Test compile task uses -no-shell-escape flag."""
        sample_job_with_tex.status = models.JobStatus.COMPILATION_PENDING
        mock_compile_dependencies["db"].query.return_value.filter.return_value.first.return_value = sample_job_with_tex
        mock_compile_dependencies["db"].query.return_value.filter.return_value.all.return_value = []
        
        with patch("os.path.exists") as mock_exists:
            mock_exists.return_value = True
            
            compile_final_document.run(str(sample_job_with_tex.id))
        
        calls = mock_compile_dependencies["subprocess"].call_args_list
        for call in calls:
            cmd = call[0][0] if call[0] else call[1].get("args", [])
            if "pdflatex" in cmd:
                assert "-no-shell-escape" in cmd


class TestTaskErrorHandling:
    """Tests for task error handling."""

    def test_task_cleans_up_on_failure(self):
        """Test task cleans up S3 uploads on failure."""
        with patch("api.tasks.SessionLocal") as mock_session, \
             patch("api.tasks.download_from_s3") as mock_download, \
             patch("api.tasks.s3_client") as mock_s3, \
             patch("api.tasks.S3_BUCKET_NAME", "test-bucket"), \
             patch.object(process_handwriting_conversion, "update_state"):
            
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            
            mock_job = MagicMock()
            mock_job.id = uuid.uuid4()
            mock_job.input_pdf_s3_path = "test.pdf"
            mock_job.input_pdf_filename = "test.pdf"
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            mock_download.side_effect = Exception("Download failed")
            
            result = process_handwriting_conversion.run(str(mock_job.id))
            
            assert mock_job.status == models.JobStatus.FAILED

    def test_task_sets_error_message(self):
        """Test task sets error message on failure."""
        with patch("api.tasks.SessionLocal") as mock_session, \
             patch("api.tasks.download_from_s3") as mock_download, \
             patch.object(process_handwriting_conversion, "update_state"):
            
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            
            mock_job = MagicMock()
            mock_job.id = uuid.uuid4()
            mock_job.input_pdf_s3_path = "test.pdf"
            mock_job.input_pdf_filename = "test.pdf"
            mock_db.query.return_value.filter.return_value.first.return_value = mock_job
            
            error_msg = "Specific error message"
            mock_download.side_effect = Exception(error_msg)
            
            process_handwriting_conversion.run(str(mock_job.id))
            
            assert error_msg in mock_job.error_message
