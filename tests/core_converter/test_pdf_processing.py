"""
Tests for packages/core_converter/src/core_converter/pdf_processing/processor.py
"""

import os
import tempfile
from unittest.mock import patch, MagicMock

import pytest


class TestRenderPdfPagesToImages:
    """Tests for render_pdf_pages_to_images function."""

    def test_render_success(self, temp_dir, sample_pdf_content):
        """Test successful PDF rendering."""
        from packages.core_converter.src.core_converter.pdf_processing.processor import render_pdf_pages_to_images
        
        pdf_path = os.path.join(temp_dir, "test.pdf")
        output_dir = os.path.join(temp_dir, "output")
        
        with open(pdf_path, "wb") as f:
            f.write(sample_pdf_content)
        
        with patch("packages.core_converter.src.core_converter.pdf_processing.processor.fitz") as mock_fitz:
            mock_doc = MagicMock()
            mock_doc.page_count = 2
            mock_page = MagicMock()
            mock_pix = MagicMock()
            mock_pix.width = 100
            mock_pix.height = 100
            mock_pix.samples = b"\x00" * (100 * 100 * 3)
            mock_page.get_pixmap.return_value = mock_pix
            mock_doc.pages.return_value = [mock_page, mock_page]
            mock_fitz.open.return_value = mock_doc
            
            result = render_pdf_pages_to_images(pdf_path, output_dir)
            
            assert len(result) == 2
            mock_fitz.open.assert_called_once_with(pdf_path)
            mock_doc.close.assert_called_once()

    def test_render_file_not_found(self, temp_dir):
        """Test handling of file not found."""
        from packages.core_converter.src.core_converter.pdf_processing.processor import render_pdf_pages_to_images
        
        result = render_pdf_pages_to_images("/nonexistent/file.pdf", temp_dir)
        
        assert result == []

    def test_render_empty_pdf(self, temp_dir, sample_pdf_content):
        """Test handling of PDF with no pages."""
        from packages.core_converter.src.core_converter.pdf_processing.processor import render_pdf_pages_to_images
        
        pdf_path = os.path.join(temp_dir, "empty.pdf")
        output_dir = os.path.join(temp_dir, "output")
        
        with open(pdf_path, "wb") as f:
            f.write(sample_pdf_content)
        
        with patch("packages.core_converter.src.core_converter.pdf_processing.processor.fitz") as mock_fitz:
            mock_doc = MagicMock()
            mock_doc.page_count = 0
            mock_fitz.open.return_value = mock_doc
            
            result = render_pdf_pages_to_images(pdf_path, output_dir)
            
            assert result == []

    def test_render_creates_output_dir(self, temp_dir, sample_pdf_content):
        """Test that output directory is created if it doesn't exist."""
        from packages.core_converter.src.core_converter.pdf_processing.processor import render_pdf_pages_to_images
        
        pdf_path = os.path.join(temp_dir, "test.pdf")
        output_dir = os.path.join(temp_dir, "nested", "output", "dir")
        
        with open(pdf_path, "wb") as f:
            f.write(sample_pdf_content)
        
        with patch("packages.core_converter.src.core_converter.pdf_processing.processor.fitz") as mock_fitz:
            mock_doc = MagicMock()
            mock_doc.page_count = 1
            mock_page = MagicMock()
            mock_pix = MagicMock()
            mock_pix.width = 100
            mock_pix.height = 100
            mock_pix.samples = b"\x00" * (100 * 100 * 3)
            mock_page.get_pixmap.return_value = mock_pix
            mock_doc.pages.return_value = [mock_page]
            mock_fitz.open.return_value = mock_doc
            
            render_pdf_pages_to_images(pdf_path, output_dir)
            
            assert os.path.exists(output_dir)

    def test_render_custom_dpi(self, temp_dir, sample_pdf_content):
        """Test rendering with custom DPI."""
        from packages.core_converter.src.core_converter.pdf_processing.processor import render_pdf_pages_to_images
        
        pdf_path = os.path.join(temp_dir, "test.pdf")
        output_dir = os.path.join(temp_dir, "output")
        
        with open(pdf_path, "wb") as f:
            f.write(sample_pdf_content)
        
        with patch("packages.core_converter.src.core_converter.pdf_processing.processor.fitz") as mock_fitz:
            mock_doc = MagicMock()
            mock_doc.page_count = 1
            mock_page = MagicMock()
            mock_pix = MagicMock()
            mock_pix.width = 100
            mock_pix.height = 100
            mock_pix.samples = b"\x00" * (100 * 100 * 3)
            mock_page.get_pixmap.return_value = mock_pix
            mock_doc.pages.return_value = [mock_page]
            mock_fitz.open.return_value = mock_doc
            
            render_pdf_pages_to_images(pdf_path, output_dir, dpi=150)
            
            mock_page.get_pixmap.assert_called_with(dpi=150)

    def test_render_handles_exception(self, temp_dir, sample_pdf_content):
        """Test handling of exceptions during rendering."""
        from packages.core_converter.src.core_converter.pdf_processing.processor import render_pdf_pages_to_images
        
        pdf_path = os.path.join(temp_dir, "test.pdf")
        output_dir = os.path.join(temp_dir, "output")
        
        with open(pdf_path, "wb") as f:
            f.write(sample_pdf_content)
        
        with patch("packages.core_converter.src.core_converter.pdf_processing.processor.fitz") as mock_fitz:
            mock_fitz.open.side_effect = Exception("Rendering error")
            
            result = render_pdf_pages_to_images(pdf_path, output_dir)
            
            assert result == []


class TestRenderPdfToImage:
    """Tests for deprecated render_pdf_to_image function."""

    def test_deprecated_function_warns(self, temp_dir, sample_pdf_content):
        """Test that deprecated function prints warning."""
        from packages.core_converter.src.core_converter.pdf_processing.processor import render_pdf_to_image
        
        pdf_path = os.path.join(temp_dir, "test.pdf")
        output_path = os.path.join(temp_dir, "output.png")
        
        with open(pdf_path, "wb") as f:
            f.write(sample_pdf_content)
        
        with patch("packages.core_converter.src.core_converter.pdf_processing.processor.render_pdf_pages_to_images") as mock_render:
            mock_render.return_value = [os.path.join(temp_dir, "page_0.png")]
            
            with patch("os.path.join") as mock_join:
                mock_join.return_value = os.path.join(temp_dir, "page_0.png")
                
                with patch("os.rename"):
                    render_pdf_to_image(pdf_path, output_path)
                    
                    mock_render.assert_called_once()
