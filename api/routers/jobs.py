from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse, Response
import io
from sqlalchemy.orm import Session
import uuid
from typing import List
from fastapi import status
from celery import Celery
from PIL import Image
import re

from .. import models, schemas
from ..database import get_db
from ..s3_utils import download_from_s3_async, get_s3_presigned_url, upload_content_to_s3_async
from ..celery_utils import get_celery
from ..tasks import compile_final_document, compile_latex_preview, compile_latex_preview_with_images
from ..config import get_logger
from ..services.image_enhancer import enhance_image

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
        db_job.status = models.JobStatus.SEGMENTATION_COMPLETE
        db.commit()
        return []
    try:
        db.add_all(segmentation_objects)
        db_job.status = models.JobStatus.SEGMENTATION_COMPLETE
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
                 500: {"description": "Internal server error"},
                 504: {"description": "Compilation timed out"}
             })
async def generate_latex_preview(
    job_id: uuid.UUID,
    tex_content: str = Body(..., media_type="text/plain"), 
    db: Session = Depends(get_db)
):
    import base64
    
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")

    try:
        task = compile_latex_preview.delay(tex_content)
        result = task.get(timeout=90)
        
        if not result.get("success"):
            error_msg = result.get("error", "Unknown compilation error")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"LaTeX compilation failed.\n--- Error ---\n{error_msg}"
            )
        
        pdf_bytes = base64.b64decode(result["pdf_base64"])
        logger.debug(f"LaTeX compilation successful for job {job_id}")
        return Response(content=pdf_bytes, media_type="application/pdf")
        
    except HTTPException:
        raise
    except Exception as e:
        if "timeout" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="LaTeX compilation timed out."
            )
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
                 500: {"description": "Internal server error"},
                 504: {"description": "Compilation timed out"}
             })
async def generate_latex_preview_with_images(
    job_id: uuid.UUID,
    tex_content: str = Body(..., media_type="text/plain"), 
    db: Session = Depends(get_db)
):
    import base64
    
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")

    try:
        task = compile_latex_preview_with_images.delay(str(job_id), tex_content)
        result = task.get(timeout=90)
        
        if not result.get("success"):
            error_msg = result.get("error", "Unknown compilation error")
            return Response(
                content=error_msg,
                status_code=status.HTTP_400_BAD_REQUEST,
                media_type="text/plain"
            )
        
        pdf_bytes = base64.b64decode(result["pdf_base64"])
        return Response(content=pdf_bytes, media_type="application/pdf")
        
    except Exception as e:
        if "timeout" in str(e).lower():
            return Response(
                content="Compilation timed out",
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                media_type="text/plain"
            )
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


@router.post("/{job_id}/enhance", response_model=schemas.EnhanceResponse, tags=["Jobs", "Enhancement"])
async def enhance_segmentation(
    job_id: uuid.UUID,
    request: schemas.EnhanceRequest,
    db: Session = Depends(get_db)
):
    """Enhance a segmented image using AI to create a clean, professional version."""
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")
    
    segmentation = db.query(models.Segmentation).filter(
        models.Segmentation.job_id == job_id,
        models.Segmentation.label == request.label
    ).first()
    
    use_request_coords = request.page_number is not None and request.x is not None and request.y is not None and request.width is not None and request.height is not None
    
    if segmentation is None and not use_request_coords:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Segmentation with label '{request.label}' not found. Provide coordinates if not saved yet."
        )
    
    page_number = request.page_number if use_request_coords else segmentation.page_number
    seg_x = request.x if use_request_coords else segmentation.x
    seg_y = request.y if use_request_coords else segmentation.y
    seg_width = request.width if use_request_coords else segmentation.width
    seg_height = request.height if use_request_coords else segmentation.height
    
    page_image = db.query(models.JobPageImage).filter(
        models.JobPageImage.job_id == job_id,
        models.JobPageImage.page_number == page_number
    ).first()
    
    if page_image is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Page image for page {page_number} not found"
        )
    
    description = ""
    if db_job.segmentation_tasks and request.label in db_job.segmentation_tasks:
        description = db_job.segmentation_tasks[request.label]
    
    page_bytes = await download_from_s3_async(page_image.s3_path)
    if not page_bytes:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download page image"
        )
    
    try:
        with Image.open(io.BytesIO(page_bytes)) as img:
            img_width, img_height = img.size
            x1 = int(seg_x * img_width)
            y1 = int(seg_y * img_height)
            x2 = int((seg_x + seg_width) * img_width)
            y2 = int((seg_y + seg_height) * img_height)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(img_width, x2), min(img_height, y2)
            
            cropped = img.crop((x1, y1, x2, y2))
            
            crop_buffer = io.BytesIO()
            cropped.save(crop_buffer, format='PNG')
            cropped_bytes = crop_buffer.getvalue()
    except Exception as e:
        logger.exception(f"Error cropping image for enhancement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to crop image for enhancement"
        )
    
    original_s3_key = f"cropped/{job_id}/{request.label}.png"
    await upload_content_to_s3_async(
        content=cropped_bytes,
        s3_key=original_s3_key,
        content_type='image/png'
    )
    original_url = get_s3_presigned_url(original_s3_key)
    
    enhanced_url = ""
    enhanced_s3_key = ""
    enhancement_error = None
    try:
        enhanced_bytes = await enhance_image(cropped_bytes, description)
        
        enhanced_s3_key = f"enhanced/{job_id}/{request.label}.png"
        upload_result = await upload_content_to_s3_async(
            content=enhanced_bytes,
            s3_key=enhanced_s3_key,
            content_type='image/png'
        )
        
        if upload_result:
            enhanced_url = get_s3_presigned_url(enhanced_s3_key) or ""
            if segmentation:
                segmentation.enhanced_s3_path = enhanced_s3_key
                db.commit()
        else:
            enhancement_error = "Failed to upload enhanced image"
            enhanced_s3_key = ""
    except Exception as e:
        logger.exception(f"Error enhancing image: {e}")
        enhancement_error = str(e)
        enhanced_s3_key = ""
    
    if enhancement_error:
        logger.warning(f"Enhancement failed for {request.label}: {enhancement_error}")
    
    return schemas.EnhanceResponse(
        label=request.label,
        original_url=original_url or "",
        enhanced_url=enhanced_url,
        enhanced_s3_path=enhanced_s3_key,
        segmentation_id=segmentation.id if segmentation else None
    )


@router.patch("/{job_id}/segmentations/{segmentation_id}/use-enhanced", tags=["Jobs", "Enhancement"])
async def set_use_enhanced(
    job_id: uuid.UUID,
    segmentation_id: int,
    request: schemas.UseEnhancedRequest,
    db: Session = Depends(get_db)
):
    """Set whether to use the enhanced version of a segmentation."""
    segmentation = db.query(models.Segmentation).filter(
        models.Segmentation.id == segmentation_id,
        models.Segmentation.job_id == job_id
    ).first()
    
    if segmentation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segmentation not found"
        )
    
    if request.use_enhanced and not segmentation.enhanced_s3_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No enhanced image available for this segmentation"
        )
    
    segmentation.use_enhanced = request.use_enhanced
    db.commit()
    
    return {"message": "Updated successfully", "use_enhanced": segmentation.use_enhanced}
