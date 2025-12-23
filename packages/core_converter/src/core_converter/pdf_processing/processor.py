"""
Handles processing of PDF files, primarily rendering pages to images.
"""

import fitz  # PyMuPDF
import os
from PIL import Image
from typing import List # Import List

DEFAULT_DPI = 150

def render_pdf_pages_to_images(pdf_path: str, output_dir: str, dpi: int = DEFAULT_DPI) -> List[str]:
    """
    Renders *all* pages of a PDF to individual image files (PNG format, grayscale).

    Args:
        pdf_path: Path to the input PDF file.
        output_dir: Directory where the output PNG images will be saved.
        dpi: Resolution (dots per inch) for rendering the images.

    Returns:
        A list of paths to the generated image files if successful, an empty list otherwise.
    """
    generated_image_paths = []
    doc = None # Initialize doc to None
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)

        doc = fitz.open(pdf_path)
        
        if doc.page_count == 0:
            print(f"Error: PDF '{pdf_path}' has no pages.")
            return []

        print(f"Rendering {doc.page_count} pages from '{pdf_path}' to '{output_dir}'...")

        for i, page in enumerate(doc.pages()):
            output_image_path = os.path.join(output_dir, f"page_{i}.png") # 0-indexed page number
            
            # Render the page to a pixmap (image)
            pix = page.get_pixmap(dpi=dpi)
            
            # Convert pixmap to Pillow Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Convert to grayscale
            img_gray = img.convert('L')
            
            # Save the grayscale image as a PNG file
            img_gray.save(output_image_path, "PNG")
            generated_image_paths.append(output_image_path)
            print(f"  - Saved {output_image_path}")
        
        print(f"Successfully rendered {len(generated_image_paths)} pages.")
        
        doc.close()
        return generated_image_paths

    except FileNotFoundError:
        print(f"Error: Input PDF file not found at '{pdf_path}'")
        return []
    except Exception as e:
        print(f"An unexpected error occurred during PDF page rendering: {e}")
        if doc: # Check if doc was opened before error
            doc.close()
        return []

# Optional: Keep the old function signature for backward compatibility 
# if other parts of the code still use it, but point it to the new one 
# or mark it as deprecated.
# For now, we will replace its usage in the Celery task directly.

def render_pdf_to_image(pdf_path: str, output_image_path: str, dpi: int = DEFAULT_DPI) -> str | None:
    """
    DEPRECATED: Renders only the first page. Use render_pdf_pages_to_images instead.
    Retained temporarily for reference during transition.
    """
    print("WARNING: Calling deprecated render_pdf_to_image. Renders only the first page.")
    output_dir = os.path.dirname(output_image_path)
    base_name = os.path.basename(output_image_path)
    if not base_name:
        base_name = "page_0.png" # Default if only dir provided
        output_image_path = os.path.join(output_dir, base_name)
        
    try:
        # Call the new function, but only expect one result for page 0
        results = render_pdf_pages_to_images(pdf_path, output_dir, dpi)
        # Find the expected output file in the results (might be named slightly differently)
        expected_page_0_path = os.path.join(output_dir, "page_0.png")
        if expected_page_0_path in results:
             # If the new function created page_0.png, potentially rename it 
             # if the original output_image_path name was different
             if output_image_path != expected_page_0_path:
                 os.rename(expected_page_0_path, output_image_path)
                 print(f"  - Renamed {expected_page_0_path} to {output_image_path}")
             return output_image_path
        elif results: # If page_0.png wasn't created but others were, maybe return the first?
            print(f"Warning: Expected page_0.png not found, returning first rendered image: {results[0]}")
            return results[0] # Less ideal, but provides an image
        else:
            return None # No images rendered
    except Exception as e:
        print(f"Error in deprecated render_pdf_to_image wrapper: {e}")
        return None 