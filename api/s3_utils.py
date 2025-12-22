"""
Utilities for interacting with AWS S3.
"""

import uuid
import io
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from fastapi import UploadFile
import boto3
from botocore.exceptions import ClientError

from .config import get_s3_config, get_logger

_executor = ThreadPoolExecutor(max_workers=4)

logger = get_logger(__name__)

_s3_config = get_s3_config()
S3_BUCKET_NAME = _s3_config["bucket_name"]
AWS_REGION = _s3_config["region"]

if not S3_BUCKET_NAME:
    logger.warning("S3_BUCKET_NAME environment variable not set. Using placeholder.")
    S3_BUCKET_NAME = "your-handwriting-latex-bucket-placeholder"

s3_client = boto3.client('s3')

def _is_bucket_configured() -> bool:
    """Check if S3 bucket is properly configured."""
    if not S3_BUCKET_NAME or "placeholder" in S3_BUCKET_NAME:
        logger.error("S3_BUCKET_NAME not configured correctly.")
        return False
    return True

def upload_to_s3(file: UploadFile, filename: str) -> str | None:
    """Uploads a file stream to the configured S3 bucket."""
    if not _is_bucket_configured():
        return None
    
    unique_key = f"uploads/pdfs/{uuid.uuid4()}_{filename}"
    logger.info(f"Uploading '{filename}' to S3 key '{unique_key}'")
    
    try:
        s3_client.upload_fileobj(
            file.file, 
            S3_BUCKET_NAME, 
            unique_key,
            ExtraArgs={'ContentType': file.content_type}
        )
        logger.info(f"Successfully uploaded {filename}")
        return unique_key
    except ClientError as e:
        logger.error(f"S3 ClientError uploading {filename}: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error during S3 upload: {e}")
        return None

def upload_local_file_to_s3(local_file_path: str, s3_key: str, content_type: str | None = None) -> str | None:
    """Uploads a file from the local filesystem to the configured S3 bucket."""
    if not _is_bucket_configured():
        return None
    
    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type
        
    logger.info(f"Uploading local file '{local_file_path}' to S3 key '{s3_key}'")
    
    try:
        s3_client.upload_file(
            Filename=local_file_path, 
            Bucket=S3_BUCKET_NAME, 
            Key=s3_key,
            ExtraArgs=extra_args
        )
        logger.info(f"Successfully uploaded {local_file_path}")
        return s3_key
    except FileNotFoundError:
        logger.error(f"Local file not found: {local_file_path}")
        return None
    except ClientError as e:
        logger.error(f"S3 ClientError uploading {local_file_path}: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error during S3 upload of {local_file_path}: {e}")
        return None

def download_from_s3(s3_key: str) -> bytes | None:
    """Downloads a file's content from the configured S3 bucket."""
    if not _is_bucket_configured():
        return None
    
    logger.info(f"Downloading key '{s3_key}' from S3")
    
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        with response['Body'] as body:
            content = body.read()
        logger.info(f"Successfully downloaded {s3_key}")
        return content
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            logger.error(f"S3 key '{s3_key}' not found in bucket.")
        else:
            logger.error(f"S3 ClientError downloading {s3_key}: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error during S3 download: {e}")
        return None

def get_s3_presigned_url(s3_key: str, expiration_seconds: int = 3600) -> str | None:
    """Generates a presigned URL for accessing an S3 object."""
    if not _is_bucket_configured():
        return None
    
    logger.debug(f"Generating presigned URL for key '{s3_key}'")
    
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_key},
            ExpiresIn=expiration_seconds
        )
        return url
    except ClientError as e:
        logger.error(f"S3 ClientError generating presigned URL for {s3_key}: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error during presigned URL generation: {e}")
        return None 

def upload_content_to_s3(content: bytes, s3_key: str, content_type: str | None = None) -> str | None:
    """Uploads bytes content directly to the configured S3 bucket."""
    if not _is_bucket_configured():
        return None
    
    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type
        
    logger.info(f"Uploading content to S3 key '{s3_key}'")
    
    try:
        s3_client.upload_fileobj(
            io.BytesIO(content),
            S3_BUCKET_NAME, 
            s3_key,
            ExtraArgs=extra_args
        )
        logger.info(f"Successfully uploaded content to {s3_key}")
        return s3_key
    except ClientError as e:
        logger.error(f"S3 ClientError uploading to {s3_key}: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error during S3 upload to {s3_key}: {e}")
        return None


async def download_from_s3_async(s3_key: str) -> bytes | None:
    """Async version of download_from_s3."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, download_from_s3, s3_key)


async def upload_content_to_s3_async(content: bytes, s3_key: str, content_type: str | None = None) -> str | None:
    """Async version of upload_content_to_s3."""
    loop = asyncio.get_event_loop()
    func = partial(upload_content_to_s3, content, s3_key, content_type)
    return await loop.run_in_executor(_executor, func)
