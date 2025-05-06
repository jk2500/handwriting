import enum
from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.schema import Index
import uuid

# Change to absolute import
from .database import Base

class JobStatus(enum.Enum):
    PENDING = "pending"
    RENDERING = "rendering"
    PROCESSING_VLM = "processing_vlm"
    AWAITING_SEGMENTATION = "awaiting_segmentation"
    SEGMENTATION_COMPLETE = "segmentation_complete"
    COMPILATION_PENDING = "compilation_pending"
    COMPILATION_COMPLETE = "compilation_complete"
    COMPLETED = "completed"
    FAILED = "failed"

class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    input_pdf_filename = Column(String, index=True)
    input_pdf_s3_path = Column(String)
    initial_tex_s3_path = Column(String, nullable=True)
    final_tex_s3_path = Column(String, nullable=True)
    final_pdf_s3_path = Column(String, nullable=True)
    model_used = Column(String, nullable=True)
    status = Column(SQLEnum(JobStatus), default=JobStatus.PENDING, index=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    segmentation_tasks = Column(JSON, nullable=True)
    page_images = relationship("JobPageImage", back_populates="job", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Job(id={self.id}, status='{self.status.name}', input='{self.input_pdf_filename}')>"

class JobPageImage(Base):
    __tablename__ = "job_page_images"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    s3_path = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    job = relationship("Job", back_populates="page_images")

    def __repr__(self):
        return f"<JobPageImage(job_id={self.job_id}, page={self.page_number}, path='{self.s3_path}')>"

class Segmentation(Base):
    __tablename__ = "segmentations"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False, index=True)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    label = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    job = relationship("Job")
    __table_args__ = (Index('ix_segmentation_job_page', 'job_id', 'page_number'),)

    def __repr__(self):
        return f"<Segmentation(id={self.id}, job_id={self.job_id}, page={self.page_number}, label='{self.label}')>" 