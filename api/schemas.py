from pydantic import BaseModel, Field, validator
from typing import List, Optional
import uuid
import datetime

# Change to absolute import
from .models import JobStatus

# --- Job Schemas ---
class JobBase(BaseModel):
    input_pdf_filename: Optional[str] = None
    model_used: Optional[str] = None

class JobCreate(JobBase):
    pass

class Job(JobBase):
    id: uuid.UUID
    status: JobStatus
    error_message: Optional[str] = None
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    input_pdf_s3_path: Optional[str] = None
    initial_tex_s3_path: Optional[str] = None
    final_tex_s3_path: Optional[str] = None
    final_pdf_s3_path: Optional[str] = None

    class Config:
        from_attributes = True
        use_enum_values = True

class JobStatusResponse(BaseModel):
    job_id: uuid.UUID
    status: JobStatus
    error_message: Optional[str] = None

    class Config:
        from_attributes = True
        use_enum_values = True

class UploadAcceptResponse(BaseModel):
    message: str
    job_id: uuid.UUID
    status_url: str

# --- Page Image Schemas ---
class PageImageInfo(BaseModel):
    page_number: int = Field(..., description="0-indexed page number")
    image_url: str = Field(..., description="URL to the rendered page image (potentially pre-signed)")

class JobPageImagesResponse(BaseModel):
    job_id: uuid.UUID
    pages: List[PageImageInfo] = Field(..., description="List of rendered page images for the job")

    class Config:
        from_attributes = True

# --- Segmentation Schemas ---
class SegmentationBase(BaseModel):
    page_number: int = Field(..., ge=0, description="0-indexed page number", alias="pageNumber")
    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)
    width: float = Field(..., gt=0.0, le=1.0)
    height: float = Field(..., gt=0.0, le=1.0)
    label: Optional[str] = Field(None)

    class Config:
        populate_by_name = True
        from_attributes = True
        use_enum_values = True

    @validator('width')
    def check_x_plus_width(cls, v, values, **kwargs):
        if 'x' in values and values['x'] + v > 1.0:
            raise ValueError('x + width must be <= 1.0')
        return v

    @validator('height')
    def check_y_plus_height(cls, v, values, **kwargs):
        if 'y' in values and values['y'] + v > 1.0:
            raise ValueError('y + height must be <= 1.0')
        return v

class SegmentationCreate(SegmentationBase):
    pass

class Segmentation(SegmentationBase):
    id: int
    job_id: uuid.UUID
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None

    class Config:
        populate_by_name = True
        from_attributes = True
        use_enum_values = True

# --- Segmentation Task Schemas (for UI) ---
class SegmentationTaskItem(BaseModel):
    placeholder: str = Field(..., description="Placeholder name (e.g., DIAGRAM-1)")
    description: str = Field(..., description="Textual description for the placeholder")

class SegmentationTaskListResponse(BaseModel):
    job_id: uuid.UUID
    tasks: List[SegmentationTaskItem] = Field(..., description="List of placeholders and descriptions") 