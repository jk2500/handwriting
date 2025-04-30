# Project: Handwritten PDF to LaTeX Converter (YOLO Segmentation Approach)

## 1. Goal

To create an application that takes PDF files containing handwritten mathematical, physics, or chemistry content (including text, equations, diagrams, graphs, reaction equations, and mechanisms) and converts them into clean, compilable LaTeX documents.

## 2. Core Components

*   **PDF Input Module:** Handles uploading or selecting PDF files.
*   **PDF Processing Module:**
    *   Detects if the PDF is multi-page or single-page.
    *   Renders pages (or later, chunks) to images at a suitable resolution (e.g., 300 DPI).
*   **Page Segmentation Module (New - YOLO-based):**
    *   **Purpose:** Isolate textual regions (text/math) from figures (diagrams, graphs, tables) *before* sending content to the VLM.
    *   Uses a **YOLOv8 model fine-tuned with LoRA** trained on classes like `text_line`/`math_line`, `diagram`, `table`.
    *   Applies an **OCR IoU Filter:** Re-labels potential false positive "diagram" boxes as text if they have significant overlap (>15%) with OCR-detected glyph bounding boxes (using `pytesseract` or `PaddleOCR`).
    *   Uses a confidence threshold (e.g., >= 0.45) to favor precision.
    *   Outputs:
        *   Bounding boxes for each detected region type.
        *   Masked images where non-text regions are blanked out (for VLM).
        *   Cropped images of diagrams/graphs (for Diagram/Graph Handler).
    *   **(Optional):** Human preview/correction interface for ambiguous boxes.
*   **VLM Interaction Module:**
    *   Receives the **text-only masked images** from the Segmentation Module.
    *   Sends these images to a specified Reasoning VLM API (e.g., GPT-4V, Gemini).
    *   Prompts the VLM to generate LaTeX only for the visible text and equations.
    *   Receives the generated LaTeX, which should ideally include placeholders (e.g., `<<DIAGRAM_1>>`, `<<TABLE_1>>`) corresponding to the masked regions.
*   **Diagram/Graph Handling Module:**
    *   Receives the **cropped figure images** (diagrams, graphs, tables) from the Segmentation Module.
    *   **Diagrams:** Uses image generation/enhancement (e.g., ControlNet-Scribble + Stable Diffusion) to create clean PNG/SVG versions. Simple line art might be convertible to TikZ (e.g., via FreeTikZ).
    *   **Analytical Graphs (Math/Physics/Chemistry):** Parses the visual graph and potentially nearby text context (from VLM output or original OCR data) to extract the function, variables, and ranges, then regenerates the graph using a plotting library (e.g., Matplotlib, PGFPlots).
    *   **Tables:** Could use specialized table OCR or potentially guide the VLM with the table crop for better structure recognition.
*   **LaTeX Generation Module:**
    *   Takes the VLM-generated LaTeX (containing text, equations, and placeholders).
    *   Takes the processed figures (image files, TikZ code) from the Diagram/Graph Handling Module.
    *   Assembles these components into a complete, well-formatted `.tex` document, replacing placeholders like `<<DIAGRAM_1>>` with appropriate `\includegraphics{diagram_1.png}` or generated TikZ/PGFPlots code.
*   **User Interface (Optional):** A front-end (web-based or desktop) to manage file uploads, view progress, potentially review/adjust segmentation masks, and access the generated LaTeX files and compiled PDF.

## 3. Technology Stack

*   **Backend Language:** Python
*   **PDF Processing:** `PyMuPDF`, `pdf2image`
*   **Page Segmentation:** **YOLOv8 + LoRA** (trained model)
*   **OCR (for filter):** `pytesseract` or `PaddleOCR`
*   **VLM:** An external Reasoning VLM API (e.g., GPT-4V, Gemini)
*   **Diagram Handling:** **ControlNet-Scribble**, Stable Diffusion models (e.g., SD3), potentially FreeTikZ.
*   **Graph Handling:** **Matplotlib** / **PGFPlots**.
*   **LaTeX Generation:** Python string templating or libraries like `pylatex`.
*   **UI Framework (If applicable):** Flask/Django + HTMX (Web) or PyQt/Tkinter (Desktop)

## 4. Workflow

```mermaid
graph TD
    A(PDF Input) --> B(PDF Processing: Page to Image);
    B --> C{Page Segmentation (YOLO + OCR Filter)};
    C -- BBoxes & Masked Image --> D(VLM Interaction: Text/Math -> LaTeX + Placeholders);
    C -- Cropped Figures --> E(Diagram/Graph Handling);
    E -- Diagrams --> F(Image Gen/Clean-up -> PNG/SVG/TikZ);
    E -- Graphs --> G(Parameter Extraction & Regen -> Matplotlib/PGFPlots);
    E -- Tables --> H(Table Processing);
    D & F & G & H --> I(LaTeX Generation: Assemble .tex);
    I --> J(Output: .tex + Compiled PDF);

```

1.  User uploads/selects a PDF.
2.  PDF Processing renders pages to images.
3.  Page Segmentation identifies and classifies regions (text/math, diagrams, graphs, tables), generating masks and crops.
4.  The masked image (text/math only) is sent to the VLM, which returns LaTeX with placeholders.
5.  Cropped figures are sent to the Diagram/Graph Handling module for processing (clean-up, regeneration).
6.  The LaTeX Generation module combines the VLM LaTeX and the processed figures into a final `.tex` file.
7.  The `.tex` file (and optionally a compiled PDF) is made available.

## 5. Potential Challenges

*   **YOLO Model Training/Accuracy:** Requires a good dataset for fine-tuning YOLO+LoRA. Handling variations in handwriting styles, layout density, and diagram types. Achieving high precision/recall to correctly classify regions. The OCR filter helps mitigate some false positives.
*   **VLM Accuracy:** Still relies on the VLM for accurate text/math LaTeX conversion, even with cleaner input. Handling complex or ambiguous notation.
*   **Diagram/Graph Conversion:** Faithfully recreating complex diagrams or accurately extracting parameters for graph regeneration remains challenging.
*   **Placeholder Alignment:** Ensuring placeholders generated by the VLM correctly correspond to the figures processed separately. May need robust ID mapping.
*   **Layout Reconstruction:** Assembling the final LaTeX requires careful placement of text, equations, and figures based on original positions (derived from YOLO boxes). Handling multi-column layouts.
*   **Error Handling:** Managing failures in segmentation, VLM processing, or figure handling.
*   **Scalability & Cost:** Processing large PDFs, YOLO inference time, VLM API costs, image generation costs.

## 6. Implementation Phases

1.  **Phase 1: Core Pipeline Setup & Segmentation:**
    *   Set up project structure.
    *   Implement PDF Input & Processing.
    *   **Implement Page Segmentation (YOLO + OCR Filter):** Train/obtain a base model. Integrate inference pipeline.
    *   Implement basic VLM interaction (sending masked images).
    *   Implement basic LaTeX Generation (assembling VLM output, *without* figure integration initially).
    *   **Goal:** Get the segmentation working, process text/math via VLM, assess segmentation quality.
2.  **Phase 2: Diagram Handling Integration:**
    *   Implement Diagram Handling module (e.g., ControlNet integration).
    *   Refine placeholder logic between VLM and LaTeX Generation.
    *   Integrate processed diagrams (`\includegraphics`) into the final LaTeX.
    *   **Goal:** Convert PDFs with text, math, and diagrams.
3.  **Phase 3: Graph & Table Handling:**
    *   Implement Graph Handling (parameter extraction, regeneration using Matplotlib/PGFPlots).
    *   Implement basic Table Handling.
    *   Integrate regenerated graphs/tables into LaTeX.
    *   **Goal:** Handle the full range of specified content types.
4.  **Phase 4: UI & Refinements:**
    *   Develop User Interface (optional).
    *   Refine layout reconstruction in LaTeX Generation.
    *   Add error handling, improve robustness, optimize performance.

## 7. Next Steps (Initial)

*   Set up the basic project structure (directories, main script).
*   Implement the PDF Input and Processing modules (page rendering).
*   **Begin work on the Page Segmentation module:** Research/acquire datasets for YOLO training, set up YOLOv8 environment, start fine-tuning experiments.
*   Set up initial integration with a VLM API for text/math from masked images. 