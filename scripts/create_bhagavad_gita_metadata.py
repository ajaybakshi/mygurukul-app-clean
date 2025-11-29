#!/usr/bin/env python3
"""
Bhagavad Gita Metadata Generation Script

This script generates JSON metadata files for Bhagavad Gita chapter PDFs using Google's Gemini API.

Requirements:
    - Python 3.9 or higher
    - google-generativeai package: pip install google-generativeai
    - GOOGLE_API_KEY environment variable set

Usage:
    python3 scripts/create_bhagavad_gita_metadata.py
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
        print("   python3 scripts/create_bhagavad_gita_metadata.py")
        print("\n2. Or create a new conda environment with Python 3.9+:")
        print("   conda create -n gita_env python=3.9")
        print("   conda activate gita_env")
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

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Epics/Bhagvad_Gita"
SCRIPTURE_NAME = "Bhagavad Gita"

PROMPT_TEMPLATE = """You are a distinguished AI assistant with profound expertise in the Bhagavad Gita, Vedanta philosophy, Sanskrit literature, yoga traditions, and the dialogue between Krishna and Arjuna. Working strictly from the PDF chapter provided, craft a single, well-formed JSON object that adheres to the existing metadata schema used across the library.

The Bhagavad Gita is a sacred dialogue between Lord Krishna and Arjuna on the battlefield of Kurukshetra, addressing profound questions of dharma (duty), karma (action), bhakti (devotion), jñāna (knowledge), and mokṣa (liberation). Each chapter presents a specific yoga (path/teaching) that guides seekers toward spiritual wisdom and practical living.

Your metadata must capture the philosophical depth, practical wisdom, and spiritual teachings of this chapter so that readers seeking guidance on duty, action, devotion, knowledge, and liberation can all benefit. Observe the following requirements:

1. "chapterTitle": Extract the exact chapter title as presented in the PDF (e.g., "Chapter 1: Yoga of the Dejection of Arjuna" or "Bhagavad Gita Chapter 1 - Arjuna Viṣāda Yoga"). Return a clean string. Include chapter numbers and the yoga name when present in the PDF.

2. "aiSummary": Deliver a 5-7 sentence synthesis highlighting: the context of the dialogue (what question or situation Arjuna faces), Krishna's key teachings in this chapter, the specific yoga or path being expounded (e.g., Karma Yoga, Bhakti Yoga, Jñāna Yoga), the philosophical concepts introduced, and why this chapter matters for modern seekers dealing with duty, action, devotion, knowledge, or spiritual liberation. Emphasize the practical relevance of Krishna's guidance.

3. "keyConcepts": Provide 7-10 pivotal Sanskrit terms, philosophical principles, or spiritual concepts discussed in the chapter. Each list item must be an object with "term" (IAST transliteration, e.g., "dharma", "karma yoga", "ātman", "brahman") and "definition" (succinct, context-aware explanation that connects to the chapter's teachings). Prioritize vocabulary around: dharma (duty/righteousness), karma (action), bhakti (devotion), jñāna (knowledge), yoga (path/union), mokṣa (liberation), ātman (self), brahman (ultimate reality), guṇas (qualities), and other chapter-relevant philosophical and spiritual concepts. Include verse references when applicable (e.g., "karma yoga - 3.3").

4. "searchTags": Supply 15-20 search tags as plain strings that broaden discovery. Mix at least four categories of tags: (a) spiritual seekers and practitioners (e.g., "Karma Yoga", "Bhakti teachings", "Dharma guidance", "Spiritual wisdom"), (b) philosophical and scholarly readers (e.g., "Vedanta philosophy", "Hindu philosophy", "Yoga philosophy", "Krishna's teachings"), (c) practical life guidance seekers (e.g., "Duty and action", "Righteous conduct", "Decision making", "Ethical living"), and (d) general-interest readers (e.g., "Bhagavad Gita", "Hindu scripture", "Ancient wisdom", "Spiritual dialogue"). Include related Sanskrit terms, modern synonyms, yoga types, and thematic tags when helpful.

5. "deeperInsights": An object with two sub-fields:
   * "philosophicalViewpoint": Note how this chapter frames reality, duty, action, devotion, knowledge, liberation, or the nature of the self—reference dharma, karma, bhakti, jñāna, mokṣa, ātman, brahman, or the specific yoga being taught. Explain Krishna's perspective on the human condition, the path to liberation, or the relationship between the individual and the divine.
   * "practicalAdvice": An array of 3-5 strings (NOT objects), each string distilling actionable wisdom from Krishna's teachings in this chapter—e.g., guidance on performing duty without attachment, cultivating devotion, pursuing knowledge, managing the mind, or applying spiritual principles in daily life. Each string should be concise and faithful to the chapter's teaching. Example format: ["First piece of advice", "Second piece of advice", "Third piece of advice"].

Constraints:
- Use only the supplied PDF; no external knowledge or interpolation beyond what is in the chapter.
- Output nothing but the JSON object—no markdown, preamble, or commentary.
- Preserve valid JSON throughout (double quotes, proper escaping).
- Focus on the chapter's philosophical teachings, Krishna's guidance, and practical wisdom rather than historical or narrative details alone.
- Recognize that this is part of the larger Bhagavad Gita dialogue, but focus on the specific chapter provided.
- Maintain reverence for the sacred nature of the text while making it accessible to modern seekers.
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
    # Try parent folder name first (e.g., "Bhagavad_Gita_Chapter 1 Yoga of the Dejection of Arjuna")
    parent_name = pdf_path_obj.parent.name
    
    # Extract chapter info from parent folder
    if "Chapter" in parent_name:
        # Clean up the parent folder name
        cleaned = parent_name.replace("Bhagavad_Gita_", "").replace("Bhagvad_Gita_", "")
        cleaned = cleaned.replace("_", " ")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if cleaned:
            return cleaned
    
    # Fallback to PDF filename stem
    filename = pdf_path_obj.stem
    # Clean up common patterns
    cleaned = filename.replace("_", " ").replace("-", " ")
    # Remove "Bhagvad_Gita" or "Bhagavad_Gita" prefix if present
    cleaned = re.sub(r"^(?:Bhagvad|Bhagavad)\s+Gita\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    if cleaned and len(cleaned) > 5:
        return cleaned
    
    return "Bhagavad Gita Chapter"


def should_process_pdf(pdf_path: Path, root_path: Path) -> bool:
    """Return True if PDF should be processed (not a root-level file)."""
    
    # Skip if PDF is directly in the Bhagavad Gita root directory
    if pdf_path.parent == root_path:
        return False
    
    # Additional check: skip known root-level files
    root_level_files = [
        "Bhagavad_Gita_comm_Sankara_English.pdf",
        "Bhagavad_Gita_Radhakrishnan.pdf",
        "Bhagvad_Gita_Sankara_Sanskrit.txt",
        "Bhagvad_Gita_Sanskrit.txt"
    ]
    if pdf_path.name in root_level_files:
        return False
    
    # Process PDFs that are in chapter folders (e.g., "Bhagavad_Gita_Chapter 1 Yoga of the Dejection of Arjuna")
    # Check if parent folder name matches chapter pattern
    parent_name = pdf_path.parent.name
    chapter_pattern = re.compile(r".*Chapter\s+\d+.*", re.IGNORECASE)
    if chapter_pattern.match(parent_name):
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
    print("BHAGAVAD GITA METADATA GENERATOR")
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
        print("Note: Root-level PDFs (like Bhagavad_Gita_comm_Sankara_English.pdf) are skipped.")
        return

    print(f"Found {len(pdf_files)} chapter PDF file(s) to process.")
    print(f"(Skipped {len(all_pdfs) - len(pdf_files)} root-level PDF file(s))")
    
    # Group by chapter for better reporting
    chapter_counts = {}
    for pdf in pdf_files:
        parent_name = pdf.parent.name
        chapter_counts[parent_name] = chapter_counts.get(parent_name, 0) + 1
    
    print("\nChapters found:")
    for chapter_folder, count in sorted(chapter_counts.items()):
        print(f"  {chapter_folder}: {count} file(s)")
    
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

