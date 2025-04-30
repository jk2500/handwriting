# Project: Handwritten PDF → LaTeX Converter  
*(updated to reflect the YOLO + OCR segmentation strategy and guard-rails discussed)*

---

## 1  Goal  
Create an application that ingests PDF files containing handwritten math/physics/chemistry material—text, equations, diagrams, graphs, reaction equations/mechanisms—and outputs a clean, compilable LaTeX document.

---

## 2  Core Components  

| Layer | Responsibilities | Key Ideas Added |
|-------|------------------|-----------------|
| **PDF Input Module** | Upload / select PDFs | — |
| **PDF Processing Module** | 1. Detect one-page vs. multi-page.<br>2. Render pages (or chunks) to images at target DPI. | — |
| **Page Segmentation Module** | *Purpose:* isolate textual regions from figures **before** the VLM step.<br>**a. YOLOv8-LoRA detector** trained on 3 classes: `text_line / math_line`, `diagram`, `table`.<br>**b. OCR IoU filter:** if OCR glyph boxes overlap a YOLO “diagram” box by > 15 %, re-label as text (cuts false masks < 1 %).<br>**c. Confidence ≥ 0.45** to bias toward precision.<br>**d. Human preview** for ambiguous boxes. | Prevents equations/reaction schemes being blanked out. |
| **VLM Interaction Module** | • Send *text-only* masked images to the vision-LLM.<br>• Receive LaTeX for text + equations.<br>• Insert placeholders `<<DIAGRAM_n>>` where figures were masked. | Masking guarantees the LLM never outputs stray TikZ. |
| **Diagram & Graph Handling Module** | • For each cropped figure:<br> – **Diagrams:** ControlNet-Scribble → clean PNG/SVG; optional FreeTikZ pass for simple line art.<br> – **Analytical graphs:** parse function + range → regenerate with Matplotlib / PGFPlots. | Converts figures into high-quality assets. |
| **LaTeX Generation Module** | Assemble VLM LaTeX + `\includegraphics{diagram_n}` or generated TikZ/PGFPlots into one `.tex`. | — |
| **User Interface (optional)** | Upload, progress bar, thumbnail review of masked regions, download `.tex` / PDF. | Adds “keep/mask” toggle per region for fail-safe review. |

---

## 3  Technology Stack  

* **Python** backend  
* `PyMuPDF`, `pdf2image` – page → image  
* **YOLOv8 + LoRA** – segmentation  
* `pytesseract` / **PaddleOCR** – glyph detection (IoU filter)  
* **ControlNet-Scribble**, Stable Diffusion 3 – diagram clean-up  
* **Matplotlib / PGFPlots** – graph regeneration  
* **LaTeX assembly** – Python string templates or `pylatex`  
* Optional UI – **Flask** + HTMX for interactive review  

---

## 4  Workflow  

```mermaid
graph TD
  A(PDF) --> B[Render pages/chunks]
  B --> C[YOLO detector]
  C -->|mask diagram boxes| D[Masked image]
  C -->|crop boxes| F[Figure crops]
  D --> E[VLM → LaTeX + placeholders]
  F --> G[Diagram/Graph module → PNG/SVG/TikZ]
  E & G --> H[LaTeX assembler]
  H --> I[.tex + compiled PDF]
