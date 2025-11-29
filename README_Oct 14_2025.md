# MyGurukul Sacred Library - Metadata Pipeline

This document outlines the architecture, workflow, and usage instructions for the automated pipeline that generates rich metadata for the MyGurukul Sacred Library.

## 1. Overview

The purpose of this pipeline is to process chapter-wise PDF files of sacred texts (e.g., Caraka Saṃhitā) and generate structured JSON metadata for each chapter using the Google Gemini 2.5 Pro API. This AI-enriched metadata powers the Sacred Library's advanced search and interactive exploration features.

The core principle is a **Manual-Then-Automate** workflow:
*   **Manual Curation**: An expert curator (you) is responsible for splitting the large, monolithic scripture PDFs into clean, individual chapter-based PDF files.
*   **Automated Processing**: A Python script (`create_library_metadata.py`) then processes this curated library, generating one `.json` metadata file for each `.pdf` chapter file.

## 2. The Metadata Structure

Each generated JSON file contains the following fields, derived directly from the source PDF:
*   `aiSummary`: A comprehensive 3-5 sentence summary of the chapter's core teachings.
*   `keyConcepts`: An array of 5-7 important Sanskrit terms with their definitions.
*   `searchTags`: A diverse array of 10-15 keywords and synonyms to maximize search discoverability.
*   `deeperInsights`: An object containing the chapter's unique `philosophicalViewpoint` and a list of `practicalAdvice`.

## 3. Workflow & Usage

### Step 1: Prepare Source Files
Ensure your scripture is split into individual chapter PDFs and organized in a clear folder structure (e.g., `/Caraka_Samhita/Section_1_Sutrasthana/Chapter_1.pdf`).

### Step 2: Configure Environment
Open your terminal and set the required environment variable for the API key. This command must be run once per terminal session.

```bash
export GOOGLE_API_KEY='YOUR_API_KEY_HERE'
```

### Step 3: Run the Pipeline
Execute the main Python script from your project directory.

```bash
python create_library_metadata.py
```

The script will automatically find all unprocessed chapter PDFs, generate their metadata, and save the corresponding `.json` files in the same location. It will show detailed progress and a final summary upon completion.

### Step 4: Deploy to Cloud Storage
After the script finishes, manually upload the entire updated folder structure (containing both the `.pdf` and new `.json` files) to your Google Cloud Storage bucket. Ensure you remove any old, monolithic versions of the scripture to avoid conflicts.

## 4. Key Architectural Decisions
*   **Individual Files**: We use one PDF and one JSON file per chapter. This is more performant, scalable, and maintainable than using large, consolidated files.
*   **Grounded Generation**: The script forces the AI to base its output **only** on the provided PDF content, ensuring data integrity and preventing hallucinations.
*   **Forced JSON Output**: The API call uses the `response_mime_type="application/json"` parameter to guarantee that the model's output is always valid, well-structured JSON, preventing parsing errors.

---
*This document was generated to capture the successful architecture and workflow for the MyGurukul AI project as of October 14, 2025.*
