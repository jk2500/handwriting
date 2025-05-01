import time
import datetime
import uuid
import tempfile
import os
import subprocess
import re
from typing import List
from dotenv import load_dotenv
from PIL import Image
import shutil

# Change to absolute imports
from backend_api.celery_app import celery_app
from backend_api.database import SessionLocal, get_db
from backend_api import models

# Imports from external package - Assuming 'core_converter' is installed or in PYTHONPATH
# If core_converter is also part of this monorepo, adjust path as needed
from core_converter.pdf_processing.processor import render_pdf_pages_to_images
from core_converter.vlm_interaction.api_client import get_latex_from_image
from core_converter.latex_generation.generator import save_latex_to_file, wrap_latex_fragment

# Change to absolute imports
from backend_api.s3_utils import download_from_s3, upload_local_file_to_s3, S3_BUCKET_NAME, s3_client

# Helper function to parse descriptions
def parse_descriptions(text):
    descriptions = {}
    parts = re.split(r'\nPlaceholder:\s*', '\n' + text.strip())
    for part in parts:
         if not part.strip(): continue
         match = re.match(r"(STRUCTURE-\d+|DIAGRAM-\d+)\s*\nDescription:\s*(.*)", part, re.DOTALL)
         if match:
             placeholder_name = match.group(1).strip()
             description = match.group(2).strip()
             descriptions[placeholder_name] = description
         else:
             print(f"Warning: Could not parse description part: '{part[:50]}...'")
    return descriptions

@celery_app.task(bind=True)
def process_handwriting_conversion(self, job_id_str: str):
    """Celery task to process PDF -> Render -> VLM -> Initial TeX."""
    
    # Load .env - Path adjusted for new location
    try:
        # apps/backend_api/src/backend_api/tasks.py -> up 4 levels
        PROJECT_ROOT_FROM_TASK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
        DOTENV_PATH_FROM_TASK = os.path.join(PROJECT_ROOT_FROM_TASK, '.env')
        if os.path.exists(DOTENV_PATH_FROM_TASK):
            load_dotenv(dotenv_path=DOTENV_PATH_FROM_TASK, override=True)
            print(f"Task {self.request.id}: Successfully loaded .env from {DOTENV_PATH_FROM_TASK}")
        else:
            print(f"Task {self.request.id}: Warning - .env file not found at {DOTENV_PATH_FROM_TASK}")
    except Exception as load_err:
        print(f"Task {self.request.id}: Error loading .env - {load_err}")

    print(f"Starting conversion task for job ID: {job_id_str}")
    job_id = uuid.UUID(job_id_str)
    db = SessionLocal()
    job = None
    uploaded_page_image_s3_keys: List[str] = []
    try:
        job = db.query(models.Job).filter(models.Job.id == job_id).first()
        if not job:
            print(f"Error: Job ID {job_id} not found in database.")
            self.update_state(state='FAILURE', meta={'exc_type': 'JobNotFound', 'exc_message': f'Job {job_id} not found'})
            return f"Job {job_id} not found."

        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"Job {job_id}: Created temp dir {temp_dir}")

            print(f"Job {job_id}: Downloading input PDF from S3 path {job.input_pdf_s3_path}")
            pdf_content = download_from_s3(job.input_pdf_s3_path)
            if not pdf_content:
                raise Exception(f"Failed to download input PDF from S3 path: {job.input_pdf_s3_path}")
            temp_pdf_path = os.path.join(temp_dir, job.input_pdf_filename or "input.pdf")
            with open(temp_pdf_path, 'wb') as f: f.write(pdf_content)
            print(f"Job {job_id}: Input PDF saved to {temp_pdf_path}")

            job.status = models.JobStatus.RENDERING
            db.commit()
            print(f"Job {job_id}: Status set to RENDERING. Rendering PDF pages to images...")
            page_images_temp_dir = os.path.join(temp_dir, "page_images")
            os.makedirs(page_images_temp_dir, exist_ok=True)
            rendered_image_paths = render_pdf_pages_to_images(temp_pdf_path, page_images_temp_dir)
            if not rendered_image_paths:
                raise Exception("Failed to render PDF pages to images.")
            print(f"Job {job_id}: PDF rendered to {len(rendered_image_paths)} images in {page_images_temp_dir}")

            print(f"Job {job_id}: Uploading page images to S3...")
            page_image_s3_keys_map = {}
            for image_path in rendered_image_paths:
                try:
                    match = re.search(r"page_(\d+)\.png", os.path.basename(image_path))
                    if not match: continue
                    page_num = int(match.group(1))
                    s3_key = f"pages/{job_id}/page_{page_num}.png"
                    s3_client.upload_file(
                        Filename=image_path, Bucket=S3_BUCKET_NAME, Key=s3_key,
                        ExtraArgs={'ContentType': 'image/png'}
                    )
                    uploaded_page_image_s3_keys.append(s3_key)
                    page_image_s3_keys_map[page_num] = s3_key
                    print(f"  - Uploaded {image_path} to S3 key {s3_key}")
                except Exception as upload_err:
                    raise Exception(f"Failed to upload page image {os.path.basename(image_path)} to S3: {upload_err}") from upload_err
            print(f"Job {job_id}: Successfully uploaded {len(uploaded_page_image_s3_keys)} page images.")

            print(f"Job {job_id}: Storing page image paths in database...")
            page_image_records = []
            for page_num, s3_key in page_image_s3_keys_map.items():
                page_image_record = models.JobPageImage(job_id=job_id, page_number=page_num, s3_path=s3_key)
                page_image_records.append(page_image_record)
            if page_image_records:
                try:
                    db.add_all(page_image_records)
                    db.commit()
                    print(f"Job {job_id}: Successfully stored {len(page_image_records)} page image records in DB.")
                except Exception as db_err:
                    db.rollback()
                    raise Exception(f"Failed to store page image records in database: {db_err}") from db_err

            job.status = models.JobStatus.PROCESSING_VLM
            db.commit()
            print(f"Job {job_id}: Status set to PROCESSING_VLM. Calling VLM...")
            first_page_image_path = os.path.join(page_images_temp_dir, "page_0.png")
            if not os.path.exists(first_page_image_path):
                 if rendered_image_paths: first_page_image_path = rendered_image_paths[0]
                 else: raise Exception("No rendered images found, cannot proceed with VLM.") 
            print(f"Job {job_id}: Using first page image {first_page_image_path} for VLM input.")
            latex_content_fragment, descriptions_text = get_latex_from_image(first_page_image_path, model_name=job.model_used)
            if not latex_content_fragment or "DUMMY_LATEX_OUTPUT" in latex_content_fragment:
                 raise Exception(f"VLM processing failed or returned dummy content for model {job.model_used}.")
            print(f"Job {job_id}: VLM processing successful, received fragment and descriptions text.")

            print(f"Job {job_id}: Wrapping LaTeX fragment...")
            latex_content = wrap_latex_fragment(latex_content_fragment)
            print(f"Job {job_id}: LaTeX fragment wrapped successfully.")

            print(f"Job {job_id}: Parsing placeholder descriptions...")
            descriptions_mapping = parse_descriptions(descriptions_text)
            if descriptions_mapping:
                 print(f"Job {job_id}: Parsed {len(descriptions_mapping)} descriptions.")
                 job.segmentation_tasks = descriptions_mapping
                 db.commit()
                 print(f"Job {job_id}: Saved description mapping to database.")
            else:
                 print(f"Job {job_id}: No descriptions found or parsed from VLM output.")
                 job.segmentation_tasks = {}
                 db.commit()

            # Ensure TikZ package is included if tikzpicture is present
            if "\\begin{tikzpicture}" in latex_content and "\\usepackage{tikz}" not in latex_content:
                documentclass_match = re.search(r"\\documentclass(\[[^\]]*\])?\{[^\}]*\}", latex_content)
                if documentclass_match:
                    insert_pos = documentclass_match.end()
                    latex_content = latex_content[:insert_pos] + "\n\\usepackage{tikz}" + latex_content[insert_pos:]
                    print(f"Job {job_id}: Inserted \\usepackage{{tikz}} into LaTeX content.")
                else:
                    print(f"Job {job_id}: Warning - Could not find \\documentclass line. Prepending \\usepackage{{tikz}}.")
                    latex_content = "\\usepackage{tikz}\n" + latex_content

            # Save the initial LaTeX content (with placeholders) to a temp file
            temp_initial_tex_path = os.path.join(temp_dir, "initial.tex") # Renamed temp file
            if not save_latex_to_file(latex_content, temp_initial_tex_path):
                 raise Exception(f"Failed to save generated LaTeX to temporary file: {temp_initial_tex_path}")
            print(f"Job {job_id}: Initial LaTeX content saved to {temp_initial_tex_path}")

            # Upload the initial LaTeX file to S3
            initial_tex_s3_key = f"outputs/initial_tex/{job_id}.tex" # New S3 path convention
            initial_tex_s3_path_result = None
            try:
                print(f"Job {job_id}: Attempting to upload initial LaTeX file to S3 key {initial_tex_s3_key}")
                upload_result = upload_local_file_to_s3(temp_initial_tex_path, initial_tex_s3_key, content_type='text/plain')
                if upload_result:
                    initial_tex_s3_path_result = upload_result # upload_result is the s3_key on success
                    print(f"Job {job_id}: Successfully uploaded initial LaTeX to S3: {initial_tex_s3_path_result}")
                else:
                    raise Exception(f"upload_local_file_to_s3 failed for {temp_initial_tex_path}") # Added specific error
            except Exception as s3_err:
                 raise Exception(f"Failed to upload initial LaTeX file to S3: {s3_err}") from s3_err

            if not initial_tex_s3_path_result: raise Exception("Failed to upload initial LaTeX file to S3 (path not set).")

            # Update job record with initial TeX path
            job.initial_tex_s3_path = initial_tex_s3_path_result # Use the correct DB field
            # Clear any potential final paths from previous failed runs (optional but good practice)
            job.final_tex_s3_path = None
            job.final_pdf_s3_path = None
            job.completed_at = None
            job.error_message = None # Clear previous error
            db.commit()
            print(f"Job {job_id}: Updated database with initial TeX S3 path.")

            # --- REMOVED COMPILATION STEP --- 
            # The compilation to PDF and its upload are now handled by the separate compile_final_document task.

        # End of temp_dir block
        print(f"Job {job_id}: Temporary directory {temp_dir} cleaned up.")

        # Set final status based on whether segmentation is required
        if not job.segmentation_tasks:
            # No tasks found, segmentation is implicitly complete
            job.status = models.JobStatus.SEGMENTATION_COMPLETE
            print(f"Job {job_id}: No segmentation tasks found. Status set to SEGMENTATION_COMPLETE")
            final_message = f"Job {job_id} initial processing completed successfully. No segmentation needed."
        else:
            # Tasks exist, awaiting user segmentation
            job.status = models.JobStatus.AWAITING_SEGMENTATION # Keep existing final status for this phase
            print(f"Job {job_id}: Segmentation tasks found. Status set to AWAITING_SEGMENTATION")
            final_message = f"Job {job_id} initial processing completed successfully. Awaiting segmentation."
            
        job.updated_at = datetime.datetime.now(datetime.timezone.utc) # Update timestamp
        db.commit()
        # print(f"Job {job_id}: Status set to AWAITING_SEGMENTATION") # Removed old log
        return final_message # Use dynamic message

    except Exception as e:
        print(f"Error during task for job {job_id}: {e}")
        if job:
            job.status = models.JobStatus.FAILED
            job.error_message = str(e)[:500]
            db.commit()
        self.update_state(state='FAILURE', meta={'exc_type': type(e).__name__, 'exc_message': str(e)})
        
        if uploaded_page_image_s3_keys:
             print(f"Job {job_id}: Attempting cleanup of {len(uploaded_page_image_s3_keys)} uploaded page images due to failure...")
             try:
                 objects_to_delete = [{'Key': key} for key in uploaded_page_image_s3_keys]
                 s3_client.delete_objects(
                     Bucket=S3_BUCKET_NAME,
                     Delete={'Objects': objects_to_delete, 'Quiet': True}
                 )
                 print(f"Job {job_id}: Cleanup of page images from S3 completed.")
             except Exception as cleanup_err:
                 print(f"Job {job_id}: Error during S3 page image cleanup: {cleanup_err}")
                 
        return f"Job {job_id} failed: {e}"
    finally:
        if db:
            db.close() 

@celery_app.task(bind=True)
def compile_final_document(self, job_id_str: str):
    """Celery task to compile the final LaTeX document after segmentation."""
    print(f"Starting final compilation task for job ID: {job_id_str}")
    job_id = uuid.UUID(job_id_str)
    db = SessionLocal()
    job = None
    try:
        job = db.query(models.Job).filter(models.Job.id == job_id).first()
        if not job:
            print(f"Error: Job ID {job_id} not found in database.")
            self.update_state(state='FAILURE', meta={'exc_type': 'JobNotFound', 'exc_message': f'Job {job_id} not found'})
            return f"Job {job_id} not found."

        # Double-check status - should be COMPILATION_PENDING
        if job.status != models.JobStatus.COMPILATION_PENDING:
            print(f"Warning: Job {job_id} status is {job.status.value}, not COMPILATION_PENDING. Proceeding cautiously.")
            # Optionally update status again if it reverted somehow, or just proceed
            job.status = models.JobStatus.COMPILATION_PENDING
            db.commit()

        if not job.initial_tex_s3_path:
            raise ValueError("Initial TeX S3 path is missing for this job.")

        # Fetch segmentations and page images
        segmentations = db.query(models.Segmentation).filter(models.Segmentation.job_id == job_id).all()
        page_images_db = db.query(models.JobPageImage).filter(models.JobPageImage.job_id == job_id).all()
        page_images_map = {p.page_number: p for p in page_images_db}

        if not segmentations:
            print(f"Job {job_id}: No segmentations found. Proceeding with initial TeX file compilation.")
            # If no segmentations, the final tex/pdf will be the same as initial
            # We can just copy the paths and update status later if needed,
            # but let's compile it anyway for consistency for now.

        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"Job {job_id}: Created temp dir for final compilation: {temp_dir}")
            figures_dir = os.path.join(temp_dir, "figures")
            os.makedirs(figures_dir, exist_ok=True)

            # 1. Download Initial TeX
            print(f"Job {job_id}: Downloading initial TeX from {job.initial_tex_s3_path}")
            initial_tex_content_bytes = download_from_s3(job.initial_tex_s3_path)
            if not initial_tex_content_bytes:
                raise Exception(f"Failed to download initial TeX file: {job.initial_tex_s3_path}")
            initial_tex_path = os.path.join(temp_dir, "initial.tex")
            with open(initial_tex_path, 'wb') as f:
                f.write(initial_tex_content_bytes)
            initial_tex_content = initial_tex_content_bytes.decode('utf-8')

            # 2. Download Page Images and Crop Segmentations
            cropped_image_paths = {}
            for seg in segmentations:
                page_image_record = page_images_map.get(seg.page_number)
                if not page_image_record:
                    print(f"Warning: Could not find page image record for page {seg.page_number} needed by segmentation {seg.id}. Skipping.")
                    continue

                page_image_s3_path = page_image_record.s3_path
                page_image_filename = os.path.basename(page_image_s3_path)
                temp_page_image_path = os.path.join(temp_dir, page_image_filename)

                if not os.path.exists(temp_page_image_path):
                    print(f"Job {job_id}: Downloading page image {page_image_s3_path}")
                    page_image_bytes = download_from_s3(page_image_s3_path)
                    if not page_image_bytes:
                        print(f"Warning: Failed to download page image {page_image_s3_path}. Skipping segmentation {seg.id}.")
                        continue
                    with open(temp_page_image_path, 'wb') as f:
                        f.write(page_image_bytes)

                try:
                    with Image.open(temp_page_image_path) as img:
                        img_width, img_height = img.size
                        x1 = seg.x * img_width
                        y1 = seg.y * img_height
                        x2 = (seg.x + seg.width) * img_width
                        y2 = (seg.y + seg.height) * img_height
                        # Clamp coordinates
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(img_width, x2), min(img_height, y2)
                        if x1 >= x2 or y1 >= y2:
                             print(f"Warning: Invalid crop dimensions for segmentation {seg.label}. Skipping.")
                             continue
                        crop_box = (int(x1), int(y1), int(x2), int(y2))
                        cropped_img = img.crop(crop_box)
                        # Sanitize label for filename
                        safe_label = re.sub(r'[^a-zA-Z0-9_\-]', '_', seg.label)
                        cropped_filename = f"{safe_label}.png"
                        cropped_image_output_path = os.path.join(figures_dir, cropped_filename)
                        cropped_img.save(cropped_image_output_path, "PNG")
                        cropped_image_paths[seg.label] = f"figures/{cropped_filename}" # Relative path for LaTeX
                        print(f"  - Cropped {seg.label} from page {seg.page_number} to {cropped_image_output_path}")
                except Exception as crop_err:
                    print(f"Error cropping segmentation {seg.label}: {crop_err}")

            # 3. Modify LaTeX to include cropped images
            modified_tex_content = initial_tex_content
            for label, figure_path in cropped_image_paths.items():
                placeholder_comment = f"% PLACEHOLDER: {label}"
                figure_include_code = (
                    f"\\begin{{figure}}[htbp]\n"
                    f"  \\centering\n"
                    f"  \\includegraphics[width=0.8\\textwidth]{{{figure_path}}}\n"
                    # Placeholder caption/label - could potentially use descriptions from job.segmentation_tasks
                    f"  \\caption{{{label.replace('_', ' ')}}}\n"
                    f"  \\label{{fig:{label.lower()}}}\n"
                    f"\\end{{figure}}"
                )
                modified_tex_content = modified_tex_content.replace(placeholder_comment, figure_include_code)
                print(f"  - Replaced placeholder for {label} with figure include.")

            final_tex_path = os.path.join(temp_dir, "final.tex")
            with open(final_tex_path, 'w', encoding='utf-8') as f:
                f.write(modified_tex_content)
            print(f"Job {job_id}: Final LaTeX content saved to {final_tex_path}")

            # 4. Compile LaTeX
            output_pdf_filename = "final.pdf"
            temp_pdf_path = os.path.join(temp_dir, output_pdf_filename)
            compile_success = False
            compilation_log = ""
            try:
                # Run pdflatex twice for references/toc if needed
                for i in range(2):
                    print(f"Job {job_id}: Running pdflatex pass {i+1}...")
                    compile_cmd = ["pdflatex", "-interaction=nonstopmode", os.path.basename(final_tex_path)]
                    # Run without text=True, capture raw bytes
                    result = subprocess.run(
                        compile_cmd, 
                        cwd=temp_dir, 
                        capture_output=True, # Capture stdout/stderr as bytes
                        timeout=120
                    )
                    # Decode output manually, replacing errors
                    stdout_decoded = result.stdout.decode('utf-8', errors='replace')
                    stderr_decoded = result.stderr.decode('utf-8', errors='replace')
                    
                    # Check return code manually
                    if result.returncode != 0:
                        # Raise CalledProcessError manually if pdflatex failed
                        raise subprocess.CalledProcessError(
                            result.returncode, 
                            compile_cmd, 
                            output=stdout_decoded, 
                            stderr=stderr_decoded
                        )
                    print(f"Job {job_id}: pdflatex pass {i+1} successful.")
                
                if not os.path.exists(temp_pdf_path):
                    raise FileNotFoundError(f"pdflatex completed but output PDF not found at {temp_pdf_path}. Check logs.")
                compile_success = True
            except subprocess.CalledProcessError as cpe:
                # Read log file as bytes and decode with replacement
                error_log_content = "Log file not found or unreadable."
                log_path = os.path.join(temp_dir, "final.log")
                if os.path.exists(log_path):
                    try:
                        with open(log_path, 'rb') as log_f:
                            log_bytes = log_f.read()
                        full_log = log_bytes.decode('utf-8', errors='replace')
                        
                        # Try to find specific error lines
                        error_lines = [line for line in full_log.splitlines() if line.startswith('!') or "Error:" in line or "Warning:" in line]
                        if error_lines:
                            # Limit to last N error/warning lines if too many
                            error_log_content = "\n".join(error_lines[-15:]) 
                        else:
                             # Fallback to tail if no specific error lines found
                            error_log_content = full_log[-2000:] 
                    except Exception as log_err:
                        error_log_content = f"Error reading log file: {log_err}"
                        
                # Use stderr from the failed process if available and informative, otherwise use log content
                process_stderr = cpe.stderr if cpe.stderr else ""
                # Prioritize log content if it seems more useful than just stderr font messages
                error_detail = error_log_content if error_log_content != "Log file not found or unreadable." else process_stderr
                
                print(f"Error: pdflatex failed (exit code {cpe.returncode}). Details: ...{error_detail[-1000:]}") # Log last 1000 chars of detail
                job.status = models.JobStatus.FAILED
                job.error_message = f"pdflatex failed (code {cpe.returncode}). See logs. Details: ...{error_detail[-1000:]}" # Store truncated details
            except subprocess.TimeoutExpired:
                print(f"Error: pdflatex command timed out.")
                job.status = models.JobStatus.FAILED
                job.error_message = "pdflatex command timed out after 120 seconds."
            except FileNotFoundError as fnf_err:
                print(f"Error: pdflatex ran but PDF output missing: {fnf_err}")
                job.status = models.JobStatus.FAILED
                job.error_message = f"pdflatex ran but PDF output missing: {fnf_err}"
            except Exception as compile_err:
                print(f"Unexpected error during LaTeX compilation: {compile_err}")
                job.status = models.JobStatus.FAILED
                job.error_message = f"Unexpected compilation error: {compile_err}"

            # 5. Upload Results if Compilation Succeeded
            if compile_success:
                final_tex_s3_key = f"outputs/final_tex/{job_id}.tex"
                final_pdf_s3_key = f"outputs/final_pdf/{job_id}.pdf"
                try:
                    print(f"Job {job_id}: Uploading final TeX file to S3 key {final_tex_s3_key}")
                    tex_upload_result = upload_local_file_to_s3(final_tex_path, final_tex_s3_key, content_type='text/plain')
                    if not tex_upload_result:
                         raise Exception(f"Failed to upload final TeX file to {final_tex_s3_key}")
                    job.final_tex_s3_path = tex_upload_result

                    print(f"Job {job_id}: Uploading final PDF file to S3 key {final_pdf_s3_key}")
                    pdf_upload_result = upload_local_file_to_s3(temp_pdf_path, final_pdf_s3_key, content_type='application/pdf')
                    if not pdf_upload_result:
                        raise Exception(f"Failed to upload final PDF file to {final_pdf_s3_key}")
                    job.final_pdf_s3_path = pdf_upload_result

                    job.status = models.JobStatus.COMPILATION_COMPLETE
                    job.completed_at = datetime.datetime.now(datetime.timezone.utc)
                    job.error_message = None # Clear previous errors if any
                    print(f"Job {job_id}: Final compilation successful. Results uploaded.")
                except Exception as upload_err:
                    print(f"Error uploading final files to S3: {upload_err}")
                    job.status = models.JobStatus.FAILED
                    job.error_message = f"Failed to upload final files to S3: {upload_err}"
            else:
                # Status and error message should already be set by the exception handlers above
                print(f"Job {job_id}: Final compilation failed. See previous errors.")

        # End of temp dir block
        print(f"Job {job_id}: Temporary directory {temp_dir} cleaned up.")

        # Commit final job status
        db.commit()
        print(f"Job {job_id}: Final status ({job.status.value}) committed to database.")
        return f"Job {job_id} final compilation finished with status: {job.status.value}"

    except Exception as e:
        print(f"Critical error during final compilation task for job {job_id}: {e}")
        if job:
            job.status = models.JobStatus.FAILED
            job.error_message = f"Critical task error: {str(e)[:500]}"
            try:
                db.commit()
            except Exception as final_db_err:
                print(f"Failed to commit final FAILED status for job {job_id}: {final_db_err}")
                db.rollback()
        self.update_state(state='FAILURE', meta={'exc_type': type(e).__name__, 'exc_message': str(e)})
        return f"Job {job_id} failed critically during final compilation task."
    finally:
        if db: db.close()
        print(f"Final compilation task for job ID {job_id_str} finished.") 