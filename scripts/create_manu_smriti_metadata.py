import json
import os
import re
import time
from pathlib import Path

import google.generativeai as genai


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/DharmaShastra/Manu_Smriti"
SCRIPTURE_NAME = "Manu Smṛti"

PROMPT_TEMPLATE = """You are a meticulous AI research assistant specializing in Dharmaśāstra, with deep fluency in the Manu Smṛti (Laws of Manu). Using only the supplied PDF chapter, you must produce a single, well-formed JSON object that aligns with our sacred library schema while serving multiple audiences—householders, ethicists, and comparative law scholars.

The JSON object must include:
1. "chapterTitle": Exact chapter heading as given in the PDF (e.g., "Chapter VI – The Rule of Hermits"). Clean any OCR artefacts.
2. "aiSummary": A 4–6 sentence synthesis. Balance historical context, dharmic principles, social regulations, and contemporary relevance for modern readers.
3. "keyConcepts": 6–8 pivotal Sanskrit terms or legal principles. Each entry is an object with "term" (IAST transliteration) and "definition" (precise, chapter-aware explanation). Prioritize concepts around varṇa-āśrama duties, ritual law, ethics, civil or criminal procedure, and social governance.
4. "searchTags": 12–18 discovery tags (strings). Mix queries for: (a) practicing householders, (b) legal-history researchers, (c) interfaith or general-interest learners. Blend Sanskrit keywords with modern equivalents (e.g., "inheritance law", "śrāddha rites guidance").
5. "deeperInsights": Object containing
   • "philosophicalViewpoint" — highlight how the chapter frames dharma, cosmic order, or jurisprudence.
   • "practicalAdvice" — bulleted list (3 items) with concrete guidance the chapter offers (ritual procedures, ethical disciplines, penalties, etc.). Keep bullets concise and faithful to the text.

Constraints:
- Use only the provided PDF; never rely on external memory or prior chapters.
- Output MUST be valid JSON (double quotes, proper escaping) and contain no surrounding commentary.
- Maintain a balanced, scholarly tone that respects the cultural sensitivity of Dharmaśāstra.
"""


# ============================================================================
# API CONFIGURATION
# ============================================================================


def configure_api() -> None:
    """Configure the Google Generative AI API from environment variables."""

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is not set")

    genai.configure(api_key=api_key)
    print("Google Generative AI API configured successfully")


# ============================================================================
# HELPERS
# ============================================================================


def clean_response_text(text: str) -> str:
    """Return a sanitised JSON string from the model response."""

    text = re.sub(r"[\x00-\x1F\x7F]", "", text)
    text = re.sub(r"^```(json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]

    print("Warning: Could not isolate a JSON object from the model response.")
    return ""


def derive_title_from_filename(pdf_path: str) -> str:
    """Fallback title using filename if chapter title missing."""

    stem = Path(pdf_path).stem
    stem = re.sub(r"^Manusmriti[_-]Buhler[_-]", "", stem, flags=re.IGNORECASE)
    stem = stem.replace("_", " ").replace("-", " ")
    return stem.strip()


def should_process_pdf(pdf_path: Path) -> bool:
    """Return True for chapter PDFs (contain '_Chapter_')."""

    return "_Chapter_" in pdf_path.name


# ============================================================================
# METADATA GENERATION
# ============================================================================


def generate_metadata_for_file(pdf_path: str):
    """Generate and persist metadata JSON for a single chapter PDF."""

    print(f"\nProcessing: {pdf_path}")
    try:
        with open(pdf_path, "rb") as f:
            pdf_data = f.read()

        pdf_inline = {"mime_type": "application/pdf", "data": pdf_data}

        model = genai.GenerativeModel("gemini-2.5-pro")
        print("Generating metadata with Gemini 2.5 Pro...")
        response = model.generate_content([PROMPT_TEMPLATE, pdf_inline])

        response_text = response.text
        print(f"Raw response length: {len(response_text)} characters")

        cleaned = clean_response_text(response_text)
        if not cleaned:
            raise ValueError("Cleaned response is empty. Skipping JSON parsing.")

        print(f"Cleaned response preview: {cleaned[:150]}...")
        metadata = json.loads(cleaned)
        print("Metadata parsed successfully.")

        if not metadata.get("chapterTitle"):
            fallback_title = derive_title_from_filename(pdf_path)
            metadata["chapterTitle"] = fallback_title
            print(f"Fallback title applied: {fallback_title}")

        json_path = pdf_path.replace(".pdf", ".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        print(f"Saved metadata to: {json_path}")
        return metadata

    except json.JSONDecodeError as exc:
        print(f"Error: Failed to parse JSON for {pdf_path}.")
        print(f"JSON error details: {exc}")
        print(f"Problematic cleaned response: {cleaned[:500]}...")
        return None
    except Exception as exc:
        print(f"Unexpected error while processing {pdf_path}: {exc}")
        return None


# ============================================================================
# DIRECTORY PROCESSING
# ============================================================================


def process_directory(root_dir: str) -> None:
    """Process qualifying PDFs within the Manu Smṛti directory tree."""

    print("=" * 80)
    print("MANU SMRITI METADATA GENERATOR")
    print(f"Root Directory: {root_dir}")
    print("=" * 80)

    root_path = Path(root_dir)
    if not root_path.exists():
        print(f"❌ Error: Directory does not exist: {root_dir}")
        return

    pdf_files = sorted(pdf for pdf in root_path.rglob("*.pdf") if should_process_pdf(pdf))

    if not pdf_files:
        print("No chapter PDFs found. Ensure files contain '_Chapter_' in their names.")
        return

    print(f"Found {len(pdf_files)} chapter PDF(s).")

    processed = skipped = failed = 0

    for pdf_path in pdf_files:
        json_path = pdf_path.with_suffix(".json")
        if json_path.exists():
            print(f"Skipping {pdf_path.name} — metadata already exists.")
            skipped += 1
            continue

        if generate_metadata_for_file(str(pdf_path)):
            processed += 1
        else:
            failed += 1

        if processed + failed < len(pdf_files) - skipped:
            print("Waiting 3 seconds before next file...")
            time.sleep(3)

    print("\n" + "=" * 80)
    print("PROCESSING COMPLETE")
    print(f"Successfully processed: {processed}")
    print(f"Skipped (already exists): {skipped}")
    print(f"Failed: {failed}")
    print(f"Total considered PDFs: {len(pdf_files)}")
    print("=" * 80)


# ============================================================================
# MAIN EXECUTION
# ============================================================================


if __name__ == "__main__":
    try:
        configure_api()
        process_directory(ROOT_DIRECTORY)
    except Exception as exc:
        print(f"\nFatal Error: {exc}")
        raise





