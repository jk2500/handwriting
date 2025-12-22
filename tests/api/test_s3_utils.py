"""
Tests for api/s3_utils.py - S3 utility functions.
"""

import io
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from botocore.exceptions import ClientError
from fastapi import UploadFile


class TestIsBucketConfigured:
    """Tests for _is_bucket_configured function."""

    def test_returns_false_when_bucket_not_set(self):
        """Test returns False when S3_BUCKET_NAME is not set."""
        with patch("api.s3_utils.S3_BUCKET_NAME", None):
            from api.s3_utils import _is_bucket_configured
            assert _is_bucket_configured() is False

    def test_returns_false_when_bucket_is_placeholder(self):
        """Test returns False when S3_BUCKET_NAME contains placeholder."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "your-bucket-placeholder"):
            from api.s3_utils import _is_bucket_configured
            assert _is_bucket_configured() is False

    def test_returns_true_when_bucket_configured(self):
        """Test returns True when S3_BUCKET_NAME is properly set."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "my-real-bucket"):
            from api.s3_utils import _is_bucket_configured
            assert _is_bucket_configured() is True


class TestUploadToS3:
    """Tests for upload_to_s3 function."""

    def test_upload_success(self, mock_s3_client):
        """Test successful file upload."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_to_s3
            
            mock_file = MagicMock(spec=UploadFile)
            mock_file.file = io.BytesIO(b"test content")
            mock_file.content_type = "application/pdf"
            
            result = upload_to_s3(mock_file, "test.pdf")
            
            assert result is not None
            assert "uploads/pdfs/" in result
            assert "test.pdf" in result

    def test_upload_returns_none_when_not_configured(self):
        """Test returns None when bucket not configured."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "placeholder"):
            from api.s3_utils import upload_to_s3
            
            mock_file = MagicMock(spec=UploadFile)
            result = upload_to_s3(mock_file, "test.pdf")
            
            assert result is None

    def test_upload_handles_client_error(self, mock_s3_client):
        """Test handles S3 ClientError."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_to_s3
            
            mock_s3_client.upload_fileobj.side_effect = ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
                "upload_fileobj"
            )
            
            mock_file = MagicMock(spec=UploadFile)
            mock_file.file = io.BytesIO(b"test content")
            mock_file.content_type = "application/pdf"
            
            result = upload_to_s3(mock_file, "test.pdf")
            
            assert result is None

    def test_upload_handles_generic_exception(self, mock_s3_client):
        """Test handles generic exceptions."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_to_s3
            
            mock_s3_client.upload_fileobj.side_effect = Exception("Network error")
            
            mock_file = MagicMock(spec=UploadFile)
            mock_file.file = io.BytesIO(b"test content")
            mock_file.content_type = "application/pdf"
            
            result = upload_to_s3(mock_file, "test.pdf")
            
            assert result is None


class TestUploadLocalFileToS3:
    """Tests for upload_local_file_to_s3 function."""

    def test_upload_local_file_success(self, mock_s3_client, temp_dir):
        """Test successful local file upload."""
        import os
        
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_local_file_to_s3
            
            test_file = os.path.join(temp_dir, "test.txt")
            with open(test_file, "w") as f:
                f.write("test content")
            
            result = upload_local_file_to_s3(test_file, "uploads/test.txt", "text/plain")
            
            assert result == "uploads/test.txt"
            mock_s3_client.upload_file.assert_called_once()

    def test_upload_local_file_not_found(self, mock_s3_client):
        """Test handles file not found."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_local_file_to_s3
            
            mock_s3_client.upload_file.side_effect = FileNotFoundError()
            
            result = upload_local_file_to_s3("/nonexistent/file.txt", "key")
            
            assert result is None

    def test_upload_local_file_without_content_type(self, mock_s3_client, temp_dir):
        """Test upload without content type."""
        import os
        
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_local_file_to_s3
            
            test_file = os.path.join(temp_dir, "test.txt")
            with open(test_file, "w") as f:
                f.write("test content")
            
            result = upload_local_file_to_s3(test_file, "uploads/test.txt")
            
            assert result == "uploads/test.txt"


class TestDownloadFromS3:
    """Tests for download_from_s3 function."""

    def test_download_success(self, mock_s3_client):
        """Test successful download."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import download_from_s3
            
            mock_body = MagicMock()
            mock_body.read.return_value = b"file content"
            mock_body.__enter__ = MagicMock(return_value=mock_body)
            mock_body.__exit__ = MagicMock(return_value=False)
            mock_s3_client.get_object.return_value = {"Body": mock_body}
            
            result = download_from_s3("test/key.txt")
            
            assert result == b"file content"

    def test_download_key_not_found(self, mock_s3_client):
        """Test handles NoSuchKey error."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import download_from_s3
            
            mock_s3_client.get_object.side_effect = ClientError(
                {"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}},
                "get_object"
            )
            
            result = download_from_s3("nonexistent/key.txt")
            
            assert result is None

    def test_download_access_denied(self, mock_s3_client):
        """Test handles AccessDenied error."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import download_from_s3
            
            mock_s3_client.get_object.side_effect = ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
                "get_object"
            )
            
            result = download_from_s3("private/key.txt")
            
            assert result is None

    def test_download_returns_none_when_not_configured(self):
        """Test returns None when bucket not configured."""
        with patch("api.s3_utils.S3_BUCKET_NAME", None):
            from api.s3_utils import download_from_s3
            
            result = download_from_s3("test/key.txt")
            
            assert result is None


class TestGetS3PresignedUrl:
    """Tests for get_s3_presigned_url function."""

    def test_generate_presigned_url_success(self, mock_s3_client):
        """Test successful presigned URL generation."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import get_s3_presigned_url
            
            mock_s3_client.generate_presigned_url.return_value = "https://s3.example.com/presigned"
            
            result = get_s3_presigned_url("test/key.txt")
            
            assert result == "https://s3.example.com/presigned"

    def test_generate_presigned_url_custom_expiration(self, mock_s3_client):
        """Test presigned URL with custom expiration."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import get_s3_presigned_url
            
            get_s3_presigned_url("test/key.txt", expiration_seconds=7200)
            
            call_args = mock_s3_client.generate_presigned_url.call_args
            assert call_args[1]["ExpiresIn"] == 7200

    def test_generate_presigned_url_handles_error(self, mock_s3_client):
        """Test handles ClientError during URL generation."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import get_s3_presigned_url
            
            mock_s3_client.generate_presigned_url.side_effect = ClientError(
                {"Error": {"Code": "InternalError", "Message": "Internal Error"}},
                "generate_presigned_url"
            )
            
            result = get_s3_presigned_url("test/key.txt")
            
            assert result is None


class TestUploadContentToS3:
    """Tests for upload_content_to_s3 function."""

    def test_upload_content_success(self, mock_s3_client):
        """Test successful content upload."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_content_to_s3
            
            result = upload_content_to_s3(b"test content", "test/key.txt", "text/plain")
            
            assert result == "test/key.txt"
            mock_s3_client.upload_fileobj.assert_called_once()

    def test_upload_content_without_content_type(self, mock_s3_client):
        """Test upload content without content type."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_content_to_s3
            
            result = upload_content_to_s3(b"test content", "test/key.txt")
            
            assert result == "test/key.txt"

    def test_upload_content_handles_client_error(self, mock_s3_client):
        """Test handles ClientError during upload."""
        with patch("api.s3_utils.S3_BUCKET_NAME", "test-bucket"):
            from api.s3_utils import upload_content_to_s3
            
            mock_s3_client.upload_fileobj.side_effect = ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
                "upload_fileobj"
            )
            
            result = upload_content_to_s3(b"test content", "test/key.txt")
            
            assert result is None
