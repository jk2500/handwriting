from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io
from sqlalchemy.orm import Session
import uuid
from typing import List
from fastapi import status
from celery import Celery

# Change to absolute imports
from backend_api import models, schemas
from backend_api.database import get_db
from backend_api.s3_utils import download_from_s3, get_s3_presigned_url
from backend_api.celery_utils import get_celery # Assuming this exists
# Import the task (we will create this later)
from backend_api.tasks import compile_final_document

router = APIRouter(
    prefix="/jobs",
    tags=["Jobs"],
)

@router.get("/{job_id}/status", response_model=schemas.JobStatusResponse)
async def get_job_status(job_id: uuid.UUID, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None: raise HTTPException(status_code=404, detail="Job not found")
    return schemas.JobStatusResponse(
        job_id=db_job.id,
        status=db_job.status,
        error_message=db_job.error_message
    )

@router.get("", response_model=List[schemas.Job])
async def list_jobs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    jobs = db.query(models.Job).order_by(models.Job.created_at.desc()).offset(skip).limit(limit).all()
    return jobs

@router.get("/{job_id}/tex")
async def get_job_tex(job_id: uuid.UUID, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    tex_s3_path: str | None = None
    file_description: str = ""

    # Determine which TeX file to serve based on status
    if db_job.status == models.JobStatus.COMPILATION_COMPLETE:
        if db_job.final_tex_s3_path:
            tex_s3_path = db_job.final_tex_s3_path
            file_description = "Final TeX"
        else:
             # Fallback to initial if final is expected but missing (edge case)
             if db_job.initial_tex_s3_path:
                tex_s3_path = db_job.initial_tex_s3_path
                file_description = "Initial TeX (Final missing)"
             else:
                 raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Final TeX path not found and no Initial TeX available.")

    elif db_job.status in [
        models.JobStatus.AWAITING_SEGMENTATION,
        models.JobStatus.SEGMENTATION_COMPLETE,
        models.JobStatus.COMPILATION_PENDING,
        # Potentially add FAILED if you want to allow downloading the initial TeX from failed jobs
    ]:
        if db_job.initial_tex_s3_path:
            tex_s3_path = db_job.initial_tex_s3_path
            file_description = "Initial TeX"
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initial TeX file path not found for this job status.")
    else:
        # For other statuses like PENDING, RENDERING, PROCESSING_VLM, FAILED (if not included above)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"TeX file not available for current job status: '{db_job.status.value}'"
        )

    print(f"Serving {file_description} file from S3 path: {tex_s3_path}")
    tex_content_bytes = download_from_s3(tex_s3_path)
    if tex_content_bytes is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retrieve {file_description} file from S3.")

    # Generate filename (use initial PDF name as base)
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

    # PDF is only available once final compilation is complete
    if db_job.status != models.JobStatus.COMPILATION_COMPLETE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Final PDF not available. Current job status is '{db_job.status.value}'."
        )

    if not db_job.final_pdf_s3_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Final PDF file path not found for this completed job.")

    print(f"Serving Final PDF file from S3 path: {db_job.final_pdf_s3_path}")
    pdf_content_bytes = download_from_s3(db_job.final_pdf_s3_path)
    if pdf_content_bytes is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve final PDF file from S3.")

    base_filename = db_job.input_pdf_filename.replace('.pdf', '') if db_job.input_pdf_filename else str(job_id)
    download_filename = f"{base_filename}_final.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_content_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{download_filename}\""} # Display inline
    )

@router.get("/{job_id}/pages", response_model=schemas.JobPageImagesResponse)
def get_page_images(job_id: uuid.UUID, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    job = db.query(models.Job).options(joinedload(models.Job.page_images)).filter(models.Job.id == job_id).first()
    if job is None: raise HTTPException(status_code=404, detail="Job not found")
    if not job.page_images: raise HTTPException(status_code=404, detail="Rendered page images not found.")
    page_image_infos = []
    try:
        sorted_pages = sorted(job.page_images, key=lambda p: p.page_number)
        for page_image in sorted_pages:
            url = get_s3_presigned_url(page_image.s3_path)
            if not url: raise HTTPException(status_code=500, detail=f"Could not generate URL for page {page_image.page_number}.")
            page_image_infos.append(schemas.PageImageInfo(page_number=page_image.page_number, image_url=url))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error retrieving page image information.")
    return schemas.JobPageImagesResponse(job_id=job.id, pages=page_image_infos)

@router.get("/{job_id}/segmentations", response_model=List[schemas.Segmentation], tags=["Jobs", "Segmentations"])
async def get_segmentations(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Retrieves existing segmentation bounding boxes for a specific job."""
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")

    # Query the Segmentation table directly
    segmentations = db.query(models.Segmentation).filter(models.Segmentation.job_id == job_id).all()

    # The response_model=List[schemas.Segmentation] handles the serialization
    # Pydantic will automatically convert the list of models.Segmentation objects
    # into the structure expected by schemas.Segmentation.
    if not segmentations:
        return [] # Return empty list if none found, not an error

    return segmentations

@router.post("/{job_id}/segmentations", response_model=List[schemas.Segmentation], status_code=status.HTTP_201_CREATED, tags=["Jobs", "Segmentations"])
async def create_segmentations(job_id: uuid.UUID, segmentations_in: List[schemas.SegmentationCreate], db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")
    segmentation_objects = []
    for seg_in in segmentations_in:
        db_segmentation = models.Segmentation(job_id=job_id, **seg_in.model_dump())
        segmentation_objects.append(db_segmentation)
    if not segmentation_objects: return []
    try:
        db.add_all(segmentation_objects)
        db.commit()
        for seg in segmentation_objects: db.refresh(seg)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save segmentation data.")
    return segmentation_objects

@router.get("/{job_id}/segmentation-tasks", response_model=schemas.SegmentationTaskListResponse, tags=["Jobs", "Segmentations"])
async def get_segmentation_tasks(job_id: uuid.UUID, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")
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
    """Triggers the final LaTeX compilation after segmentation is done."""
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if db_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")

    # Allow triggering compilation if awaiting segmentation or already marked as complete
    if db_job.status not in [models.JobStatus.AWAITING_SEGMENTATION, models.JobStatus.SEGMENTATION_COMPLETE]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job status is '{db_job.status.value}'. Final compilation can only be triggered when status is 'awaiting_segmentation' or 'segmentation_complete'."
        )

    try:
        # Update status to pending
        db_job.status = models.JobStatus.COMPILATION_PENDING
        db.add(db_job)
        db.commit()
        db.refresh(db_job)

        # Trigger the Celery task
        compile_final_document.delay(str(db_job.id))

        return db_job
    except Exception as e:
        db.rollback()
        # Optionally log the exception e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to trigger final compilation.") 