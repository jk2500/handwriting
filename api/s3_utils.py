"""
Utilities for interacting with AWS S3.
"""

import uuid
import io
import os
from fastapi import UploadFile
import boto3
from botocore.exceptions import ClientError
from botocore.client import Config

# Load environment variables - path doesn't need changing if loaded externally now
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION")

if not S3_BUCKET_NAME:
    print("Warning: S3_BUCKET_NAME environment variable not set. Using placeholder.")
    S3_BUCKET_NAME = "your-handwriting-latex-bucket-placeholder"

s3_client = boto3.client('s3')

def upload_to_s3(file: UploadFile, filename: str) -> str | None:
    """
    Uploads a file stream to the configured S3 bucket.
    """
    if not S3_BUCKET_NAME or "placeholder" in S3_BUCKET_NAME:
         print("Error: S3_BUCKET_NAME not configured correctly for actual upload.")
         return None
    unique_key = f"uploads/pdfs/{uuid.uuid4()}_{filename}"
    print(f"Attempting to upload '{filename}' to bucket '{S3_BUCKET_NAME}' with key '{unique_key}'")
    try:
        s3_client.upload_fileobj(
            file.file, 
            S3_BUCKET_NAME, 
            unique_key,
            ExtraArgs={'ContentType': file.content_type}
        )
        print(f"Successfully uploaded {filename} to {unique_key}")
        return unique_key
    except ClientError as e:
        print(f"S3 ClientError uploading {filename}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during S3 upload: {e}")
        return None

def upload_local_file_to_s3(local_file_path: str, s3_key: str, content_type: str | None = None) -> str | None:
    """
    Uploads a file from the local filesystem to the configured S3 bucket.
    """
    if not S3_BUCKET_NAME or "placeholder" in S3_BUCKET_NAME:
         print("Error: S3_BUCKET_NAME not configured correctly for actual upload.")
         return None
    
    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type
        
    print(f"Attempting to upload local file '{local_file_path}' to bucket '{S3_BUCKET_NAME}' with key '{s3_key}'")
    try:
        s3_client.upload_file(
            Filename=local_file_path, 
            Bucket=S3_BUCKET_NAME, 
            Key=s3_key,
            ExtraArgs=extra_args
        )
        print(f"Successfully uploaded {local_file_path} to {s3_key}")
        return s3_key # Return the key on success
    except FileNotFoundError:
        print(f"Error: Local file not found: {local_file_path}")
        return None
    except ClientError as e:
        print(f"S3 ClientError uploading {local_file_path}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during S3 upload of {local_file_path}: {e}")
        return None

def download_from_s3(s3_key: str) -> bytes | None:
    """
    Downloads a file's content from the configured S3 bucket.
    """
    if not S3_BUCKET_NAME or "placeholder" in S3_BUCKET_NAME:
         print("Error: S3_BUCKET_NAME not configured correctly for actual download.")
         return None
    print(f"Attempting to download key '{s3_key}' from bucket '{S3_BUCKET_NAME}'")
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        print(f"Successfully downloaded {s3_key}")
        return response['Body'].read()
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            print(f"S3 Error: Key '{s3_key}' not found in bucket '{S3_BUCKET_NAME}'.")
        else:
            print(f"S3 ClientError downloading {s3_key}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during S3 download: {e}")
        return None

def get_s3_presigned_url(s3_key: str, expiration_seconds: int = 3600) -> str | None:
    """
    Generates a presigned URL for accessing an S3 object.
    """
    if not S3_BUCKET_NAME or "placeholder" in S3_BUCKET_NAME:
        print("Error: S3_BUCKET_NAME not configured correctly for presigned URL generation.")
        return None
    if not s3_client:
        print("Error: S3 client not initialized.")
        return None
    print(f"Attempting to generate presigned URL for key '{s3_key}' in bucket '{S3_BUCKET_NAME}'")
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_key},
            ExpiresIn=expiration_seconds
        )
        print(f"Successfully generated presigned URL for {s3_key}")
        return url
    except ClientError as e:
        print(f"S3 ClientError generating presigned URL for {s3_key}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during presigned URL generation: {e}")
        return None 

def upload_content_to_s3(content: bytes, s3_key: str, content_type: str | None = None) -> str | None:
    """
    Uploads bytes content directly to the configured S3 bucket.
    
    Args:
        content (bytes): The content to upload
        s3_key (str): The S3 key where the file will be saved
        content_type (str, optional): The content-type of the file
        
    Returns:
        str | None: The S3 key if successful, None if there was an error
    """
    if not S3_BUCKET_NAME or "placeholder" in S3_BUCKET_NAME:
         print("Error: S3_BUCKET_NAME not configured correctly for actual upload.")
         return None
    
    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type
        
    print(f"Attempting to upload content to bucket '{S3_BUCKET_NAME}' with key '{s3_key}'")
    try:
        s3_client.upload_fileobj(
            io.BytesIO(content),
            S3_BUCKET_NAME, 
            s3_key,
            ExtraArgs=extra_args
        )
        print(f"Successfully uploaded content to {s3_key}")
        return s3_key
    except ClientError as e:
        print(f"S3 ClientError uploading to {s3_key}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during S3 upload to {s3_key}: {e}")
        return None 