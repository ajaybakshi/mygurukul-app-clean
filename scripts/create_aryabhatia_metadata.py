import json
import os
import re
import time
from pathlib import Path

import google.generativeai as genai


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Vigyan/Aryabhatia"

PROMPT_TEMPLATE = """You are an expert AI assistant specialising in the Āryabhaṭīya of Āryabhaṭa, adept in history of mathematics, astronomy, and Sanskrit verse. Using only the provided PDF chapter, generate a single JSON object that matches our metadata schema and supports deep search for three audiences: (i) mathematics students, (ii) scientists/astronomers, (iii) curious explorers.

Output requirements:
1. "chapterTitle": Exact chapter title or section name from the PDF (e.g., "Gaṇitapāda – Verse 1"). Clean OCR noise; keep diacritics where present.
2. "aiSummary": A 4–6 sentence explainer covering the chapter’s mathematical or astronomical contribution, its historical significance (e.g., positional notation, sine tables, astronomical constants), and how it informs modern STEM exploration.
3. "keyConcepts": 6–8 crucial technical terms, formulae, or concepts. Each entry must be an object with:
   • "term" – IAST transliteration (retain symbols like ṛ, ṇ).
   • "definition" – clear explanation referencing the chapter (e.g., verse purpose, formula, method). Include numeric constants or equations when relevant.
4. "searchTags": 14–18 tags (strings) that amplify discovery. Include:
   • At least four tags for mathematics students (e.g., "modular arithmetic", "place-value notation").
   • At least four for science/astronomy students (e.g., "sidereal day", "epicycle model").
   • At least four approachable phrases for general audiences (e.g., "ancient Indian math genius"). Mix Sanskrit keywords, modern terminology, and teaching cues.
5. "deeperInsights": object with:
   • "philosophicalViewpoint": How the chapter frames knowledge (e.g., synthesis of observation and calculation, epistemic humility, cosmology).
   • "practicalAdvice": bullet list (3–4 items) capturing actionable insights: computational steps, mnemonic summaries, study recommendations, or experiment ideas. Keep each bullet a concise string.

Constraints:
- Base every field solely on the PDF content; do not invent verses.
- Output must be valid JSON without surrounding commentary or markdown.
- Maintain a precise, research-friendly tone while staying accessible to interdisciplinary learners.
"""


# ============================================================================
# API CONFIGURATION
# ============================================================================


def configure_api() -> None:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is not set")

    genai.configure(api_key=api_key)
    print("Google Generative AI API configured successfully")


# ============================================================================
# HELPERS
# ============================================================================


def clean_response_text(text: str) -> str:
    """Strip control characters and code fences, returning the JSON body."""

    text = re.sub(r"[\x00-\x1F\x7F]", "", text)
    text = re.sub(r"^```(json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)

    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        return text[first : last + 1]

    print("Warning: Could not isolate JSON object in response.")
    return ""


def derive_title_from_filename(pdf_path: str) -> str:
    """Fallback chapter title derived from filename."""

    stem = Path(pdf_path).stem
    stem = re.sub(r"^Chapter_\d+_", "", stem)
    stem = stem.replace("_", " ")
    return stem.strip().title()


def is_chapter_pdf(pdf: Path) -> bool:
    return pdf.name.lower().startswith("chapter_") and pdf.suffix.lower() == ".pdf"


# ============================================================================
# METADATA GENERATION
# ============================================================================


def generate_metadata_for_file(pdf_path: str):
    print(f"\nProcessing: {pdf_path}")
    try:
        with open(pdf_path, "rb") as f:
            pdf_data = f.read()

        model = genai.GenerativeModel("gemini-2.5-pro")
        response = model.generate_content([PROMPT_TEMPLATE, {"mime_type": "application/pdf", "data": pdf_data}])

        response_text = response.text
        print(f"Raw response length: {len(response_text)} characters")

        cleaned = clean_response_text(response_text)
        if not cleaned:
            raise ValueError("Cleaned response empty; skipping JSON parsing.")

        print(f"Cleaned response preview: {cleaned[:160]}...")
        metadata = json.loads(cleaned)
        print("Metadata parsed successfully.")

        if not metadata.get("chapterTitle"):
            fallback = derive_title_from_filename(pdf_path)
            metadata["chapterTitle"] = fallback
            print(f"Fallback title applied: {fallback}")

        json_path = pdf_path.replace(".pdf", ".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        print(f"Saved metadata to: {json_path}")
        return metadata

    except json.JSONDecodeError as exc:
        print(f"Error: Failed to parse JSON for {pdf_path}: {exc}")
        print(f"Problematic cleaned response: {cleaned[:500]}...")
        return None
    except Exception as exc:
        print(f"Unexpected error while processing {pdf_path}: {exc}")
        return None


# ============================================================================
# DIRECTORY PROCESSING
# ============================================================================


def process_directory(root_dir: str) -> None:
    print("=" * 80)
    print("ĀRYABHAṬĪYA METADATA GENERATOR")
    print(f"Root Directory: {root_dir}")
    print("=" * 80)

    root_path = Path(root_dir)
    if not root_path.exists():
        print(f"❌ Error: Directory does not exist: {root_dir}")
        return

    pdf_files = sorted(pdf for pdf in root_path.rglob("*.pdf") if is_chapter_pdf(pdf))
    if not pdf_files:
        print("No chapter PDFs found (expected names like 'Chapter_1_...').")
        return

    print(f"Found {len(pdf_files)} chapter PDF(s).")

    processed = skipped = failed = 0

    for pdf in pdf_files:
        json_path = pdf.with_suffix(".json")
        if json_path.exists():
            print(f"Skipping {pdf.name} — metadata already exists.")
            skipped += 1
            continue

        if generate_metadata_for_file(str(pdf)):
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





