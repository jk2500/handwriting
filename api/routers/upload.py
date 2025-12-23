from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, Form, Request
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from .. import models, schemas
from ..database import get_db
from ..s3_utils import upload_fileobj_to_s3_async
from .. import tasks
from ..config import get_logger

logger = get_logger(__name__)

DEFAULT_CONVERSION_MODEL = "o4-mini"

router = APIRouter(
    prefix="/upload",
    tags=["Upload"],
)

@router.post("/pdf", status_code=202, response_model=schemas.UploadAcceptResponse)
async def upload_pdf_and_start_job(
    request: Request,
    file: UploadFile = File(...),
    model_name: Optional[str] = Form(default=DEFAULT_CONVERSION_MODEL),
    db: Session = Depends(get_db)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF is allowed.")

    s3_path = await upload_fileobj_to_s3_async(file.file, file.filename, file.content_type)
    if not s3_path:
        raise HTTPException(status_code=500, detail="Failed to upload file to S3 storage.")

    new_job = models.Job(
        id=uuid.uuid4(),
        input_pdf_filename=file.filename,
        input_pdf_s3_path=s3_path,
        status=models.JobStatus.PENDING,
        model_used=model_name
    )
    
    try:
        db.add(new_job)
        db.commit()
        db.refresh(new_job)
        logger.info(f"Created job {new_job.id}")
    except Exception as e:
        db.rollback()
        logger.exception(f"Database error creating job: {e}")
        raise HTTPException(status_code=500, detail="Database error")

    tasks.process_handwriting_conversion.delay(job_id_str=str(new_job.id))
    logger.info(f"Queued conversion task for job {new_job.id}")

    status_url = request.url_for('get_job_status', job_id=str(new_job.id))
    
    return schemas.UploadAcceptResponse(
        message="PDF accepted for processing.",
        job_id=new_job.id,
        status_url=str(status_url)
    )
