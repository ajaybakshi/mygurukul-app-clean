import os
import json
from pathlib import Path
import google.generativeai as genai
import time

# ============================================================================
# CONFIGURATION
# ============================================================================
ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Sushruta_Samhita"

# V2 Expanded Prompt for Gemini
PROMPT_TEMPLATE = """You are an expert Ayurvedic and spiritual AI assistant. Based **only** on the PDF file I provide, your task is to generate a single, well-formed JSON object.

The JSON object must contain the following fields:

1. `"aiSummary"`: Provide a comprehensive 3-5 sentence summary that captures the broad and nuanced teachings of the chapter relevant to health, well-being, lifestyle, and spiritual growth.

2. `"keyConcepts"`: Identify and explain a rich set of 5-7 important Sanskrit terms/concepts mentioned in the chapter text. Each element in the array should be an object with two fields: `"term"` (the IAST transliterated Sanskrit word) and `"definition"` (a terse but thorough English definition rooted in the chapter's context).

3. `"searchTags"`: Provide a broad and diverse array of 10-15 keywords, synonyms, and semantic tags designed to catch a wide variety of user queries. Include modern wellness terms (e.g., 'mindfulness', 'longevity', 'detox'), common misspellings if applicable, and related philosophical concepts.

4. `"deeperInsights"`: A new field containing an object with two sub-fields:
   * `"philosophicalViewpoint"`: A brief note on any unique philosophical stance or core principle articulated in this chapter.
   * `"practicalAdvice"`: A bulleted list of 2-3 actionable pieces of advice or key formulations described in the text.

**Constraints:**
* Do not use any external knowledge. Your entire output must be based solely on the provided PDF content.
* Your response must **only** be the JSON object, with no introductory text or explanations before or after it."""

# ============================================================================
# API CONFIGURATION
# ============================================================================
def configure_api():
    """
    Configure the Google Generative AI API using environment variable.
    """
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is not set")
    genai.configure(api_key=api_key)
    print("✅ Google Generative AI API configured successfully")

# ============================================================================
# METADATA GENERATION (UPDATED METHOD)
# ============================================================================
def generate_metadata_for_file(pdf_path):
    """
    Generate JSON metadata for a single PDF file using Gemini API.
    Uses inline base64 upload instead of file upload API.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        dict: Generated metadata as a dictionary
    """
    print(f"\n📄 Processing: {pdf_path}")

    try:
        # Read PDF file as binary
        print("   📖 Reading PDF file...")
        with open(pdf_path, 'rb') as f:
            pdf_data = f.read()

        # Create inline data format
        print("   🔄 Preparing inline data...")
        pdf_inline = {
            'mime_type': 'application/pdf',
            'data': pdf_data
        }

        # Create the model
        model = genai.GenerativeModel("gemini-2.5-pro")

        # Generate content
        print("   🤖 Generating metadata with Gemini 2.5 Pro...")
        response = model.generate_content([PROMPT_TEMPLATE, pdf_inline])

        # Extract and clean the response
        response_text = response.text.strip()

        # Remove potential markdown code blocks (using triple backticks)
        if response_text.startswith("```"):
            # Remove first line with ```json or ```
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:])

        if response_text.endswith("```"):
            response_text = response_text[:-3].strip()

        # Parse JSON
        metadata = json.loads(response_text)
        print("   ✅ Metadata generated successfully")

        # Save to JSON file
        json_path = pdf_path.replace('.pdf', '.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        print(f"   💾 Saved metadata to: {json_path}")

        return metadata

    except json.JSONDecodeError as e:
        print(f"   ❌ Error: Failed to parse JSON response")
        print(f"   Response text: {response_text[:200]}...")
        raise

    except Exception as e:
        print(f"   ❌ Error processing {pdf_path}: {str(e)}")
        raise

# ============================================================================
# DIRECTORY PROCESSING
# ============================================================================
def process_directory(root_dir):
    """
    Recursively process all PDF files in a directory and generate metadata.

    Args:
        root_dir: Root directory to start processing from
    """
    print("=" * 80)
    print("LIBRARY METADATA GENERATOR")
    print("=" * 80)
    print(f"Root Directory: {root_dir}")
    print(f"Model: gemini-2.5-pro")
    print("=" * 80)

    # Convert to Path object
    root_path = Path(root_dir)

    if not root_path.exists():
        print(f"❌ Error: Directory does not exist: {root_dir}")
        return

    # New, more precise logic to find PDFs only within section subfolders
    print("\n🔎 Scanning for section folders and collecting PDF files...")
    all_pdf_files = []

    section_folders = sorted([d for d in root_path.iterdir() if d.is_dir()])

    for folder in section_folders:
        print(f"   -> Found section: {folder.name}")
        pdfs_in_folder = sorted(list(folder.glob("*.pdf")))
        if pdfs_in_folder:
            print(f"      Found {len(pdfs_in_folder)} chapter PDFs.")
            all_pdf_files.extend(pdfs_in_folder)
        else:
            print(f"      No PDFs found in this section.")

    pdf_files = all_pdf_files

    if not pdf_files:
        print(f"⚠️ No PDF files found in {root_dir}")
        return

    print(f"\n📚 Found {len(pdf_files)} PDF file(s)")

    processed = 0
    skipped = 0
    failed = 0

    for pdf_path in pdf_files:
        pdf_path_str = str(pdf_path)
        json_path_str = pdf_path_str.replace('.pdf', '.json')

        # Check if JSON already exists
        if os.path.exists(json_path_str):
            print(f"\n⏭️  Skipping {pdf_path.name} (metadata already exists)")
            skipped += 1
            continue

        try:
            # Generate metadata
            generate_metadata_for_file(pdf_path_str)
            processed += 1

            # Add delay to respect rate limits (adjust as needed)
            if processed < len(pdf_files) - skipped:
                print("   ⏳ Waiting 3 seconds before next file...")
                time.sleep(3)

        except Exception as e:
            print(f"   ❌ Failed to process {pdf_path.name}: {str(e)}")
            failed += 1
            # Continue with next file
            continue

    # Summary
    print("\n" + "=" * 80)
    print("PROCESSING COMPLETE")
    print("=" * 80)
    print(f"✅ Successfully processed: {processed}")
    print(f"⏭️  Skipped (already exists): {skipped}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Total files: {len(pdf_files)}")
    print("=" * 80)

# ============================================================================
# MAIN EXECUTION
# ============================================================================
if __name__ == "__main__":
    try:
        # Configure API
        configure_api()

        # Process directory
        process_directory(ROOT_DIRECTORY)

    except Exception as e:
        print(f"\n❌ Fatal Error: {str(e)}")
        exit(1)
