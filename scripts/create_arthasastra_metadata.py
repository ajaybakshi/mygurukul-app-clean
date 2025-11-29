import os
import json
from pathlib import Path
import google.generativeai as genai
import time
import re

# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/ArthaShastra"

PROMPT_TEMPLATE = """You are an expert AI assistant specializing in ancient Indian political science, statecraft, and the philosophy of the Arthashastra by Kautilya (Chanakya). Based only on the PDF file I provide, your task is to generate a single, well-formed JSON object.

The JSON object must contain the following fields:

1. "chapterTitle": Extract the full chapter title from the PDF content (usually at the beginning, e.g., "CHAPTER I. FORMATION OF VILLAGES"). Provide it as a clean string.
2. "aiSummary": Provide a comprehensive 3-5 sentence summary that captures the broad and nuanced teachings of the chapter relevant to governance, ethics, economics, administration, and practical statecraft.
3. "keyConcepts": Identify and explain a rich set of 5-7 important Sanskrit terms/concepts mentioned in the chapter text. Each element in the array should be an object with two fields: "term" (the IAST transliterated Sanskrit word) and "definition" (a terse but thorough English definition rooted in the chapter's context).
4. "searchTags": Provide a broad and diverse array of 10-15 keywords, synonyms, and semantic tags designed to catch a wide variety of user queries. Include modern terms (e.g., leadership, policy, economics, governance, strategy), common misspellings if applicable, and related philosophical concepts.
5. "deeperInsights": A new field containing an object with two sub-fields:
   * "philosophicalViewpoint": A brief note on any unique philosophical stance or core principle articulated in this chapter.
   * "practicalAdvice": A bulleted list of 2-3 actionable pieces of advice or key strategies described in the text.

Constraints:
- Do not use any external knowledge. Your entire output must be based solely on the provided PDF content.
- Your response must only be the JSON object, with no introductory text or explanations before or after it."""

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
# METADATA GENERATION - BULLETPROOF VERSION
# ============================================================================

def clean_response_text(text):
    """
    Cleans the model's response to extract a valid JSON string.
    - Removes markdown code fences (e.g., ``````).
    - Removes common invalid control characters.
    - Strips leading/trailing whitespace.
    - Isolates the JSON object from any prefatory text.
    """
    # Remove invisible control characters that can invalidate JSON
    # This specifically targets the characters found in the flawed output
    text = re.sub(r'[\x00-\x1F\x7F]', '', text)

    # Remove markdown fences and language specifier (e.g., "```
    text = re.sub(r'^```(json)?\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text)

    # Find the first opening brace and the last closing brace to extract the JSON object
    first_brace = text.find('{')
    last_brace = text.rfind('}')

    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace : last_brace + 1]
    
    # If no valid JSON object is found, return an empty string to avoid errors
    print("Warning: Could not find a valid JSON object in the response.")
    return ""


def generate_metadata_for_file(pdf_path):
    """Generates and saves JSON metadata for a single PDF file."""
    print(f"\nProcessing: {pdf_path}")
    try:
        print("Reading PDF file...")
        with open(pdf_path, 'rb') as f:
            pdf_data = f.read()
        
        pdf_inline = {'mime_type': 'application/pdf', 'data': pdf_data}

        model = genai.GenerativeModel("gemini-2.5-pro")
        print("Generating metadata with Gemini 1.5 Pro...")
        response = model.generate_content([PROMPT_TEMPLATE, pdf_inline])
        
        response_text = response.text
        print(f"Raw response length: {len(response_text)} characters")

        cleaned_response = clean_response_text(response_text)
        if not cleaned_response:
             raise ValueError("Cleaned response is empty. Skipping JSON parsing.")

        print(f"Cleaned response preview: {cleaned_response[:150]}...")

        metadata = json.loads(cleaned_response)
        print("Metadata generated successfully.")

        if 'chapterTitle' not in metadata or not metadata.get('chapterTitle'):
            filename = Path(pdf_path).stem
            title = re.sub(r'^Arthashastra[_-]', '', filename)
            title = re.sub(r'[_-]', ' ', title).strip()
            metadata['chapterTitle'] = title
            print(f"Used filename to set chapter title: {title}")

        json_path = pdf_path.replace('.pdf', '.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        print(f"Saved metadata to: {json_path}")
        return metadata

    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON response for {pdf_path}.")
        print(f"JSON Error details: {e}")
        print(f"Problematic cleaned response: {cleaned_response[:500]}...")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while processing {pdf_path}: {e}")
        return None

# ============================================================================
# DIRECTORY PROCESSING
# ============================================================================

def process_directory(root_dir):
    """Processes all PDF files in the specified directory."""
    print("=" * 80)
    print("ARTHASHASTRA METADATA GENERATOR")
    print(f"Root Directory: {root_dir}")
    print("=" * 80)

    root_path = Path(root_dir)
    if not root_path.exists():
        print(f"Error: Directory does not exist: {root_dir}")
        return

    pdf_files = sorted(list(root_path.rglob("*.pdf")))
    
    if not pdf_files:
        print(f"No PDF files found in {root_dir} or its subdirectories.")
        return

    print(f"Found {len(pdf_files)} total PDF file(s).")
    processed, skipped, failed = 0, 0, 0

    for pdf_path in pdf_files:
        json_path = pdf_path.with_suffix('.json')
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
    except Exception as e:
        print(f"\nFatal Error: {e}")
        exit(1)
