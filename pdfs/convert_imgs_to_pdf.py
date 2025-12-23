#!/usr/bin/env python3
"""
Convert all images in this directory to PDF files.
Each image becomes a separate PDF with the same name.
"""

from pathlib import Path
from PIL import Image


def convert_images_to_pdf():
    """Convert all PNG/JPG/JPEG images in the current directory to PDFs."""
    script_dir = Path(__file__).parent
    
    image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
    
    converted = 0
    for img_path in script_dir.iterdir():
        if img_path.suffix.lower() in image_extensions:
            pdf_path = img_path.with_suffix(".pdf")
            
            print(f"Converting: {img_path.name} -> {pdf_path.name}")
            
            img = Image.open(img_path)
            
            # Convert to RGB if necessary (PDF doesn't support RGBA)
            if img.mode in ("RGBA", "LA", "P"):
                # Create white background for transparent images
                background = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")
            
            img.save(pdf_path, "PDF", resolution=100.0)
            converted += 1
            
    print(f"\nDone! Converted {converted} image(s) to PDF.")


if __name__ == "__main__":
    convert_images_to_pdf()

