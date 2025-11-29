import json
import os
import re
import time
from pathlib import Path

import google.generativeai as genai


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Yoga/Patanjali_Yogasutra"

PROMPT_TEMPLATE = """You are an erudite AI assistant steeped in Patañjali’s Yoga Sūtras, Sanskrit philology, yoga philosophy, and evidence-based contemplative science. Using only the supplied PDF chapter, produce a single, well-formed JSON object that enriches search for three audiences: (1) serious yoga practitioners/teachers, (2) scholars and mental-health researchers, (3) curious spiritual explorers.

Required JSON structure:
1. "chapterTitle": Exact chapter/section header found in the PDF (e.g., "Samādhipāda – Aphorisms 1-10"). Clean OCR noise but keep diacritics when provided.
2. "aiSummary": A 4–6 sentence synthesis capturing: key sūtra themes, philosophical framing, practical implications for practice (āsana, prāṇāyāma, meditation), and any psychological or neuroscientific resonance.
3. "keyConcepts": 6–8 pivotal Sanskrit terms or sutra references. Each entry must be an object with:
   • "term" – IAST transliteration plus the sutra number if applicable (e.g., "citta vṛtti – I.2").
   • "definition" – precise explanation contextualised by the chapter (include practice cues, philosophical meaning, or contemporary parallels).
4. "searchTags": 16–20 discovery tags (strings). Ensure coverage for:
   • Practitioners (e.g., "eight-limbed practice", "meditation sequencing").
   • Researchers/therapists (e.g., "cognitive regulation", "polyvagal parallels").
   • General explorers (e.g., "meaning of yoga", "mind stillness teachings"). Mix Sanskrit keywords with modern terminology and question-style queries.
5. "deeperInsights": object containing:
   • "philosophicalViewpoint": 2–4 sentences illuminating how the chapter frames reality, mind, liberation, or ethics.
   • "practicalAdvice": bullet list (3–4 strings) offering actionable steps—practice prescriptions, journaling prompts, contemplative experiments, or cautions described in the text.

Constraints:
- Base every field strictly on the PDF content; do not invent verses or commentary not present.
- Output must be valid JSON only (no markdown).
- Maintain a compassionate yet scholarly tone that honours the tradition while supporting modern seekers.
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
    """Return sanitised JSON fragment stripped of fences/control chars."""

    text = re.sub(r"[\x00-\x1F\x7F]", "", text)
    text = re.sub(r"^```(json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]

    print("Warning: Could not isolate JSON in response.")
    return ""


def derive_title_from_filename(pdf_path: str) -> str:
    """Fallback chapter title from filename."""

    stem = Path(pdf_path).stem
    stem = stem.replace("_", " ")
    stem = re.sub(r"^Chapter \d+ ", "", stem, flags=re.IGNORECASE)
    return stem.strip().title()


def is_yoga_chapter(pdf: Path) -> bool:
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
            raise ValueError("Cleaned response empty; skipping JSON parse.")

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
    print("PATAÑJALI YOGA SŪTRA METADATA GENERATOR")
    print(f"Root Directory: {root_dir}")
    print("=" * 80)

    root_path = Path(root_dir)
    if not root_path.exists():
        print(f"❌ Error: Directory does not exist: {root_dir}")
        return

    pdf_files = sorted(pdf for pdf in root_path.rglob("*.pdf") if is_yoga_chapter(pdf))
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
