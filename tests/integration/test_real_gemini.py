"""
Integration tests for Google Gemini API.
These tests make real API calls and may incur costs.

Run with: pytest -m integration tests/integration/test_real_gemini.py
Skip with: pytest -m "not integration"
"""

import os
import pytest
from PIL import Image
import io

pytestmark = [
    pytest.mark.integration,
    pytest.mark.slow,
]

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
SKIP_REASON = "GOOGLE_API_KEY/GEMINI_API_KEY not set"


def has_valid_google_key():
    """Check if a valid Google API key is available."""
    if not GOOGLE_API_KEY:
        return False
    if GOOGLE_API_KEY in ("test-key", "your-key-here"):
        return False
    return True


def create_test_image(width=200, height=200) -> bytes:
    """Create a simple test image with shapes."""
    img = Image.new('RGB', (width, height), color='white')
    
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 80, 80], outline='black', width=2)
    draw.ellipse([100, 20, 180, 100], outline='black', width=2)
    draw.line([20, 150, 180, 150], fill='black', width=2)
    draw.text((50, 170), "Test", fill='black')
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()


@pytest.fixture
def test_image_bytes():
    """Generate a test image for enhancement."""
    return create_test_image()


@pytest.mark.skipif(not has_valid_google_key(), reason=SKIP_REASON)
class TestRealGeminiEnhancer:
    """Integration tests for Gemini image enhancement."""

    @pytest.mark.asyncio
    async def test_enhance_simple_diagram(self, test_image_bytes):
        """Test enhancing a simple diagram with real Gemini API."""
        from api.services.image_enhancer import GeminiEnhancer
        
        enhancer = GeminiEnhancer()
        
        result = await enhancer.enhance(
            test_image_bytes,
            "A simple diagram with a square, circle, and horizontal line"
        )
        
        assert result is not None
        assert len(result) > 0
        
        img = Image.open(io.BytesIO(result))
        assert img.size[0] > 0
        assert img.size[1] > 0

    @pytest.mark.asyncio
    async def test_enhance_with_description(self, test_image_bytes):
        """Test that description is used in enhancement."""
        from api.services.image_enhancer import GeminiEnhancer
        
        enhancer = GeminiEnhancer()
        
        result = await enhancer.enhance(
            test_image_bytes,
            "A bar chart showing quarterly sales data with labels Q1, Q2, Q3, Q4"
        )
        
        assert result is not None
        assert len(result) > 100

    @pytest.mark.asyncio
    async def test_enhance_returns_valid_image(self, test_image_bytes):
        """Test that enhanced image is a valid image format."""
        from api.services.image_enhancer import GeminiEnhancer
        
        enhancer = GeminiEnhancer()
        
        result = await enhancer.enhance(
            test_image_bytes,
            "A technical diagram"
        )
        
        img = Image.open(io.BytesIO(result))
        assert img.format in ('PNG', 'JPEG', 'WEBP')


@pytest.mark.skipif(not has_valid_google_key(), reason=SKIP_REASON)
class TestRealEnhanceImageFunctionGemini:
    """Integration tests for the enhance_image function with Gemini."""

    @pytest.mark.asyncio
    async def test_enhance_image_with_gemini_config(self, test_image_bytes):
        """Test enhance_image function with Gemini configured."""
        import api.services.image_enhancer as module
        module._enhancer_instance = None
        
        original_env = os.environ.get("IMAGE_ENHANCER")
        os.environ["IMAGE_ENHANCER"] = "gemini"
        
        try:
            from api.services.image_enhancer import enhance_image
            
            result = await enhance_image(
                test_image_bytes,
                "A flowchart showing a process"
            )
            
            assert result is not None
            assert len(result) > 0
        finally:
            if original_env:
                os.environ["IMAGE_ENHANCER"] = original_env
            else:
                os.environ.pop("IMAGE_ENHANCER", None)
            module._enhancer_instance = None
