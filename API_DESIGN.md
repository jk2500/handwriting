# API Specification: Handwritten LaTeX Converter Personal Cloud Service

This document outlines the planned API endpoints for the single-user service. No user authentication is required.

## 1. Upload (`/upload`)

### 1.1 Upload PDF and Start Job

*   **Endpoint:** `/upload/pdf`
*   **Method:** `POST`
*   **Request Body:** `multipart/form-data` containing the PDF file.
    *   Optional: Query parameter or form field for `model_name` (e.g., `?model=gpt-4o-mini`). Defaults to a standard model if not provided.
*   **Success Response (202 Accepted):** Indicates the job has been accepted for processing.
    ```json
    {
      "message": "PDF accepted for processing.",
      "job_id": "unique_job_identifier",
      "status_url": "/jobs/unique_job_identifier/status"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: No file, invalid file type, invalid model name.
    *   `500 Internal Server Error`: Error saving file to cloud, error queuing task.

## 2. Job Status & Results (`/jobs`)

### 2.1 List All Jobs

*   **Endpoint:** `/jobs`
*   **Method:** `GET`
*   **Success Response (200 OK):**
    ```json
    [
      {
        "job_id": "job_1",
        "input_pdf_filename": "notes1.pdf",
        "status": "completed",
        "model_used": "gpt-4o",
        "created_at": "timestamp",
        "completed_at": "timestamp_or_null"
      },
      {
        "job_id": "job_2",
        "input_pdf_filename": "diagrams.pdf",
        "status": "processing_vlm",
        "model_used": "gpt-4o-mini",
        "created_at": "timestamp",
        "completed_at": null
      }
      // ... more jobs
    ]
    ```
*   **Error Responses:** `500 Internal Server Error`

### 2.2 Get Job Status

*   **Endpoint:** `/jobs/{job_id}/status`
*   **Method:** `GET`
*   **Path Parameter:** `job_id` (string)
*   **Success Response (200 OK):**
    ```json
    {
      "job_id": "job_1",
      "status": "completed" // e.g., pending, rendering, processing_vlm, compiling, completed, failed
      "error_message": "Optional error details if status is failed"
    }
    ```
*   **Error Responses:** `404 Not Found`, `500 Internal Server Error`

### 2.3 Get Generated LaTeX File

*   **Endpoint:** `/jobs/{job_id}/tex`
*   **Method:** `GET`
*   **Path Parameter:** `job_id` (string)
*   **Success Response (200 OK):**
    *   **Headers:** `Content-Type: text/plain; charset=utf-8`, `Content-Disposition: attachment; filename="output_{job_id}.tex"` (optional)
    *   **Body:** Raw LaTeX content.
*   **Error Responses:**
    *   `404 Not Found`: Job or file doesn't exist.
    *   `409 Conflict`: Job not yet completed or failed before TeX generation.
    *   `500 Internal Server Error`: Error retrieving file from cloud.

### 2.4 Get Compiled PDF File

*   **Endpoint:** `/jobs/{job_id}/pdf`
*   **Method:** `GET`
*   **Path Parameter:** `job_id` (string)
*   **Success Response (200 OK):**
    *   **Headers:** `Content-Type: application/pdf`, `Content-Disposition: inline; filename="output_{job_id}.pdf"` (or `attachment`)
    *   **Body:** Raw PDF binary content.
*   **Error Responses:**
    *   `404 Not Found`: Job or file doesn't exist.
    *   `409 Conflict`: Job not yet completed or failed before PDF generation.
    *   `500 Internal Server Error`: Error retrieving file from cloud.

*(Further refinement needed for pagination on /jobs, detailed status codes, error formats)* 

## 3. Segmentation (Manual)

### 3.1 Get Rendered Page Images

*   **Endpoint:** `/jobs/{job_id}/pages`
*   **Method:** `GET`
*   **Path Parameter:** `job_id` (string)
*   **Description:** Retrieves URLs for the pre-rendered image (e.g., PNG) of each page associated with the job.
*   **Success Response (200 OK):**
    ```json
    {
      "job_id": "string",
      "pages": [
        {"page_number": 1, "image_url": "string (URL to image in cloud storage)"},
        {"page_number": 2, "image_url": "string"}
        // ...
      ]
    }
    ```
*   **Error Responses:**
    *   `404 Not Found`: Job doesn't exist or pages not rendered yet.
    *   `500 Internal Server Error`: Error fetching image URLs.
*   **Notes:** Assumes page images are rendered by the backend (e.g., during an initial processing step or triggered on-demand) and stored in cloud storage. URLs might be signed URLs with limited expiry.

### 3.2 Submit Bounding Box Segments

*   **Endpoint:** `/jobs/{job_id}/segmentation`
*   **Method:** `POST` (or `PUT` if replacing all segments)
*   **Path Parameter:** `job_id` (string)
*   **Description:** Submits the user-defined bounding boxes associated with placeholders (`STRUCTURE-N`, `DIAGRAM-M`) identified in the generated LaTeX.
*   **Request Body:**
    ```json
    {
      "segments": [
        {
          "placeholder_id": "STRUCTURE-1", // The placeholder ID from the .tex file
          "page_number": 1, // 1-indexed page number the box is on
          "bbox": [x_min, y_min, x_max, y_max] // Pixel coordinates relative to the top-left of the rendered page image
        },
        {
          "placeholder_id": "DIAGRAM-1",
          "page_number": 2,
          "bbox": [x_min, y_min, x_max, y_max]
        }
        // ... more segments
      ]
    }
    ```
*   **Success Response (201 Created or 200 OK):**
    ```json
    {
      "message": "Segmentation data received successfully."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid request body format, invalid coordinates, invalid placeholder ID format.
    *   `404 Not Found`: Job doesn't exist.
    *   `500 Internal Server Error`: Error saving segmentation data.

*(Further refinement needed for pagination on /jobs, detailed status codes, error formats)* 