"""
Integration tests for AWS S3.
These tests make real S3 API calls.

Run with: pytest -m integration tests/integration/test_real_s3.py
Skip with: pytest -m "not integration"
"""

import os
import uuid
import pytest
from PIL import Image
import io

pytestmark = [
    pytest.mark.integration,
    pytest.mark.slow,
]

S3_BUCKET = os.getenv("S3_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION")
SKIP_REASON = "S3_BUCKET_NAME not configured or is placeholder"


def has_valid_s3_config():
    """Check if valid S3 configuration is available."""
    if not S3_BUCKET:
        return False
    if S3_BUCKET in ("test-bucket", "your-bucket-here"):
        return False
    return True


@pytest.fixture
def test_content():
    """Generate test content for upload."""
    return b"Test content for S3 integration test: " + uuid.uuid4().bytes


@pytest.fixture
def test_image_content():
    """Generate test image content."""
    img = Image.new('RGB', (50, 50), color='blue')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()


@pytest.fixture
def unique_key():
    """Generate a unique S3 key for testing."""
    return f"test-integration/{uuid.uuid4()}.txt"


@pytest.fixture
def unique_image_key():
    """Generate a unique S3 key for image testing."""
    return f"test-integration/{uuid.uuid4()}.png"


@pytest.mark.skipif(not has_valid_s3_config(), reason=SKIP_REASON)
class TestRealS3Upload:
    """Integration tests for S3 upload operations."""

    @pytest.mark.asyncio
    async def test_upload_content_to_s3(self, test_content, unique_key):
        """Test uploading content to real S3."""
        from api.s3_utils import upload_content_to_s3_async, download_from_s3_async
        
        result = await upload_content_to_s3_async(
            content=test_content,
            s3_key=unique_key,
            content_type='text/plain'
        )
        
        assert result == unique_key
        
        downloaded = await download_from_s3_async(unique_key)
        assert downloaded == test_content

    @pytest.mark.asyncio
    async def test_upload_image_to_s3(self, test_image_content, unique_image_key):
        """Test uploading image to real S3."""
        from api.s3_utils import upload_content_to_s3_async, download_from_s3_async
        
        result = await upload_content_to_s3_async(
            content=test_image_content,
            s3_key=unique_image_key,
            content_type='image/png'
        )
        
        assert result == unique_image_key
        
        downloaded = await download_from_s3_async(unique_image_key)
        assert downloaded == test_image_content
        
        img = Image.open(io.BytesIO(downloaded))
        assert img.size == (50, 50)


@pytest.mark.skipif(not has_valid_s3_config(), reason=SKIP_REASON)
class TestRealS3PresignedUrl:
    """Integration tests for S3 presigned URLs."""

    @pytest.mark.asyncio
    async def test_generate_presigned_url(self, test_content, unique_key):
        """Test generating presigned URL for real S3 object."""
        from api.s3_utils import upload_content_to_s3_async, get_s3_presigned_url
        import httpx
        
        await upload_content_to_s3_async(
            content=test_content,
            s3_key=unique_key,
            content_type='text/plain'
        )
        
        url = get_s3_presigned_url(unique_key, expiration_seconds=300)
        
        assert url is not None
        assert unique_key.split('/')[-1] in url
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            assert response.status_code == 200
            assert response.content == test_content


@pytest.mark.skipif(not has_valid_s3_config(), reason=SKIP_REASON)
class TestRealS3Download:
    """Integration tests for S3 download operations."""

    @pytest.mark.asyncio
    async def test_download_nonexistent_key(self):
        """Test downloading non-existent key returns None."""
        from api.s3_utils import download_from_s3_async
        
        result = await download_from_s3_async(f"nonexistent/{uuid.uuid4()}.txt")
        
        assert result is None
