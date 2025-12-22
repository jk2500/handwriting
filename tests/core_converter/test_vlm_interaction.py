"""
Tests for packages/core_converter/src/core_converter/vlm_interaction/api_client.py
"""

import os
from unittest.mock import patch, MagicMock

import pytest


class TestGetLatexFromImage:
    """Tests for get_latex_from_image function."""

    def test_returns_dummy_when_no_api_key(self, temp_dir, sample_image_bytes):
        """Test returns dummy output when API key not set."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import (
            get_latex_from_image, DUMMY_LATEX_OUTPUT
        )
        
        image_path = os.path.join(temp_dir, "test.png")
        with open(image_path, "wb") as f:
            f.write(sample_image_bytes)
        
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=False):
            result, descriptions = get_latex_from_image(image_path)
            
            assert result == DUMMY_LATEX_OUTPUT
            assert descriptions == ""

    def test_returns_dummy_when_placeholder_key(self, temp_dir, sample_image_bytes):
        """Test returns dummy when placeholder API key used."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import (
            get_latex_from_image, DUMMY_LATEX_OUTPUT
        )
        
        image_path = os.path.join(temp_dir, "test.png")
        with open(image_path, "wb") as f:
            f.write(sample_image_bytes)
        
        with patch.dict(os.environ, {"OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE"}):
            result, descriptions = get_latex_from_image(image_path)
            
            assert result == DUMMY_LATEX_OUTPUT

    def test_file_not_found(self, temp_dir):
        """Test handles file not found."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import (
            get_latex_from_image, DUMMY_LATEX_OUTPUT
        )
        
        result, descriptions = get_latex_from_image("/nonexistent/image.png")
        
        assert result == DUMMY_LATEX_OUTPUT
        assert descriptions == ""

    def test_successful_api_call(self, temp_dir, sample_image_bytes):
        """Test successful API call."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import get_latex_from_image
        
        image_path = os.path.join(temp_dir, "test.png")
        with open(image_path, "wb") as f:
            f.write(sample_image_bytes)
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = """```latex
\\documentclass{article}
\\begin{document}
Test content
\\end{document}
```
Placeholder: DIAGRAM-1
Description: A test diagram.
"""
        
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            with patch("packages.core_converter.src.core_converter.vlm_interaction.api_client.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_response
                mock_openai.return_value = mock_client
                
                latex, descriptions = get_latex_from_image(image_path)
                
                assert "\\documentclass{article}" in latex
                assert "DIAGRAM-1" in descriptions

    def test_extracts_latex_from_code_block(self, temp_dir, sample_image_bytes):
        """Test extracts LaTeX from code block."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import get_latex_from_image
        
        image_path = os.path.join(temp_dir, "test.png")
        with open(image_path, "wb") as f:
            f.write(sample_image_bytes)
        
        latex_content = "\\documentclass{article}\\begin{document}Content\\end{document}"
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = f"```latex\n{latex_content}\n```\n"
        
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            with patch("packages.core_converter.src.core_converter.vlm_interaction.api_client.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_response
                mock_openai.return_value = mock_client
                
                result, _ = get_latex_from_image(image_path)
                
                assert result == latex_content

    def test_handles_no_latex_block(self, temp_dir, sample_image_bytes):
        """Test handles response without LaTeX block."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import (
            get_latex_from_image, DUMMY_LATEX_OUTPUT
        )
        
        image_path = os.path.join(temp_dir, "test.png")
        with open(image_path, "wb") as f:
            f.write(sample_image_bytes)
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "No LaTeX block here"
        
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            with patch("packages.core_converter.src.core_converter.vlm_interaction.api_client.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_response
                mock_openai.return_value = mock_client
                
                result, _ = get_latex_from_image(image_path)
                
                assert result == DUMMY_LATEX_OUTPUT

    def test_handles_api_error(self, temp_dir, sample_image_bytes):
        """Test handles API errors gracefully."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import (
            get_latex_from_image, DUMMY_LATEX_OUTPUT
        )
        
        image_path = os.path.join(temp_dir, "test.png")
        with open(image_path, "wb") as f:
            f.write(sample_image_bytes)
        
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            with patch("packages.core_converter.src.core_converter.vlm_interaction.api_client.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_client.chat.completions.create.side_effect = Exception("API Error")
                mock_openai.return_value = mock_client
                
                result, descriptions = get_latex_from_image(image_path)
                
                assert result == DUMMY_LATEX_OUTPUT
                assert descriptions == ""

    def test_uses_specified_model(self, temp_dir, sample_image_bytes):
        """Test uses specified model name."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import get_latex_from_image
        
        image_path = os.path.join(temp_dir, "test.png")
        with open(image_path, "wb") as f:
            f.write(sample_image_bytes)
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "```latex\n\\documentclass{article}\\end{document}\n```"
        
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            with patch("packages.core_converter.src.core_converter.vlm_interaction.api_client.OpenAI") as mock_openai:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_response
                mock_openai.return_value = mock_client
                
                get_latex_from_image(image_path, model_name="gpt-4o")
                
                call_args = mock_client.chat.completions.create.call_args
                assert call_args[1]["model"] == "gpt-4o"


class TestDummyLatexOutput:
    """Tests for DUMMY_LATEX_OUTPUT constant."""

    def test_dummy_output_is_valid_latex(self):
        """Test dummy output is valid LaTeX structure."""
        from packages.core_converter.src.core_converter.vlm_interaction.api_client import DUMMY_LATEX_OUTPUT
        
        assert "\\documentclass" in DUMMY_LATEX_OUTPUT
        assert "\\begin{document}" in DUMMY_LATEX_OUTPUT
        assert "\\end{document}" in DUMMY_LATEX_OUTPUT
