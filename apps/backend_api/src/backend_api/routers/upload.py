from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, Form, Request
from sqlalchemy.orm import Session
from typing import Optional
import uuid

# Change to absolute imports
from backend_api import models, schemas
from backend_api.database import get_db
from backend_api.s3_utils import upload_to_s3
from backend_api import tasks

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

    s3_path = upload_to_s3(file, file.filename)
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
        print(f"Created DB record for job ID: {new_job.id}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    tasks.process_handwriting_conversion.delay(job_id_str=str(new_job.id))
    print(f"Successfully queued conversion task for job ID: {new_job.id}")

    status_url = request.url_for('get_job_status', job_id=str(new_job.id))
    
    return schemas.UploadAcceptResponse(
        message="PDF accepted for processing.",
        job_id=new_job.id,
        status_url=str(status_url)
    ) 