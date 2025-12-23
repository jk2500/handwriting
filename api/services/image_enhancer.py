"""
Generic image enhancement service interface.
Implementations can use different models (GPT-4o+DALL-E, Gemini, etc.)
"""

import base64
import io
from abc import ABC, abstractmethod
from typing import Optional
from PIL import Image

from ..config import get_logger

logger = get_logger(__name__)


class ImageEnhancer(ABC):
    """Abstract base class for image enhancement services."""
    
    @abstractmethod
    async def enhance(
        self, 
        image: bytes, 
        description: str,
        additional_context: Optional[str] = None
    ) -> bytes:
        """
        Enhance/redraw an image based on description.
        
        Args:
            image: Original image bytes (cropped diagram/structure)
            description: Text description of what the image contains
            additional_context: Optional additional instructions
            
        Returns:
            Enhanced image bytes (PNG format)
        """
        pass


class PlaceholderEnhancer(ImageEnhancer):
    """
    Placeholder implementation that returns the original image.
    Replace with actual model implementation.
    """
    
    async def enhance(
        self, 
        image: bytes, 
        description: str,
        additional_context: Optional[str] = None
    ) -> bytes:
        logger.info(f"PlaceholderEnhancer called with description: {description[:100]}...")
        return image


class OpenAIEnhancer(ImageEnhancer):
    """
    OpenAI implementation using gpt-image-1 for image editing.
    Uses the original image as reference to generate a clean version.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        import os
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key not provided")
    
    async def enhance(
        self, 
        image: bytes, 
        description: str,
        additional_context: Optional[str] = None
    ) -> bytes:
        from openai import OpenAI
        import asyncio
        
        client = OpenAI(api_key=self.api_key)
        
        prompt = f"""Recreate this hand-drawn diagram as a clean, professional figure suitable for a LaTeX academic document.

Description: {description}

Requirements:
- Clean, minimalist style matching LaTeX/academic paper aesthetics
- Black lines on white background (standard for LaTeX figures)
- Preserve ALL text labels, values, and annotations exactly as shown
- Use clear geometric shapes and crisp lines
- Sans-serif or Computer Modern style fonts for any text
- High contrast, print-ready quality
- Maintain the exact same layout and spatial relationships
- No decorative elements - pure technical illustration style"""

        logger.info(f"Generating enhanced image with description: {description[:100]}...")
        
        def generate():
            image_file = io.BytesIO(image)
            image_file.name = "image.png"
            
            result = client.images.edit(
                model="gpt-image-1",
                image=image_file,
                prompt=prompt
            )
            return result
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, generate)
        
        image_base64 = result.data[0].b64_json
        enhanced_bytes = base64.b64decode(image_base64)
        
        logger.info("Successfully generated enhanced image")
        return enhanced_bytes


class GeminiEnhancer(ImageEnhancer):
    """
    Google Gemini implementation using gemini-2.5-flash for image generation.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        import os
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Google API key not provided")
    
    async def enhance(
        self, 
        image: bytes, 
        description: str,
        additional_context: Optional[str] = None
    ) -> bytes:
        from google import genai
        from PIL import Image as PILImage
        import asyncio
        
        client = genai.Client(api_key=self.api_key)
        
        input_image = PILImage.open(io.BytesIO(image))
        
        prompt = f"""Recreate this hand-drawn diagram as a clean, professional figure suitable for a LaTeX academic document.

Description: {description}

Requirements:
- Clean, minimalist style matching LaTeX/academic paper aesthetics
- Black lines on white background (standard for LaTeX figures)
- Preserve ALL text labels, values, and annotations exactly as shown
- Use clear geometric shapes and crisp lines
- Sans-serif or Computer Modern style fonts for any text
- High contrast, print-ready quality
- Maintain the exact same layout and spatial relationships
- No decorative elements - pure technical illustration style"""

        logger.info(f"Generating enhanced image with Gemini, description: {description[:100]}...")
        
        def generate():
            response = client.models.generate_content(
                model="gemini-3-pro-image-preview",
                contents=[prompt, input_image],
            )
            
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    return part.inline_data.data
            
            raise ValueError("No image returned from Gemini")
        
        loop = asyncio.get_event_loop()
        result_bytes = await loop.run_in_executor(None, generate)
        
        logger.info("Successfully generated enhanced image with Gemini")
        return result_bytes


_enhancer_instance: Optional[ImageEnhancer] = None


def get_image_enhancer() -> ImageEnhancer:
    """Get the configured image enhancer instance."""
    global _enhancer_instance
    
    if _enhancer_instance is None:
        import os
        enhancer_type = os.getenv("IMAGE_ENHANCER", "placeholder")
        
        if enhancer_type == "openai":
            _enhancer_instance = OpenAIEnhancer()
        elif enhancer_type == "gemini":
            _enhancer_instance = GeminiEnhancer()
        else:
            _enhancer_instance = PlaceholderEnhancer()
        
        logger.info(f"Initialized image enhancer: {type(_enhancer_instance).__name__}")
    
    return _enhancer_instance


async def enhance_image(
    image: bytes, 
    description: str,
    additional_context: Optional[str] = None
) -> bytes:
    """Convenience function to enhance an image using the configured enhancer."""
    enhancer = get_image_enhancer()
    return await enhancer.enhance(image, description, additional_context)
