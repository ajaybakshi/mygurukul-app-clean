import os
import json
import time
import re
from pathlib import Path

import google.generativeai as genai

# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/NitiShastra/Panchatantra"

PROMPT_TEMPLATE = """You are a meticulous AI research assistant with deep expertise in the Pañcatantra, ancient Indian fables, nītiśāstra (political and moral wisdom), and storytelling traditions. Working strictly from the PDF story provided, craft a single, well-formed JSON object that adheres to the existing metadata schema used across the library.

Your metadata must balance narrative richness with ethical insight so that readers seeking wisdom, moral guidance, and cultural understanding can all benefit. Observe the following requirements:

1. "chapterTitle": Extract the exact story title as presented in the PDF (e.g., "The Monkey and the Log"). Return a clean string. If the story is part of a frame narrative, include both the frame and story title when relevant.

2. "aiSummary": Deliver a 4-6 sentence synthesis highlighting: the main characters and their roles, the plot progression, the moral lesson or ethical teaching (nīti), and why this story matters for modern readers seeking wisdom, leadership guidance, or cultural understanding.

3. "keyConcepts": Provide 6-8 pivotal Sanskrit terms, ethical principles, or narrative concepts discussed in the story. Each list item must be an object with "term" (IAST transliteration when possible, or English term) and "definition" (succinct, context-aware explanation). Prioritize vocabulary around nīti (wisdom/ethics), dharma (duty), friendship, leadership, deception, wisdom, and other story-relevant moral concepts.

4. "searchTags": Supply 12-18 search tags as plain strings that broaden discovery. Mix at least three tags aimed at: (a) wisdom seekers and moral learners (e.g., "Moral fables", "Ethical teachings"), (b) leadership and strategy enthusiasts (e.g., "Leadership wisdom", "Political strategy"), and (c) general-interest readers (e.g., "Indian fables", "Animal stories", "Ancient wisdom tales"). Include related Sanskrit terms, modern synonyms, and thematic tags when helpful.

5. "deeperInsights": An object with two sub-fields:
   * "philosophicalViewpoint": Note how the story frames ethics, wisdom, human nature, or social dynamics—reference nīti, dharma, friendship, trust, or practical wisdom when applicable.
   * "practicalAdvice": An array of 2-4 strings (NOT objects), each string distilling actionable wisdom from the story—e.g., guidance on friendship, leadership decisions, recognizing deception, or applying ethical principles. Each string should be concise and faithful to the story's teaching. Example format: ["First piece of advice", "Second piece of advice", "Third piece of advice"].

Constraints:
- Use only the supplied PDF; no external knowledge or interpolation.
- Output nothing but the JSON object—no markdown, preamble, or commentary.
- Preserve valid JSON throughout (double quotes, proper escaping).
- Focus on the story's narrative and moral teaching rather than technical or philosophical treatises.
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
    """Simple fallback title extraction from filename (only used if Gemini fails to extract title)."""
    
    pdf_path_obj = Path(pdf_path)
    # Try parent folder name first
    parent_name = pdf_path_obj.parent.name
    
    # If parent folder has a descriptive name, use it
    if parent_name and parent_name != pdf_path_obj.parent.parent.name:
        # Simple cleanup: replace underscores/dashes with spaces
        cleaned = parent_name.replace("_", " ").replace("-", " ")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if cleaned:
            return cleaned.title()
    
    # Fallback to PDF filename stem
    filename = pdf_path_obj.stem
    cleaned = filename.replace("_", " ").replace("-", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    return cleaned.title() if cleaned else "Panchatantra Story"


def should_process_pdf(pdf_path: Path, root_path: Path) -> bool:
    """Return True if PDF should be processed (not a root-level file)."""
    
    # Skip if PDF is directly in the Panchatantra root directory
    # Check if parent's parent is the root (meaning PDF is in a story folder)
    if pdf_path.parent == root_path:
        return False
    
    # Additional check: skip known root-level files
    root_level_files = ["Panchatantra-English.pdf", "Panchatantra-Sanskrit.txt"]
    if pdf_path.name in root_level_files:
        return False
    
    return True


# ============================================================================
# METADATA GENERATION
# ============================================================================


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
            print(f"Used filename to set story title: {fallback_title}")

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
    print("PAÑCATANTRA METADATA GENERATOR")
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
        print(f"No story PDF files found in {root_dir} or its subdirectories.")
        print("Note: Root-level PDFs (like Panchatantra-English.pdf) are skipped.")
        return

    print(f"Found {len(pdf_files)} story PDF file(s) to process.")
    print(f"(Skipped {len(all_pdfs) - len(pdf_files)} root-level PDF file(s))")
    
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
    print(f"Total story PDFs considered: {len(pdf_files)}")
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

