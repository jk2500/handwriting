# Application Development Plan: Handwritten LaTeX Converter Personal Cloud Service

## 1. Goal

To create a personal cloud-based service consisting of a **Web Application** and a **Mobile Application**. The mobile app is used to upload handwritten PDFs, which are then converted to LaTeX by a cloud backend. The web app provides an interface for manual segmentation of diagrams/structures. **After segmentation, a final compilation step generates the `.pdf` file.** The results (both `.tex` and `.pdf`) can be viewed/managed on both the web and mobile platforms.

## 2. Application Type

*   **Multi-Component Cloud Service (Single User):**
    *   **Cloud Backend API:** Central hub handling logic, data, and task processing (initial LaTeX generation and final compilation). **No user authentication.**
    *   **Web Frontend:** Browser-based interface for viewing history, managing files, viewing results (inc. compiled PDF), **performing manual segmentation**, and **triggering the final PDF compilation**.
    *   **Mobile Frontend (iOS/Android):** Primary interface for capturing/uploading PDFs, viewing status/results (inc. compiled PDF). *(Future: May eventually include segmentation and compilation features, but initial focus is upload/viewing)*.

## 3. Core Features (Initial Thoughts - MVP)

*   **Mobile (Initial Focus - Phase 3):**
    *   PDF Upload (from camera scan or device storage) -> Sends to Backend API.
    *   View upload/conversion/compilation status and history.
    *   View compiled PDF output.
    *   *(Future):* Segmentation interface (drawing bounding boxes).
    *   *(Future):* Trigger final PDF compilation.
*   **Web:**
    *   PDF Upload (from camera scan or device storage) -> Sends to Backend API.
    *   View upload/conversion/segmentation/compilation history.
    *   View generated LaTeX output.
    *   Display rendered page images for uploaded PDFs.
    *   **Provide an interface to iterate through placeholder descriptions (`DIAGRAM-M`, `STRUCTURE-N`) fetched from the backend.**
    *   **Provide an interface to draw bounding boxes on page images, guided by the placeholder descriptions.**
    *   **Allow users to associate the drawn bounding box with the current placeholder identifier (saving coordinates and placeholder label to backend).**
    *   Download `.tex` files.
    *   View and Download compiled `.pdf` files.
    *   **Trigger final PDF compilation after segmentation is complete.**
*   **Backend:**
    *   Receive PDF uploads.
    *   Store PDFs securely (Cloud Storage).
    *   Run the initial conversion pipeline (VLM -> LaTeX + Placeholders) using Task Queue.
    *   Store job status and metadata (Database - simplified, no user IDs, includes new statuses like `SEGMENTATION_COMPLETE`, `REFINEMENT_PENDING`, `REFINEMENT_IN_PROGRESS`, `REFINEMENT_COMPLETE`, `REFINEMENT_FAILED`, `COMPILATION_PENDING`, `COMPILATION_COMPLETE`, `COMPILATION_FAILED`).
    *   Render uploaded PDFs to page images (e.g., PNG) upon upload or on demand.
    *   Store page image paths (Cloud Storage).
    *   **Extract LaTeX content and separate placeholder descriptions from VLM output.**
    *   Store generated initial `.tex` files (Cloud Storage).
    *   **Store placeholder-description mapping (e.g., in Job's JSON field).**
    *   **Provide API endpoint to serve placeholder/description list for a job.**
    *   Receive and store bounding box coordinates/assignments for placeholders.
    *   **(Future) Provide API endpoint to trigger segmentation image refinement using an image generation model (e.g., POST /jobs/{job_id}/refine).**
    *   **(Future) Run refinement task (calls image gen model to create Ti*k*Z-like images, saves refined images).**
    *   **Provide API endpoint to trigger final compilation task.**
    *   Run final compilation task (integrating **original/refined** segmentations, running `pdflatex`) using Task Queue.
    *   Store final `.tex` and `.pdf` files (Cloud Storage).
    *   Serve data and file download links to web/mobile frontends via API.
*   **(Future):** Model selection per conversion, advanced diagram/graph handling (e.g., sending cropped images to specialized models), **segmentation image refinement (Ti*k*Z style using image gen)**, sharing (if needed later), richer editing/preview features.

## 4. Architecture

*   **Cloud Backend API (e.g., FastAPI/Flask):**
    *   Provides RESTful endpoints for file upload, job status, result retrieval (including `.tex` and `.pdf` links). **No authentication required (or uses a simple shared secret if exposed).**
    *   Manages file storage (interacts with Cloud Storage).
    *   Triggers background tasks (initial conversion, final compilation) (interacts with Task Queue).
    *   Contains the core conversion logic (adapted from `src` modules).
    *   **Includes logic to parse VLM output (LaTeX and descriptions).**
    *   Includes endpoints to serve rendered page images for a given PDF.
    *   **Includes endpoint to serve placeholder-description mapping for segmentation UI.**
    *   Includes endpoints to receive and store bounding box data linked to placeholders.
    *   Logic to render PDF pages to images (using e.g., `pymupdf`).
    *   **(Future) Includes endpoint to trigger segmentation refinement task (e.g., POST /jobs/{job_id}/refine).**
    *   **Includes endpoint to trigger the final compilation task (e.g., POST /jobs/{job_id}/compile).**
*   **Database (e.g., PostgreSQL, MongoDB):**
    *   Stores metadata about uploaded PDFs (filename, upload time, storage path).
    *   Stores conversion job details (job ID, status [including new **refinement and** compilation statuses], model used, input PDF ref, initial `.tex` path, **refined image paths (future)**, final `.tex` path, final `.pdf` path, timestamps, **placeholder-description mapping (JSON)**). **No user references.**
    *   Stores paths/references to rendered page images associated with each PDF.
    *   Stores bounding box data (coordinates, page number, associated placeholder ID like 'STRUCTURE-1', job ID).
*   **Cloud Storage (e.g., AWS S3, Google Cloud Storage):**
    *   Stores uploaded PDF files.
    *   Stores intermediate rendered images (optional, could be temporary).
    *   Stores rendered page images (e.g., PNG per page).
    *   Stores generated initial `.tex` files (from VLM).
    *   **(Future) Stores refined segmentation images (Ti*k*Z style).**
    *   Stores final generated `.tex` files (after segmentation integration).
    *   Stores final compiled `.pdf` files.
*   **Task Queue (e.g., Celery + Redis/RabbitMQ):**
    *   Manages the asynchronous execution of PDF rendering, **VLM conversion (including description extraction)**, **(Future) segmentation refinement (calling image gen model)**, and **final LaTeX compilation (including segmentation integration)** triggered by API requests.
    *   Worker Environment: Requires a full LaTeX distribution (e.g., TeX Live) installed. **(Future: Also requires access/SDK for image generation model).**
*   **Web Frontend (e.g., React, Vue, Angular / HTMX + Server-Side Templates):**
    *   Communicates with the Backend API to display data and trigger actions.
    *   Includes components for embedding/displaying PDF files.
    *   Includes components for displaying rendered page images fetched from the API.
    *   **Includes an interactive component for drawing/managing bounding boxes on these images.**
    *   **Manages the UI flow for iterating through segmentation tasks (description + placeholder) and associating drawn boxes.**
    *   **(Future) Includes UI element to trigger segmentation refinement.**
    *   **Includes UI element to trigger final compilation via the backend API.**
*   **Mobile Frontend (e.g., React Native, Flutter / Native iOS/Android):**
    *   Communicates with the Backend API.
    *   Handles local file system access / camera integration for uploads.
    *   *(Future: Could incorporate segmentation UI libraries if functionality is added later.)*

## 5. Technology Stack

*   **Backend API:** FastAPI (Python)
*   **Database:** PostgreSQL
*   **Cloud Storage:** AWS S3
*   **Task Queue:** Celery + Redis
    *   **Worker Dependency:** TeX Live (or similar LaTeX distribution) **, (Future) Image Generation Model API/SDK**
*   **Web Frontend:** React / Next.js (with a PDF viewer library like `react-pdf`, and **an image annotation/drawing library**)
*   **Mobile Frontend:** React Native (with a PDF viewer library like `react-native-pdf`)
*   **Python Libraries:** Existing (`openai`, `pymupdf`, `python-dotenv`) + `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`, `celery`, `redis`, `boto3`.

## 6. Development Phases (High-Level)

1.  **Phase 1 (Backend API & Core Logic): ALMOST COMPLETE**
    *   Set up FastAPI project. **(COMPLETE)**
    *   Define database models (PDFs, Jobs, PageImages, Segmentations, Job.segmentation_tasks, **updated JobStatus enum**). **(COMPLETE - pending migration for enum)**
    *   Implement API endpoint for PDF upload (saving to Cloud Storage). **(COMPLETE)**
    *   Integrate Celery/Redis. **(COMPLETE)**
    *   Adapt **initial conversion logic** into a background Celery task (outputting initial `.tex` to Cloud Storage). **(PARTIALLY COMPLETE - Needs VLM output parsing update)**
    *   Implement API endpoint to trigger task and endpoint to check job status. **(COMPLETE)**
    *   Implement API endpoints to retrieve list of jobs/files, and download links/content. **(COMPLETE)**
    *   Add PDF page rendering logic (on upload). **(COMPLETE)**
    *   Add API endpoints to serve page images. **(COMPLETE)**
    *   Add API endpoint to receive bounding box data. **(COMPLETE)**
    *   **Add API endpoint to serve placeholder/description list.** **(PENDING ROUTER IMPL)**
    *   **Update initial conversion Celery task to parse VLM descriptions and store mapping.** **(PENDING TASK IMPL)**
    *   **Implement final compilation API endpoint (e.g., POST /jobs/{job_id}/compile).** **(PENDING ROUTER IMPL)**
    *   **Implement final compilation Celery task (integrates segmentations, compiles, saves final .tex/.pdf).** **(PENDING TASK IMPL)**
    *   **Database Migration (for JobStatus enum and potentially Job model updates).** **(PENDING)**
2.  **Phase 2 (Web Frontend - Viewer & Segmentation): CURRENT FOCUS**
    *   Set up basic React/Next.js project. **(COMPLETE)**
    *   Implement a dashboard page to list conversion history/status (polling API, **handling new statuses**). **(COMPLETE)**
    *   Implement views to display fetched LaTeX content and compiled PDF. **(COMPLETE)**
    *   Implement download functionality. **(COMPLETE)**
    *   Display rendered page images fetched from the backend. **(COMPLETE)**
    *   Implement UI for drawing bounding boxes on page images. **(COMPLETE)**
    *   Implement UI/logic to iterate through segmentation tasks (description + placeholder) and associate drawn boxes. **(COMPLETE)**
    *   **Implement UI element to trigger final compilation.** **(PENDING)**
3.  **Phase 3 (Mobile Frontend - Uploader): CURRENT FOCUS**
    *   Set up basic React Native project.
    *   Implement PDF upload functionality (camera/file) calling API.
    *   Implement view to show upload/conversion/compilation status (polling API).
    *   Implement view to display compiled PDF.
4.  **Phase 4 (Refinement & Integration):**
    *   Refine UI/UX on both platforms.
    *   Add model selection capabilities (API and frontends).
    *   **(Future) Implement Segmentation Refinement Feature:**
        *   **Backend:** Add new `JobStatus` values, `/refine` endpoint, refinement Celery task (calling image gen model), update `/compile` task to use refined images. Update DB model.
        *   **Frontend (Web):** Add "Refine" button, handle new statuses, optionally display refined images. *(Future: Could be added to Mobile)*
    *   Strengthen error handling (including compilation errors).
    *   Testing across components (including segmentation -> **(optional refinement) ->** compilation flow).
    *   **Address multi-page VLM processing.**
5.  **Phase 5 (Advanced Features):**
    *   Integrate diagram/graph handling, etc.
    *   **(Future) Add Segmentation/Compilation to Mobile Frontend:** Implement the UI and logic from Phase 2 (Web) into the Mobile app.

## 7. Next Steps

*   **Complete Backend Phase 1:**
    *   **Add new JobStatus enum values (including compilation states, placeholder for future refinement states) and update Job model if needed.**
    *   **Generate and run Alembic migration for database changes.**
    *   Implement `GET /jobs/{job_id}/segmentation-tasks` endpoint in `routers/jobs.py`.
    *   Modify **initial conversion** Celery task in `tasks.py` to parse descriptions and store in `Job.segmentation_tasks`.
    *   **Implement `POST /jobs/{job_id}/compile` endpoint in `routers/jobs.py`.**
    *   **Implement final compilation Celery task in `tasks.py`.**
*   **Complete Web Frontend Phase 2:**
    *   **Implement UI element/button to call the `/compile` endpoint.**
    *   **Ensure UI handles new compilation-related job statuses (and placeholder for future refinement statuses).**
*   **Start Mobile Frontend Phase 3:**
    *   Set up the mobile frontend project structure.
    *   Implement PDF upload functionality.
