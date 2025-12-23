"""
Tests for api/services/image_enhancer.py - Image enhancement service.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import base64

from api.services.image_enhancer import (
    ImageEnhancer,
    PlaceholderEnhancer,
    OpenAIEnhancer,
    GeminiEnhancer,
    get_image_enhancer,
    enhance_image,
)


class TestPlaceholderEnhancer:
    """Tests for PlaceholderEnhancer."""

    @pytest.mark.asyncio
    async def test_returns_original_image(self):
        """Test placeholder enhancer returns original image."""
        enhancer = PlaceholderEnhancer()
        original_bytes = b"test image data"
        
        result = await enhancer.enhance(original_bytes, "A test diagram")
        
        assert result == original_bytes

    @pytest.mark.asyncio
    async def test_handles_empty_description(self):
        """Test placeholder enhancer handles empty description."""
        enhancer = PlaceholderEnhancer()
        original_bytes = b"test image data"
        
        result = await enhancer.enhance(original_bytes, "")
        
        assert result == original_bytes


class TestOpenAIEnhancer:
    """Tests for OpenAIEnhancer."""

    def test_init_with_api_key(self):
        """Test initialization with provided API key."""
        enhancer = OpenAIEnhancer(api_key="test-key")
        assert enhancer.api_key == "test-key"

    def test_init_from_env(self):
        """Test initialization from environment variable."""
        with patch.dict("os.environ", {"OPENAI_API_KEY": "env-key"}):
            enhancer = OpenAIEnhancer()
            assert enhancer.api_key == "env-key"

    def test_init_raises_without_key(self):
        """Test initialization raises without API key."""
        with patch.dict("os.environ", {}, clear=True):
            with patch("os.getenv", return_value=None):
                with pytest.raises(ValueError, match="API key not provided"):
                    OpenAIEnhancer()

    @pytest.mark.asyncio
    async def test_enhance_calls_openai(self):
        """Test enhance calls OpenAI API correctly."""
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.data = [MagicMock(b64_json=base64.b64encode(b"enhanced").decode())]
        mock_client.images.edit.return_value = mock_result
        
        with patch("openai.OpenAI", return_value=mock_client):
            enhancer = OpenAIEnhancer(api_key="test-key")
            result = await enhancer.enhance(b"original", "A diagram")
            
            assert result == b"enhanced"
            mock_client.images.edit.assert_called_once()

    @pytest.mark.asyncio
    async def test_enhance_includes_description_in_prompt(self):
        """Test enhance includes description in the prompt."""
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.data = [MagicMock(b64_json=base64.b64encode(b"enhanced").decode())]
        mock_client.images.edit.return_value = mock_result
        
        with patch("openai.OpenAI", return_value=mock_client):
            enhancer = OpenAIEnhancer(api_key="test-key")
            await enhancer.enhance(b"original", "A bar chart showing sales")
            
            call_kwargs = mock_client.images.edit.call_args
            prompt = call_kwargs.kwargs.get("prompt", "")
            assert "bar chart showing sales" in prompt


class TestGeminiEnhancer:
    """Tests for GeminiEnhancer."""

    def test_init_with_api_key(self):
        """Test initialization with provided API key."""
        enhancer = GeminiEnhancer(api_key="test-key")
        assert enhancer.api_key == "test-key"

    def test_init_from_google_api_key_env(self):
        """Test initialization from GOOGLE_API_KEY env var."""
        with patch.dict("os.environ", {"GOOGLE_API_KEY": "google-key", "GEMINI_API_KEY": ""}):
            enhancer = GeminiEnhancer()
            assert enhancer.api_key == "google-key"

    def test_init_from_gemini_api_key_env(self):
        """Test initialization from GEMINI_API_KEY env var."""
        with patch.dict("os.environ", {"GOOGLE_API_KEY": "", "GEMINI_API_KEY": "gemini-key"}):
            enhancer = GeminiEnhancer()
            assert enhancer.api_key == "gemini-key"

    def test_init_raises_without_key(self):
        """Test initialization raises without API key."""
        with patch.dict("os.environ", {"GOOGLE_API_KEY": "", "GEMINI_API_KEY": ""}, clear=True):
            with pytest.raises(ValueError, match="API key not provided"):
                GeminiEnhancer()

    @pytest.mark.asyncio
    async def test_enhance_calls_gemini(self):
        """Test enhance calls Gemini API correctly."""
        from PIL import Image
        import io as std_io
        
        test_img = Image.new('RGB', (100, 100), color='white')
        buffer = std_io.BytesIO()
        test_img.save(buffer, format='PNG')
        test_image_bytes = buffer.getvalue()
        
        mock_client = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data.data = b"enhanced image data"
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content.parts = [mock_part]
        mock_client.models.generate_content.return_value = mock_response
        
        with patch("google.genai.Client", return_value=mock_client):
            enhancer = GeminiEnhancer(api_key="test-key")
            result = await enhancer.enhance(test_image_bytes, "A diagram")
            
            assert result == b"enhanced image data"
            mock_client.models.generate_content.assert_called_once()


class TestGetImageEnhancer:
    """Tests for get_image_enhancer factory function."""

    def test_returns_placeholder_by_default(self):
        """Test returns PlaceholderEnhancer when no config set."""
        import api.services.image_enhancer as module
        module._enhancer_instance = None
        
        with patch.dict("os.environ", {"IMAGE_ENHANCER": "placeholder"}):
            enhancer = get_image_enhancer()
            assert isinstance(enhancer, PlaceholderEnhancer)

    def test_returns_openai_when_configured(self):
        """Test returns OpenAIEnhancer when configured."""
        import api.services.image_enhancer as module
        module._enhancer_instance = None
        
        with patch.dict("os.environ", {"IMAGE_ENHANCER": "openai", "OPENAI_API_KEY": "test-key"}):
            enhancer = get_image_enhancer()
            assert isinstance(enhancer, OpenAIEnhancer)

    def test_returns_gemini_when_configured(self):
        """Test returns GeminiEnhancer when configured."""
        import api.services.image_enhancer as module
        module._enhancer_instance = None
        
        with patch.dict("os.environ", {"IMAGE_ENHANCER": "gemini", "GOOGLE_API_KEY": "test-key"}):
            enhancer = get_image_enhancer()
            assert isinstance(enhancer, GeminiEnhancer)

    def test_caches_instance(self):
        """Test enhancer instance is cached."""
        import api.services.image_enhancer as module
        module._enhancer_instance = None
        
        with patch.dict("os.environ", {"IMAGE_ENHANCER": "placeholder"}):
            enhancer1 = get_image_enhancer()
            enhancer2 = get_image_enhancer()
            assert enhancer1 is enhancer2


class TestEnhanceImageFunction:
    """Tests for enhance_image convenience function."""

    @pytest.mark.asyncio
    async def test_calls_enhancer(self):
        """Test enhance_image calls the configured enhancer."""
        import api.services.image_enhancer as module
        module._enhancer_instance = None
        
        with patch.dict("os.environ", {"IMAGE_ENHANCER": "placeholder"}):
            result = await enhance_image(b"original", "A diagram")
            assert result == b"original"

    @pytest.mark.asyncio
    async def test_passes_additional_context(self):
        """Test enhance_image passes additional context."""
        mock_enhancer = MagicMock()
        mock_enhancer.enhance = AsyncMock(return_value=b"enhanced")
        
        import api.services.image_enhancer as module
        module._enhancer_instance = mock_enhancer
        
        await enhance_image(b"original", "description", "extra context")
        
        mock_enhancer.enhance.assert_called_once_with(
            b"original", "description", "extra context"
        )
        
        module._enhancer_instance = None
