import os
import json
from pathlib import Path
import google.generativeai as genai
import time
import re

# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/KamaSutra"

PROMPT_TEMPLATE = """You are a distinguished AI assistant with deep expertise in ancient Indian literature and philosophy, specializing in the Kama Sutra by Vātsyāyana. Your approach is scholarly, academic, and culturally sensitive. You are tasked with analyzing a chapter from this classical text and generating a single, well-formed JSON object based *only* on the provided PDF content.

The Kama Sutra is a foundational text on the art of living, which includes but is not limited to human sexuality. When analyzing chapters that discuss explicit topics, it is imperative that you maintain a detached, analytical, and non-sensationalist tone. Frame the content within its historical, social, and philosophical context, focusing on the teachings related to human relationships, societal norms, and the pursuit of a well-rounded life (Trivarga: Dharma, Artha, Kama). Your purpose is to provide scholarly metadata, not to generate erotic content.

The JSON object must contain the following fields:

1.  "chapterTitle": Extract the full chapter title from the PDF content (e.g., "CHAPTER I. ON ACQUISITION OF DHARMA, ARTHA, AND KAMA"). Provide it as a clean string.
2.  "aiSummary": Provide a comprehensive 3-5 sentence summary that captures the chapter's core teachings. Focus on its guidance regarding social conduct, personal development, relationships, or the specific art being discussed, while maintaining a scholarly perspective.
3.  "keyConcepts": Identify and explain 5-7 important Sanskrit terms or concepts from the chapter. Each element in the array should be an object with "term" (IAST transliterated Sanskrit) and "definition" (a clear English definition rooted in the chapter's context).
4.  "searchTags": Provide a diverse array of 10-15 keywords and semantic tags for user queries. Include historical terms, concepts of love and relationships, social customs, and relevant philosophical ideas.
5.  "deeperInsights": An object with two sub-fields:
    *   "philosophicalViewpoint": A brief note on the chapter's underlying philosophy regarding the balance of Dharma, Artha, and Kama.
    *   "practicalAdvice": A bulleted list of 2-3 actionable pieces of advice or strategies described in the text, presented in a neutral, informative manner.

Constraints:
- Your output must be based solely on the provided PDF. Do not use external knowledge.
- Your entire response must be only the JSON object, without any introductory text.
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
# METADATA GENERATION
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

        if 'chapterTitle' not in metadata or not metadata.get('chapterTitle'):
            filename = Path(pdf_path).stem
            title = re.sub(r'^KamaSutra[_-]', '', filename, flags=re.IGNORECASE)
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
    print("KAMA SUTRA METADATA GENERATOR")
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
        
        # Add a delay between API calls
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
