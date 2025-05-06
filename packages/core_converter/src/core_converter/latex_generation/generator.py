"""
Handles the generation and saving of LaTeX (.tex) files.
"""

import os

# Default LaTeX preamble and document structure
DEFAULT_PREAMBLE = r"""\documentclass{article}
\usepackage[utf8]{inputenc} % Crucial for UTF-8 characters like °
\usepackage{amsmath} % For math environments
\usepackage{graphicx} % Required for diagrams later, maybe?
\usepackage{amsfonts} % For math fonts
\usepackage{amssymb}  % For math symbols
% Add other common packages as needed
\setlength{\parindent}{0pt} % Optional: Remove paragraph indentation
"""

DEFAULT_BEGIN_DOCUMENT = r"\begin{document}"
DEFAULT_END_DOCUMENT = r"\end{document}"

def wrap_latex_fragment(fragment: str, preamble: str = DEFAULT_PREAMBLE, begin_doc: str = DEFAULT_BEGIN_DOCUMENT, end_doc: str = DEFAULT_END_DOCUMENT) -> str:
    r"""
    Wraps a LaTeX fragment with a standard preamble and document environment.

    Args:
        fragment: The LaTeX content fragment.
        preamble: The LaTeX preamble (defaults to DEFAULT_PREAMBLE).
        begin_doc: The \begin{document} command (defaults to DEFAULT_BEGIN_DOCUMENT).
        end_doc: The \end{document} command (defaults to DEFAULT_END_DOCUMENT).

    Returns:
        A string containing the full LaTeX document.
    """
    # Basic check to prevent wrapping if it already looks like a full doc
    if fragment.strip().startswith("\\documentclass"):
        print("Warning: Fragment already seems to be a full document. Returning as is.")
        return fragment
        
    return f"{preamble}\n\n{begin_doc}\n\n{fragment}\n\n{end_doc}"

def save_latex_to_file(latex_content: str, output_tex_path: str) -> bool:
    """
    Saves the provided LaTeX content string to a .tex file.

    Args:
        latex_content: The string containing the LaTeX code.
        output_tex_path: The desired path for the output .tex file.

    Returns:
        True if saving was successful, False otherwise.
    """
    try:
        # Ensure output directory exists
        output_dir = os.path.dirname(output_tex_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        with open(output_tex_path, 'w', encoding='utf-8') as f:
            f.write(latex_content)
        
        print(f"Successfully saved LaTeX content to '{output_tex_path}'")
        return True
        
    except IOError as e:
        print(f"Error saving LaTeX file to '{output_tex_path}': {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred during LaTeX file saving: {e}")
        return False 