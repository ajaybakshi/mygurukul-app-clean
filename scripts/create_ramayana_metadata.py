#!/usr/bin/env python3
"""
Ramayana Metadata Generation Script

This script generates JSON metadata files for Ramayana chapter PDFs using Google's Gemini API.

Requirements:
    - Python 3.9 or higher
    - google-generativeai package: pip install google-generativeai
    - GOOGLE_API_KEY environment variable set

Usage:
    python3 scripts/create_ramayana_metadata.py
"""

import os
import json
import time
import re
import sys
from pathlib import Path

# ============================================================================
# DEPENDENCY CHECK
# ============================================================================

def check_dependencies():
    """Check if required dependencies are available."""
    missing = []
    
    # Check Python version (google-generativeai requires Python >= 3.9)
    if sys.version_info < (3, 9):
        print("=" * 80)
        print("ERROR: Python version too old")
        print("=" * 80)
        print(f"Current Python version: {sys.version}")
        print(f"Required Python version: >= 3.9")
        print(f"Python executable: {sys.executable}")
        print("\nTo fix this:")
        print("1. Use Python 3.9 or higher:")
        print("   python3 --version  # Check if python3 is available")
        print("   python3 scripts/create_ramayana_metadata.py")
        print("\n2. Or create a new conda environment with Python 3.9+:")
        print("   conda create -n ramayana_env python=3.9")
        print("   conda activate ramayana_env")
        print("   pip install google-generativeai")
        print("=" * 80)
        return False
    
    # Check google-generativeai
    try:
        import google.generativeai as genai
        return True
    except ImportError:
        print("=" * 80)
        print("ERROR: Missing required dependency")
        print("=" * 80)
        print(f"Python executable: {sys.executable}")
        print(f"Python version: {sys.version.split()[0]}")
        print("\nMissing package: google-generativeai")
        print("\nTo fix this, install the package:")
        print("   pip install google-generativeai")
        print("\nIf you're using a virtual environment, make sure it's activated.")
        print("=" * 80)
        return False

# Note: google.generativeai will be imported after dependency check passes

# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Epics/Ramayana"
SCRIPTURE_NAME = "Valmiki Ramayana"

PROMPT_TEMPLATE = """You are a meticulous AI research assistant with deep expertise in the Valmiki Rāmāyaṇa, Sanskrit epic poetry, dharma (righteousness), itihāsa (history/epic), and ancient Indian narrative traditions. Working strictly from the PDF chapter (sarga) provided, craft a single, well-formed JSON object that adheres to the existing metadata schema used across the library.

Your metadata must balance narrative richness with ethical and spiritual insight so that readers seeking wisdom, moral guidance, cultural understanding, and epic storytelling can all benefit. Observe the following requirements:

1. "chapterTitle": Extract the exact chapter title as presented in the PDF (e.g., "Chapter 1 Shri Narada relates to Valmiki the story of Rama" or "Sarga 1"). Return a clean string. Include chapter/sarga numbers if present in the PDF.

2. "aiSummary": Deliver a 4-6 sentence synthesis highlighting: the main characters and their roles (Rama, Sita, Lakshmana, Hanuman, Ravana, or other key figures), the narrative progression or story elements, the dharma (righteous duty) or ethical teaching, and why this sarga matters for modern readers seeking wisdom, moral guidance, or cultural understanding of the epic tradition.

3. "keyConcepts": Provide 6-8 pivotal Sanskrit terms, ethical principles, or narrative concepts discussed in the sarga. Each list item must be an object with "term" (IAST transliteration when possible, or English term) and "definition" (succinct, context-aware explanation). Prioritize vocabulary around dharma (duty/righteousness), bhakti (devotion), karma (action), rājadharma (duty of kings), vānaprastha (forest-dwelling), yuddha (war), and other sarga-relevant epic and ethical concepts.

4. "searchTags": Supply 12-18 search tags as plain strings that broaden discovery. Mix at least three tags aimed at: (a) wisdom seekers and moral learners (e.g., "Dharma teachings", "Ethical guidance", "Righteous conduct"), (b) epic and literary enthusiasts (e.g., "Epic poetry", "Ramayana stories", "Sanskrit literature"), and (c) general-interest readers (e.g., "Hindu epics", "Ancient Indian narratives", "Rama and Sita"). Include related Sanskrit terms, modern synonyms, character names, and thematic tags when helpful.

5. "deeperInsights": An object with two sub-fields:
   * "philosophicalViewpoint": Note how the sarga frames dharma, righteousness, duty, human nature, or divine purpose—reference dharma, bhakti, karma, rājadharma, or practical wisdom when applicable.
   * "practicalAdvice": An array of 2-4 strings (NOT objects), each string distilling actionable wisdom from the sarga—e.g., guidance on duty, ethical conduct, leadership, devotion, or applying dharma in daily life. Each string should be concise and faithful to the sarga's teaching. Example format: ["First piece of advice", "Second piece of advice", "Third piece of advice"].

Constraints:
- Use only the supplied PDF; no external knowledge or interpolation.
- Output nothing but the JSON object—no markdown, preamble, or commentary.
- Preserve valid JSON throughout (double quotes, proper escaping).
- Focus on the sarga's narrative, ethical teaching, and epic elements rather than technical treatises.
- When the sarga contains stories, emphasize the narrative elements, characters, and moral/dharmic lessons.
- Recognize that this is part of the larger Ramayana epic, but focus on the specific sarga provided.
"""


# ============================================================================
# API CONFIGURATION
# ============================================================================


def configure_api():
    """Configures the Google Generative AI API using an environment variable."""
    # Import here after dependency check has passed
    import google.generativeai as genai
    
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is not set")

    genai.configure(api_key=api_key)
    print("Google Generative AI API configured successfully")
    return genai


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
    """Simple fallback title extraction from filename (only used if Gemini fails to extract title)."""
    
    pdf_path_obj = Path(pdf_path)
    # Extract from PDF filename
    filename = pdf_path_obj.stem
    
    # Clean up common patterns
    # "CHAPTER 1 Shri Narada relates to Valmiki the story of Rama" -> "Shri Narada relates to Valmiki the story of Rama"
    cleaned = filename.replace("_", " ")
    
    # Remove "CHAPTER" or "Chapter" prefix with number if present
    cleaned = re.sub(r"^(?:CHAPTER|Chapter)\s+\d+\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^Sarga\s+\d+\s*[-–]?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    # If we have a meaningful title, return it
    if cleaned and len(cleaned) > 5:
        return cleaned
    
    # Fallback: try to get kanda name from parent folder
    parent_name = pdf_path_obj.parent.name
    if parent_name and "Kanda" in parent_name:
        # Extract kanda number and name
        kanda_match = re.search(r"(\d+)\.\s*(.+)", parent_name)
        if kanda_match:
            kanda_num = kanda_match.group(1)
            kanda_name = kanda_match.group(2).strip()
            return f"Ramayana {kanda_name} - Chapter"
    
    return "Ramayana Chapter"


def should_process_pdf(pdf_path: Path, root_path: Path) -> bool:
    """Return True if PDF should be processed (not a root-level file)."""
    
    # Skip if PDF is directly in the Ramayana root directory
    if pdf_path.parent == root_path:
        return False
    
    # Additional check: skip known root-level files
    root_level_files = [
        "Ramayana_of_Valmiki_by_Hari_Prasad_Shastri-English.pdf",
        "Valmiki-Ramayana_Sanskrit.txt"
    ]
    if pdf_path.name in root_level_files:
        return False
    
    # Process PDFs that are in kanda folders (e.g., "1. Bala Kanda", "2. Ayodhya Kanda")
    # Check if parent folder name matches kanda pattern
    parent_name = pdf_path.parent.name
    kanda_pattern = re.compile(r"^\d+\.\s+.+", re.IGNORECASE)
    if kanda_pattern.match(parent_name):
        return True
    
    return True  # Default to processing if unsure


# ============================================================================
# METADATA GENERATION
# ============================================================================


def generate_metadata_for_file(pdf_path: str):
    """Generate and persist metadata for a single PDF file."""
    # Import here after dependency check has passed
    import google.generativeai as genai

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

        # Fix practicalAdvice format if needed (ensure it's an array of strings, not objects)
        if metadata.get("deeperInsights") and isinstance(metadata["deeperInsights"], dict):
            practical_advice = metadata["deeperInsights"].get("practicalAdvice")
            if practical_advice and isinstance(practical_advice, list):
                # Convert objects to strings if needed
                fixed_advice = []
                for item in practical_advice:
                    if isinstance(item, str):
                        fixed_advice.append(item)
                    elif isinstance(item, dict):
                        # Extract text from common object keys
                        text = item.get("point") or item.get("advice") or item.get("text") or str(item)
                        if text:
                            fixed_advice.append(str(text))
                    else:
                        fixed_advice.append(str(item))
                metadata["deeperInsights"]["practicalAdvice"] = fixed_advice
                if fixed_advice != practical_advice:
                    print("Fixed practicalAdvice format: converted objects to strings")

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
    """Process all PDF files within the provided root directory, excluding root-level files."""

    print("=" * 80)
    print("VALMIKI RĀMĀYAṆA METADATA GENERATOR")
    print(f"Root Directory: {root_dir}")
    print("=" * 80)

    root_path = Path(root_dir)
    if not root_path.exists():
        print(f"Error: Directory does not exist: {root_dir}")
        return

    # Find all PDFs recursively
    all_pdfs = list(root_path.rglob("*.pdf"))
    
    # Filter out root-level PDFs
    pdf_files = sorted([pdf for pdf in all_pdfs if should_process_pdf(pdf, root_path)])
    
    if not pdf_files:
        print(f"No chapter PDF files found in {root_dir} or its subdirectories.")
        print("Note: Root-level PDFs (like Ramayana_of_Valmiki_by_Hari_Prasad_Shastri-English.pdf) are skipped.")
        return

    print(f"Found {len(pdf_files)} chapter PDF file(s) to process.")
    print(f"(Skipped {len(all_pdfs) - len(pdf_files)} root-level PDF file(s))")
    
    # Group by kanda for better reporting
    kanda_counts = {}
    for pdf in pdf_files:
        parent_name = pdf.parent.name
        kanda_counts[parent_name] = kanda_counts.get(parent_name, 0) + 1
    
    print("\nChapters by Kanda:")
    for kanda_folder, count in sorted(kanda_counts.items()):
        print(f"  {kanda_folder}: {count} chapters")
    
    processed = skipped = failed = 0

    for pdf_path in pdf_files:
        json_path = pdf_path.with_suffix(".json")
        if json_path.exists():
            print(f"\nSkipping {pdf_path.name} - metadata already exists.")
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
    print(f"Total chapter PDFs considered: {len(pdf_files)}")
    print("=" * 80)


# ============================================================================
# MAIN EXECUTION
# ============================================================================


if __name__ == "__main__":
    try:
        # Check dependencies first
        if not check_dependencies():
            sys.exit(1)
        
        configure_api()
        process_directory(ROOT_DIRECTORY)
    except Exception as exc:
        print(f"\nFatal Error: {exc}")
        raise

