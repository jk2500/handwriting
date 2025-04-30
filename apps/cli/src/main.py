"""
Main script to run the Handwritten PDF to LaTeX conversion process.
"""

import argparse
import os
import time

# Import functions from our modules (now using the installable package)
from core_converter.pdf_processing.processor import render_pdf_to_image
from core_converter.vlm_interaction.api_client import get_latex_from_image
from core_converter.latex_generation.generator import save_latex_to_file

# Define base directories relative to this script location
# This assumes main.py is in apps/cli/src/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DEFAULT_OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'output_latex')
DEFAULT_IMAGE_DIR = os.path.join(PROJECT_ROOT, 'output_images') # For intermediate images
DEFAULT_MODEL = "o4-mini"

def main(pdf_path: str, output_dir: str, models_to_run: list[str]):
    """Runs the main conversion pipeline for one or more models."""
    print(f"Starting conversion process for: {pdf_path}")
    print(f"Models to run: {', '.join(models_to_run)}")
    overall_start_time = time.time()

    # --- 1. Define Base Paths & Render PDF (Done once) ---
    pdf_filename = os.path.basename(pdf_path)
    base_filename = os.path.splitext(pdf_filename)[0]
    
    os.makedirs(DEFAULT_IMAGE_DIR, exist_ok=True)
    image_output_path = os.path.join(DEFAULT_IMAGE_DIR, f"{base_filename}_page0.png")
    
    print("\nStep 1: Rendering PDF to image (once for all models)...")
    generated_image_path = render_pdf_to_image(pdf_path, image_output_path)
    
    if not generated_image_path:
        print("Failed to render PDF to image. Exiting.")
        return

    # --- Loop Through Models --- 
    all_success = True
    for model_name in models_to_run:
        model_start_time = time.time()
        print(f"\n===== Processing Model: {model_name} =====")

        # --- 2. Get LaTeX from Image (via VLM) ---
        print(f"Step 2: Sending image to {model_name} for LaTeX conversion...")
        latex_result = get_latex_from_image(generated_image_path, model_name=model_name)
        
        if not latex_result:
            print(f"Failed to get LaTeX from {model_name} (or placeholder failed). Skipping model.")
            all_success = False
            continue # Move to the next model

        # --- 3. Save LaTeX to File ---
        # Modify output filename to include model name
        os.makedirs(output_dir, exist_ok=True)
        tex_output_path = os.path.join(output_dir, f"test_{model_name}.tex")
        
        print(f"Step 3: Saving generated LaTeX content for {model_name}...")
        success = save_latex_to_file(latex_result, tex_output_path)
        if success:
            print(f"Output LaTeX file for {model_name} saved to: {tex_output_path}")
        else:
            print(f"Failed to save the LaTeX file for {model_name}.")
            all_success = False
        
        model_end_time = time.time()
        print(f"===== Finished processing {model_name} in {model_end_time - model_start_time:.2f} seconds =====")

    # --- 4. Clean up and Final Report ---
    # Optionally delete intermediate image after all models are processed
    # if all_success: # Or maybe always delete if it exists?
    #     try:
    #         os.remove(generated_image_path)
    #         print(f"\nCleaned up intermediate image: {generated_image_path}")
    #     except OSError as e:
    #         print(f"\nWarning: Could not delete intermediate image {generated_image_path}: {e}")

    overall_end_time = time.time()
    print(f"\nOverall conversion process finished in {overall_end_time - overall_start_time:.2f} seconds.")
    if not all_success:
        print("Note: One or more models failed during processing.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert a handwritten PDF (first page) to LaTeX files using one or more OpenAI models.")
    parser.add_argument("pdf_path", help="Path to the input PDF file.")
    parser.add_argument("-o", "--output-dir", default=DEFAULT_OUTPUT_DIR, 
                        help=f"Directory to save the output .tex files (defaults to: {DEFAULT_OUTPUT_DIR})")
    parser.add_argument("-m", "--models", default=DEFAULT_MODEL, 
                        help=f"Comma-separated list of OpenAI model names to use (e.g., 'gpt-4-vision-preview,gpt-4o'). Defaults to: {DEFAULT_MODEL}")
    
    args = parser.parse_args()
    
    # Split the comma-separated models string into a list
    models_list = [model.strip() for model in args.models.split(',') if model.strip()]

    if not models_list:
        print("Error: No valid models specified.")
    elif not os.path.isfile(args.pdf_path):
        print(f"Error: Input PDF file not found at '{args.pdf_path}'")
    else:
        main(args.pdf_path, args.output_dir, models_list)
