import os
import json
import time
import re
from pathlib import Path

import google.generativeai as genai

# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/NatyaShastra"

PROMPT_TEMPLATE = """You are a meticulous AI research assistant with deep expertise in the Nāṭyaśāstra of Bharata Muni, Indian dramaturgy, classical dance, and performance theory. Working strictly from the PDF chapter provided, craft a single, well-formed JSON object that adheres to the existing metadata schema used across the library.

Your metadata must balance technical precision with accessibility so that performers, wisdom seekers, and general-interest readers can all benefit. Observe the following requirements:

1. "chapterTitle": Extract the exact chapter title as presented in the PDF (e.g., "CHAPTER X. ON HEAD MOVEMENTS"). Return a clean string.
2. "aiSummary": Deliver a 4-6 sentence synthesis highlighting key dramatic principles, stagecraft methods, cultural or philosophical framing, and why the material matters for modern learners (artists, contemplatives, curious readers).
3. "keyConcepts": Provide 6-8 pivotal Sanskrit/technical terms discussed in the chapter. Each list item must be an object with "term" (IAST transliteration when possible) and "definition" (succinct, context-aware explanation). Prioritize vocabulary around rasa theory, abhinaya, angika, stage design, rhythmic frameworks, or other chapter-relevant techniques.
4. "searchTags": Supply 12-18 search tags as plain strings that broaden discovery. Mix at least three tags aimed at: (a) performing artists (e.g., "Performing Arts - Hasta Mudrā"), (b) contemplative or wisdom-oriented seekers (e.g., "Rasa theory meditation"), and (c) general-interest learners (e.g., "History of Indian theatre"). Include related technical terms, pedagogy cues, and modern synonyms when helpful.
5. "deeperInsights": An object with two sub-fields:
   * "philosophicalViewpoint": Note how the chapter frames aesthetics, cognition, or pedagogy—reference rasa, bhāva, dharma, or cosmic order when applicable.
   * "practicalAdvice": A bulleted list (2-4 items) distilling actionable guidance—e.g., rehearsal drills, staging cautions, pedagogical sequencing, vocal techniques. Each bullet should be concise and faithful to the PDF.

Constraints:
- Use only the supplied PDF; no external knowledge or interpolation.
- Output nothing but the JSON object—no markdown, preamble, or commentary.
- Preserve valid JSON throughout (double quotes, proper escaping).
"""


# ============================================================================
# API CONFIGURATION
# ============================================================================


def configure_api():
    """Configures the Google Generative AI API using an environment variable."""

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is not set")

    genai.configure(api_key=api_key)
    print("Google Generative AI API configured successfully")


# ============================================================================
# METADATA GENERATION HELPERS
# ============================================================================


def clean_response_text(text: str) -> str:
    """Return a sanitised JSON string from the model response."""

    # Remove control characters that can invalidate JSON
    text = re.sub(r"[\x00-\x1F\x7F]", "", text)

    # Remove optional markdown fences
    text = re.sub(r"^```(json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)

    first_brace = text.find("{")
    last_brace = text.rfind("}")

    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace : last_brace + 1]

    print("Warning: Could not isolate a JSON object from the model response.")
    return ""


def derive_title_from_filename(pdf_path: str) -> str:
    """Derive a reasonable chapter title from the PDF filename if missing."""

    filename = Path(pdf_path).stem
    # Remove leading "Chapter" labels and replace underscores/dashes with spaces
    cleaned = re.sub(r"^Chapter[_-]*", "", filename, flags=re.IGNORECASE)
    cleaned = re.sub(r"[_-]", " ", cleaned).strip()
    # Title case but preserve all-caps abbreviations by splitting
    return cleaned.replace("  ", " ")


def generate_metadata_for_file(pdf_path: str):
    """Generate and persist metadata for a single PDF file."""

    print(f"\nProcessing: {pdf_path}")
    try:
        print("Reading PDF file...")
        with open(pdf_path, "rb") as f:
            pdf_data = f.read()

        pdf_inline = {"mime_type": "application/pdf", "data": pdf_data}

        model = genai.GenerativeModel("gemini-2.5-pro")
        print("Generating metadata with Gemini 2.5 Pro...")
        response = model.generate_content([PROMPT_TEMPLATE, pdf_inline])

        response_text = response.text
        print(f"Raw response length: {len(response_text)} characters")

        cleaned_response = clean_response_text(response_text)
        if not cleaned_response:
            raise ValueError("Cleaned response is empty. Skipping JSON parsing.")

        print(f"Cleaned response preview: {cleaned_response[:150]}...")
        metadata = json.loads(cleaned_response)
        print("Metadata generated successfully.")

        if not metadata.get("chapterTitle"):
            fallback_title = derive_title_from_filename(pdf_path)
            metadata["chapterTitle"] = fallback_title
            print(f"Used filename to set chapter title: {fallback_title}")

        json_path = pdf_path.replace(".pdf", ".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        print(f"Saved metadata to: {json_path}")
        return metadata

    except json.JSONDecodeError as exc:
        print(f"Error: Failed to parse JSON response for {pdf_path}.")
        print(f"JSON error details: {exc}")
        print(f"Problematic cleaned response: {cleaned_response[:500]}...")
        return None
    except Exception as exc:
        print(f"An unexpected error occurred while processing {pdf_path}: {exc}")
        return None


# ============================================================================
# DIRECTORY PROCESSING
# ============================================================================


def process_directory(root_dir: str):
    """Process all PDF files within the provided root directory."""

    print("=" * 80)
    print("NĀṬYAŚĀSTRA METADATA GENERATOR")
    print(f"Root Directory: {root_dir}")
    print("=" * 80)

    root_path = Path(root_dir)
    if not root_path.exists():
        print(f"Error: Directory does not exist: {root_dir}")
        return

    pdf_files = sorted(root_path.rglob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {root_dir} or its subdirectories.")
        return

    print(f"Found {len(pdf_files)} total PDF file(s).")
    processed = skipped = failed = 0

    for pdf_path in pdf_files:
        json_path = pdf_path.with_suffix(".json")
        if json_path.exists():
            print(f"Skipping {pdf_path.name} - metadata already exists.")
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
    print(f"Total files: {len(pdf_files)}")
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





