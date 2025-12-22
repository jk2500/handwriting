"""
Tests for packages/core_converter/src/core_converter/latex_generation/generator.py
"""

import os
import tempfile

import pytest


class TestWrapLatexFragment:
    """Tests for wrap_latex_fragment function."""

    def test_wrap_simple_fragment(self):
        """Test wrapping a simple LaTeX fragment."""
        from packages.core_converter.src.core_converter.latex_generation.generator import wrap_latex_fragment
        
        fragment = "Hello, World!"
        result = wrap_latex_fragment(fragment)
        
        assert "\\documentclass{article}" in result
        assert "\\begin{document}" in result
        assert "\\end{document}" in result
        assert "Hello, World!" in result

    def test_wrap_with_math(self):
        """Test wrapping a fragment with math."""
        from packages.core_converter.src.core_converter.latex_generation.generator import wrap_latex_fragment
        
        fragment = "$E = mc^2$"
        result = wrap_latex_fragment(fragment)
        
        assert "$E = mc^2$" in result
        assert "\\usepackage{amsmath}" in result

    def test_does_not_wrap_full_document(self):
        """Test that full documents are not double-wrapped."""
        from packages.core_converter.src.core_converter.latex_generation.generator import wrap_latex_fragment
        
        full_doc = """\\documentclass{article}
\\begin{document}
Content
\\end{document}"""
        
        result = wrap_latex_fragment(full_doc)
        
        assert result == full_doc
        assert result.count("\\documentclass") == 1

    def test_custom_preamble(self):
        """Test wrapping with custom preamble."""
        from packages.core_converter.src.core_converter.latex_generation.generator import wrap_latex_fragment
        
        custom_preamble = "\\documentclass{book}\n\\usepackage{custom}"
        fragment = "Test"
        
        result = wrap_latex_fragment(fragment, preamble=custom_preamble)
        
        assert "\\documentclass{book}" in result
        assert "\\usepackage{custom}" in result

    def test_empty_fragment(self):
        """Test wrapping empty fragment."""
        from packages.core_converter.src.core_converter.latex_generation.generator import wrap_latex_fragment
        
        result = wrap_latex_fragment("")
        
        assert "\\begin{document}" in result
        assert "\\end{document}" in result

    def test_preserves_whitespace(self):
        """Test that internal whitespace is preserved."""
        from packages.core_converter.src.core_converter.latex_generation.generator import wrap_latex_fragment
        
        fragment = "Line 1\n\nLine 2\n\n\nLine 3"
        result = wrap_latex_fragment(fragment)
        
        assert "Line 1\n\nLine 2\n\n\nLine 3" in result


class TestSaveLatexToFile:
    """Tests for save_latex_to_file function."""

    def test_save_simple_content(self, temp_dir):
        """Test saving simple LaTeX content."""
        from packages.core_converter.src.core_converter.latex_generation.generator import save_latex_to_file
        
        content = "\\documentclass{article}\\begin{document}Test\\end{document}"
        output_path = os.path.join(temp_dir, "test.tex")
        
        result = save_latex_to_file(content, output_path)
        
        assert result is True
        assert os.path.exists(output_path)
        
        with open(output_path, "r") as f:
            saved_content = f.read()
        
        assert saved_content == content

    def test_save_creates_directories(self, temp_dir):
        """Test that save creates parent directories."""
        from packages.core_converter.src.core_converter.latex_generation.generator import save_latex_to_file
        
        content = "Test content"
        output_path = os.path.join(temp_dir, "nested", "deep", "dir", "test.tex")
        
        result = save_latex_to_file(content, output_path)
        
        assert result is True
        assert os.path.exists(output_path)

    def test_save_utf8_content(self, temp_dir):
        """Test saving content with UTF-8 characters."""
        from packages.core_converter.src.core_converter.latex_generation.generator import save_latex_to_file
        
        content = "Temperature: 25°C, Greek: αβγδ"
        output_path = os.path.join(temp_dir, "utf8.tex")
        
        result = save_latex_to_file(content, output_path)
        
        assert result is True
        
        with open(output_path, "r", encoding="utf-8") as f:
            saved_content = f.read()
        
        assert "25°C" in saved_content
        assert "αβγδ" in saved_content

    def test_save_overwrites_existing(self, temp_dir):
        """Test that save overwrites existing files."""
        from packages.core_converter.src.core_converter.latex_generation.generator import save_latex_to_file
        
        output_path = os.path.join(temp_dir, "overwrite.tex")
        
        save_latex_to_file("Original content", output_path)
        save_latex_to_file("New content", output_path)
        
        with open(output_path, "r") as f:
            content = f.read()
        
        assert content == "New content"

    def test_save_handles_io_error(self):
        """Test handling of IO errors."""
        from packages.core_converter.src.core_converter.latex_generation.generator import save_latex_to_file
        
        result = save_latex_to_file("content", "/root/definitely/not/allowed/test.tex")
        
        assert result is False

    def test_save_empty_content(self, temp_dir):
        """Test saving empty content."""
        from packages.core_converter.src.core_converter.latex_generation.generator import save_latex_to_file
        
        output_path = os.path.join(temp_dir, "empty.tex")
        
        result = save_latex_to_file("", output_path)
        
        assert result is True
        assert os.path.exists(output_path)
        
        with open(output_path, "r") as f:
            content = f.read()
        
        assert content == ""

    def test_save_large_content(self, temp_dir):
        """Test saving large content."""
        from packages.core_converter.src.core_converter.latex_generation.generator import save_latex_to_file
        
        large_content = "x" * (1024 * 1024)
        output_path = os.path.join(temp_dir, "large.tex")
        
        result = save_latex_to_file(large_content, output_path)
        
        assert result is True
        
        with open(output_path, "r") as f:
            saved_content = f.read()
        
        assert len(saved_content) == 1024 * 1024


class TestDefaultConstants:
    """Tests for default constants."""

    def test_default_preamble_has_required_packages(self):
        """Test default preamble includes required packages."""
        from packages.core_converter.src.core_converter.latex_generation.generator import DEFAULT_PREAMBLE
        
        assert "\\documentclass{article}" in DEFAULT_PREAMBLE
        assert "\\usepackage{amsmath}" in DEFAULT_PREAMBLE
        assert "\\usepackage{graphicx}" in DEFAULT_PREAMBLE

    def test_default_begin_document(self):
        """Test default begin document command."""
        from packages.core_converter.src.core_converter.latex_generation.generator import DEFAULT_BEGIN_DOCUMENT
        
        assert DEFAULT_BEGIN_DOCUMENT == "\\begin{document}"

    def test_default_end_document(self):
        """Test default end document command."""
        from packages.core_converter.src.core_converter.latex_generation.generator import DEFAULT_END_DOCUMENT
        
        assert DEFAULT_END_DOCUMENT == "\\end{document}"
