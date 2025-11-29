#!/usr/bin/env python3
"""
Vastu Sastra Metadata Generation Script

This script generates JSON metadata files for Vastu Sastra chapter PDFs using Google's Gemini API.

Requirements:
    - Python 3.9 or higher
    - google-generativeai package: pip install google-generativeai
    - GOOGLE_API_KEY environment variable set

Usage:
    python3 scripts/create_vastu_sastra_metadata.py
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
        print("   python3 scripts/create_vastu_sastra_metadata.py")
        print("\n2. Or create a new conda environment with Python 3.9+:")
        print("   conda create -n vastu_env python=3.9")
        print("   conda activate vastu_env")
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

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/VastuShastra/Vastu Sastra"
SCRIPTURE_NAME = "Vastu Sastra"

PROMPT_TEMPLATE = """You are a distinguished AI assistant with profound expertise in Vāstu Śāstra (the ancient Indian science of architecture), traditional Indian architecture, design principles, spatial planning, and the teachings attributed to Viśvakarma. Working strictly from the PDF chapter provided, craft a single, well-formed JSON object that adheres to the existing metadata schema used across the library.

Vāstu Śāstra is the traditional Indian system of architecture and design that harmonizes buildings with cosmic forces, natural energies, and the Vāstu Puruṣa Maṇḍala. It encompasses principles of site selection, orientation, spatial arrangement, proportions, materials, and the metaphysical aspects of architecture. This knowledge guides the design of homes, temples, palaces, and entire cities to promote health, prosperity, and spiritual well-being.

Your metadata must capture the architectural wisdom, design principles, and practical guidance of this chapter so that readers seeking to understand traditional Indian architecture, spatial design, building principles, and the application of Vāstu Śāstra in modern contexts can all benefit. Observe the following requirements:

1. "chapterTitle": Extract the exact chapter title as presented in the PDF (e.g., "Chapter 1: Introductory" or "Chapter 2: The Scope and Subject Matter of Architecture"). Return a clean string. Include chapter numbers and part information when present in the PDF.

2. "aiSummary": Deliver a 5-7 sentence synthesis highlighting: the main architectural or design topic addressed (e.g., fundamental canons, town planning, temple architecture, spatial principles), the key Vāstu Śāstra principles or concepts discussed, the practical applications or design guidelines provided, the historical or cultural context when relevant, and why this chapter matters for understanding traditional Indian architecture, modern architectural design, or the application of Vāstu principles in contemporary spaces.

3. "keyConcepts": Provide 7-10 pivotal Sanskrit terms, architectural principles, or design concepts discussed in the chapter. Each list item must be an object with "term" (IAST transliteration, e.g., "vāstu", "puruṣa maṇḍala", "śālā", "prāsāda", "nagara", "grha") and "definition" (succinct, context-aware explanation that includes architectural or design significance when relevant). Prioritize vocabulary around: vāstu (architecture/site), puruṣa maṇḍala (cosmic diagram), śālā (hall), prāsāda (temple/palace), nagara (town/city), grha (house), orientation principles, spatial divisions, proportions, materials, and other chapter-relevant architectural and design concepts.

4. "searchTags": Supply 15-20 search tags as plain strings that broaden discovery. Mix at least four categories of tags: (a) architecture and design students (e.g., "Vastu Shastra", "Traditional Indian architecture", "Architectural principles", "Spatial design"), (b) practitioners and builders (e.g., "Building design", "Site planning", "Orientation principles", "Vastu for homes"), (c) cultural and historical researchers (e.g., "Ancient Indian architecture", "Temple architecture", "Town planning", "Vedic architecture"), and (d) general-interest readers (e.g., "Vastu Sastra", "Indian architecture", "Sacred architecture", "Design wisdom"). Include related Sanskrit terms, modern architectural terminology, and practical application tags when helpful.

5. "deeperInsights": An object with two sub-fields:
   * "philosophicalViewpoint": Note how this chapter frames the relationship between architecture, space, cosmic forces, and human well-being—reference the integration of metaphysical principles with practical design, the harmony between built environment and natural forces, the role of architecture in supporting spiritual and material prosperity, or the scientific and philosophical foundations of Vāstu Śāstra. Explain how the chapter demonstrates the holistic approach of traditional Indian architecture.
   * "practicalAdvice": An array of 3-5 strings (NOT objects), each string distilling actionable insights from the chapter—e.g., guidance on site selection, building orientation, spatial arrangement, design proportions, material choices, or applying Vāstu principles in modern architecture. Each string should be concise and faithful to the chapter's teaching. Example format: ["First piece of advice", "Second piece of advice", "Third piece of advice"].

Constraints:
- Use only the supplied PDF; no external knowledge or interpolation beyond what is in the chapter.
- Output nothing but the JSON object—no markdown, preamble, or commentary.
- Preserve valid JSON throughout (double quotes, proper escaping).
- Focus on the chapter's architectural principles, design guidelines, and practical applications rather than general philosophical themes alone.
- Maintain precision in describing architectural concepts, spatial arrangements, and design principles.
- Recognize that this is a practical and technical treatise on architecture requiring accuracy in terminology and design guidance.
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
    # Try parent folder name first (e.g., "Part 1 The Fundamental Canons")
    parent_name = pdf_path_obj.parent.name
    
    # Extract chapter info from PDF filename
    filename = pdf_path_obj.stem
    # Clean up common patterns
    cleaned = filename.replace("_", " ").replace("-", " ")
    # Remove "Chapter" prefix if present
    cleaned = re.sub(r"^Chapter\s+\d+\s*[-:]?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    if cleaned and len(cleaned) > 5:
        return cleaned
    
    # Fallback: use parent folder name
    if parent_name and "Part" in parent_name:
        return parent_name
    
    return "Vastu Sastra Chapter"


def should_process_pdf(pdf_path: Path, root_path: Path) -> bool:
    """Return True if PDF should be processed (not a root-level file)."""
    
    # Skip if PDF is directly in the Vastu Sastra root directory
    if pdf_path.parent == root_path:
        return False
    
    # Additional check: skip known root-level files
    root_level_files = [
        "Mayamata_ENGLISH.pdf",
        "Vastu-Sastra-English-Vol1.pdf",
        "Vastu-Sastra-English-Vol2-Iconography & Paintings.pdf",
        "Viswakarma_Vastusastram_Sanskrit.pdf"
    ]
    if pdf_path.name in root_level_files:
        return False
    
    # Process PDFs that are in Part folders (e.g., "Part 1 The Fundamental Canons")
    # Check if parent folder name matches part pattern
    parent_name = pdf_path.parent.name
    part_pattern = re.compile(r".*Part\s+\d+.*", re.IGNORECASE)
    if part_pattern.match(parent_name):
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
    print("VASTU SASTRA METADATA GENERATOR")
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
        print("Note: Root-level PDFs (like Mayamata_ENGLISH.pdf) are skipped.")
        return

    print(f"Found {len(pdf_files)} chapter PDF file(s) to process.")
    print(f"(Skipped {len(all_pdfs) - len(pdf_files)} root-level PDF file(s))")
    
    # Group by part for better reporting
    part_counts = {}
    for pdf in pdf_files:
        parent_name = pdf.parent.name
        part_counts[parent_name] = part_counts.get(parent_name, 0) + 1
    
    print("\nChapters by Part:")
    for part_folder, count in sorted(part_counts.items()):
        print(f"  {part_folder}: {count} file(s)")
    
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

