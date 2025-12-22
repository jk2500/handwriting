from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse, Response
import io
import asyncio
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
import uuid
from typing import List
from fastapi import status
from celery import Celery
import tempfile
import subprocess
import os
import shutil
from PIL import Image
import re

_subprocess_executor = ThreadPoolExecutor(max_workers=2)

from .. import models, schemas
from ..database import get_db
from ..s3_utils import download_from_s3, download_from_s3_async, get_s3_presigned_url, upload_content_to_s3, upload_content_to_s3_async
from ..celery_utils import get_celery
from ..tasks import compile_final_document
from ..config import get_logger

logger = get_logger(__name__)

router = APIRouter(
    prefix="/jobs",
    tags=["Jobs"],
)

@router.get("/{job_id}/status", response_model=schemas.JobStatusResponse)
async def get_job_status(job_id: uuid.UUID, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return schemas.JobStatusResponse(
        job_id=db_job.id,
        status=db_job.status,
        error_message=db_job.error_message
    )

@router.get("", response_model=List[schemas.Job])
async def list_jobs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    try:
        jobs = db.query(models.Job).order_by(models.Job.created_at.desc()).offset(skip).limit(limit).all()
        logger.debug(f"Retrieved {len(jobs)} jobs")
        return jobs
    except Exception as e:
        logger.exception(f"Error in list_jobs: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{job_id}/tex")
async def get_job_tex(job_id: uuid.UUID, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    tex_s3_path: str | None = None
    file_description: str = ""

    if db_job.status == models.JobStatus.COMPILATION_COMPLETE:
        if db_job.final_tex_s3_path:
            tex_s3_path = db_job.final_tex_s3_path
            file_description = "Final TeX"
        else:
            if db_job.initial_tex_s3_path:
                tex_s3_path = db_job.initial_tex_s3_path
                file_description = "Initial TeX (Final missing)"
            else:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Final TeX path not found and no Initial TeX available.")

    elif db_job.status in [
        models.JobStatus.AWAITING_SEGMENTATION,
        models.JobStatus.SEGMENTATION_COMPLETE,
        models.JobStatus.COMPILATION_PENDING,
    ]:
        if db_job.initial_tex_s3_path:
            tex_s3_path = db_job.initial_tex_s3_path
            file_description = "Initial TeX"
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initial TeX file path not found for this job status.")
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"TeX file not available for current job status: '{db_job.status.value}'"
        )

    logger.info(f"Serving {file_description} for job {job_id}")
    tex_content_bytes = await download_from_s3_async(tex_s3_path)
    if tex_content_bytes is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retrieve {file_description} file from S3.")

    base_filename = db_job.input_pdf_filename.replace('.pdf', '') if db_job.input_pdf_filename else str(job_id)
    download_filename = f"{base_filename}_{file_description.lower().replace(' ', '_')}.tex"

    return StreamingResponse(
        io.BytesIO(tex_content_bytes),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=\"{download_filename}\""}
    )

@router.get("/{job_id}/pdf")
async def get_job_pdf(job_id: uuid.UUID, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if db_job.status != models.JobStatus.COMPILATION_COMPLETE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Final PDF not available. Current job status is '{db_job.status.value}'."
        )

    if not db_job.final_pdf_s3_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Final PDF file path not found for this completed job.")

    logger.info(f"Serving Final PDF for job {job_id}")
    pdf_content_bytes = await download_from_s3_async(db_job.final_pdf_s3_path)
    if pdf_content_bytes is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve final PDF file from S3.")

    base_filename = db_job.input_pdf_filename.replace('.pdf', '') if db_job.input_pdf_filename else str(job_id)
    download_filename = f"{base_filename}_final.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_content_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{download_filename}\""}
    )

@router.get("/{job_id}/pages", response_model=schemas.JobPageImagesResponse)
def get_page_images(job_id: uuid.UUID, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    job = db.query(models.Job).options(joinedload(models.Job.page_images)).filter(models.Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.page_images:
        raise HTTPException(status_code=404, detail="Rendered page images not found.")
    page_image_infos = []
    try:
        sorted_pages = sorted(job.page_images, key=lambda p: p.page_number)
        for page_image in sorted_pages:
            url = get_s3_presigned_url(page_image.s3_path)
            if not url:
                raise HTTPException(status_code=500, detail=f"Could not generate URL for page {page_image.page_number}.")
            page_image_infos.append(schemas.PageImageInfo(page_number=page_image.page_number, image_url=url))
    except Exception as e:
        logger.exception(f"Error retrieving page images for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving page image information.")
    return schemas.JobPageImagesResponse(job_id=job.id, pages=page_image_infos)

@router.get("/{job_id}/segmentations", response_model=List[schemas.Segmentation], tags=["Jobs", "Segmentations"])
async def get_segmentations(job_id: uuid.UUID, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")

    segmentations = db.query(models.Segmentation).filter(models.Segmentation.job_id == job_id).all()

    if not segmentations:
        return []

    return segmentations

@router.post("/{job_id}/segmentations", response_model=List[schemas.Segmentation], status_code=status.HTTP_201_CREATED, tags=["Jobs", "Segmentations"])
async def create_segmentations(job_id: uuid.UUID, segmentations_in: List[schemas.SegmentationCreate], db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")
    segmentation_objects = []
    for seg_in in segmentations_in:
        db_segmentation = models.Segmentation(job_id=job_id, **seg_in.model_dump())
        segmentation_objects.append(db_segmentation)
    if not segmentation_objects:
        return []
    try:
        db.add_all(segmentation_objects)
        db.commit()
        for seg in segmentation_objects:
            db.refresh(seg)
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to save segmentation data for job {job_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save segmentation data.")
    return segmentation_objects

@router.get("/{job_id}/segmentation-tasks", response_model=schemas.SegmentationTaskListResponse, tags=["Jobs", "Segmentations"])
async def get_segmentation_tasks(job_id: uuid.UUID, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")
    task_mapping = db_job.segmentation_tasks
    if task_mapping is None:
        tasks_list = []
    elif not isinstance(task_mapping, dict):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid format for segmentation data.")
    else:
        tasks_list = [schemas.SegmentationTaskItem(placeholder=name, description=desc) for name, desc in task_mapping.items()]
        tasks_list.sort(key=lambda item: (item.placeholder.startswith('DIAGRAM'), item.placeholder))
    return schemas.SegmentationTaskListResponse(job_id=job_id, tasks=tasks_list)

@router.post("/{job_id}/compile", response_model=schemas.Job, tags=["Jobs", "Compilation"])
async def trigger_final_compilation(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    celery_app: Celery = Depends(get_celery)
):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")

    if db_job.status not in [models.JobStatus.AWAITING_SEGMENTATION, models.JobStatus.SEGMENTATION_COMPLETE]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job status is '{db_job.status.value}'. Final compilation can only be triggered when status is 'awaiting_segmentation' or 'segmentation_complete'."
        )

    try:
        db_job.status = models.JobStatus.COMPILATION_PENDING
        db.commit()
        db.refresh(db_job)

        compile_final_document.delay(str(db_job.id))
        logger.info(f"Triggered final compilation for job {job_id}")

        return db_job
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to trigger final compilation for job {job_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to trigger final compilation.")

@router.post("/{job_id}/preview", tags=["Jobs", "Preview"], 
             responses={
                 200: {"content": {"application/pdf": {}}},
                 400: {"description": "LaTeX Compilation Error"},
                 404: {"description": "Job not found"},
                 500: {"description": "Internal server error or LaTeX compiler not found"}
             })
async def generate_latex_preview(
    job_id: uuid.UUID,
    tex_content: str = Body(..., media_type="text/plain"), 
    db: Session = Depends(get_db)
):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")

    if not shutil.which("latexmk"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LaTeX compiler (latexmk) not found on the server."
        )

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_file_path = os.path.join(temp_dir, "preview.tex")
        pdf_file_path = os.path.join(temp_dir, "preview.pdf")
        log_file_path = os.path.join(temp_dir, "preview.log")

        with open(temp_file_path, "w", encoding="utf-8") as f:
            f.write(tex_content)

        compile_command = [
            "latexmk",
            "-pdf",
            "-interaction=nonstopmode",
            "-file-line-error",
            "-no-shell-escape",
            "-output-directory=" + temp_dir,
            temp_file_path
        ]

        try:
            logger.debug(f"Running LaTeX compilation for job {job_id}")
            process = subprocess.run(
                compile_command, 
                capture_output=True, 
                text=True, 
                check=False,
                timeout=30
            )

            if process.returncode != 0 or not os.path.exists(pdf_file_path):
                logger.warning(f"LaTeX compilation failed for job {job_id} (return code: {process.returncode})")
                log_content = ""
                if os.path.exists(log_file_path):
                    with open(log_file_path, "r", encoding="utf-8", errors="ignore") as log_f:
                        log_content = log_f.read()[-2000:]
                else:
                    log_content = process.stderr or process.stdout or "No log file generated."
                
                log_content = log_content.replace(temp_dir, "[TEMP_DIR]")
                
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"LaTeX compilation failed.\n--- Log Tail ---\n{log_content}"
                )

            with open(pdf_file_path, "rb") as f:
                pdf_content = f.read()
            
            logger.debug(f"LaTeX compilation successful for job {job_id}")
            return Response(content=pdf_content, media_type="application/pdf")

        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LaTeX compilation timed out."
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Unexpected error during compilation for job {job_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred during compilation."
            )

@router.post("/{job_id}/preview-with-images", tags=["Jobs", "Preview"], 
             responses={
                 200: {"content": {"application/pdf": {}}},
                 400: {"description": "LaTeX Compilation Error"},
                 404: {"description": "Job not found"},
                 500: {"description": "Internal server error or LaTeX compiler not found"}
             })
async def generate_latex_preview_with_images(
    job_id: uuid.UUID,
    tex_content: str = Body(..., media_type="text/plain"), 
    db: Session = Depends(get_db)
):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")

    if not shutil.which("latexmk"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LaTeX compiler (latexmk) not found on the server"
        )

    with tempfile.TemporaryDirectory() as temp_dir:
        figures_dir = os.path.join(temp_dir, "figures")
        os.makedirs(figures_dir, exist_ok=True)
        
        segmentations = db.query(models.Segmentation).filter(
            models.Segmentation.job_id == job_id
        ).all()
        
        page_images = db.query(models.JobPageImage).filter(
            models.JobPageImage.job_id == job_id
        ).all()
        
        page_images_map = {p.page_number: p for p in page_images}
        
        for seg in segmentations:
            page_image_record = page_images_map.get(seg.page_number)
            if not page_image_record:
                continue

            page_image_s3_path = page_image_record.s3_path
            page_image_filename = os.path.basename(page_image_s3_path)
            temp_page_image_path = os.path.join(temp_dir, page_image_filename)

            page_image_bytes = await download_from_s3_async(page_image_s3_path)
            if not page_image_bytes:
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
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(img_width, x2), min(img_height, y2)
                    if x1 >= x2 or y1 >= y2:
                        continue
                    crop_box = (int(x1), int(y1), int(x2), int(y2))
                    cropped_img = img.crop(crop_box)
                    safe_label = re.sub(r'[^a-zA-Z0-9_\-]', '_', seg.label)
                    cropped_filename = f"{safe_label}.png"
                    cropped_image_output_path = os.path.join(figures_dir, cropped_filename)
                    cropped_img.save(cropped_image_output_path, "PNG")
            except Exception as crop_err:
                logger.warning(f"Error cropping segmentation {seg.label}: {crop_err}")

        tex_path = os.path.join(temp_dir, "preview.tex")
        with open(tex_path, 'w', encoding='utf-8') as f:
            f.write(tex_content)

        compile_cmd = [
            "latexmk", 
            "-pdf",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-no-shell-escape",
            "preview.tex"
        ]
        
        try:
            result = subprocess.run(
                compile_cmd,
                cwd=temp_dir,
                capture_output=True,
                timeout=30
            )
            
            pdf_path = os.path.join(temp_dir, "preview.pdf")
            
            if not os.path.exists(pdf_path):
                log_path = os.path.join(temp_dir, "preview.log")
                error_message = "Compilation failed - no output PDF generated"
                
                if os.path.exists(log_path):
                    with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
                        log_content = f.read()
                    
                    error_lines = [line for line in log_content.splitlines() 
                                 if line.startswith('!') or "Error:" in line]
                    if error_lines:
                        error_message = "\n".join(error_lines[:15])
                
                return Response(
                    content=error_message,
                    status_code=status.HTTP_400_BAD_REQUEST,
                    media_type="text/plain"
                )
            
            with open(pdf_path, 'rb') as f:
                pdf_content = f.read()
                
            return Response(
                content=pdf_content,
                media_type="application/pdf"
            )
            
        except subprocess.TimeoutExpired:
            return Response(
                content="Compilation timed out",
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                media_type="text/plain"
            )
            
        except Exception as e:
            logger.exception(f"Compilation error for job {job_id}: {e}")
            return Response(
                content="Compilation error",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                media_type="text/plain"
            )

@router.put("/{job_id}/tex", status_code=status.HTTP_200_OK)
async def update_job_tex(
    job_id: uuid.UUID,
    tex_content: str = Body(..., media_type="text/plain"),
    db: Session = Depends(get_db)
):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    
    tex_s3_path: str | None = None
    is_final_tex = False
    
    if db_job.status == models.JobStatus.COMPILATION_COMPLETE:
        if db_job.final_tex_s3_path:
            tex_s3_path = db_job.final_tex_s3_path
            is_final_tex = True
        else:
            if db_job.initial_tex_s3_path:
                tex_s3_path = db_job.initial_tex_s3_path
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No TeX paths found for this job."
                )
    else:
        if db_job.initial_tex_s3_path:
            tex_s3_path = db_job.initial_tex_s3_path
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Initial TeX file path not found for this job."
            )
    
    try:
        tex_content_bytes = tex_content.encode('utf-8')
        
        upload_result = await upload_content_to_s3_async(
            content=tex_content_bytes,
            s3_key=tex_s3_path,
            content_type='text/plain'
        )
        
        if not upload_result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload updated TeX content to S3."
            )
        
        if is_final_tex:
            db_job.status = models.JobStatus.SEGMENTATION_COMPLETE
            db_job.final_pdf_s3_path = None
            db.commit()
        
        logger.info(f"Updated TeX file for job {job_id}")
        return {"message": "TeX file updated successfully", "tex_path": tex_s3_path}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update TeX file for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update TeX file."
        )
