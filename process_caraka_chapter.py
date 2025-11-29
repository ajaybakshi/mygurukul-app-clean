import pdfplumber
import re
import os

# Define the PDF file path
PDF_FILE_PATH = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Caraka_Samhita/Charaka_Samhita_Text_with_English.pdf"

# Define which chapter to extract
CHAPTER_TO_EXTRACT = 21


def extract_full_text(file_path):
    """
    Extracts all text from a PDF file.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        str: The extracted text from all pages
    """
    print(f"Opening PDF file: {file_path}")
    
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found at: {file_path}")
        
        full_text = ""
        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"PDF loaded successfully. Total pages: {total_pages}")
            
            for page_num, page in enumerate(pdf.pages, 1):
                print(f"Extracting text from page {page_num}/{total_pages}...", end='\r')
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
            
            print(f"\nText extraction complete. Total characters: {len(full_text)}")
        
        return full_text
    
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return None
    except Exception as e:
        print(f"An error occurred while extracting text: {e}")
        return None


def isolate_chapter(full_text, chapter_number):
    """
    Isolates a specific chapter from the full text using regex.
    
    Args:
        full_text: The complete text extracted from the PDF
        chapter_number: The chapter number to isolate
        
    Returns:
        str: The isolated chapter text, or None if not found
    """
    print(f"\nSearching for Chapter {chapter_number}...")
    
    if not full_text:
        print("Error: No text provided to search")
        return None
    
    # Create regex pattern to match the chapter
    # This pattern looks for "CHAPTER {number}" and captures everything until "CHAPTER {number+1}"
    chapter_start_pattern = rf"CHAPTER\s+{chapter_number}\b"
    chapter_end_pattern = rf"CHAPTER\s+{chapter_number + 1}\b"
    
    # Find the start of the target chapter
    start_match = re.search(chapter_start_pattern, full_text, re.IGNORECASE)
    if not start_match:
        print(f"Error: Could not find the start of Chapter {chapter_number}")
        return None
    
    print(f"Found Chapter {chapter_number} starting at position {start_match.start()}")
    
    # Find the start of the next chapter
    end_match = re.search(chapter_end_pattern, full_text[start_match.start():], re.IGNORECASE)
    
    if end_match:
        # Extract text from start of current chapter to start of next chapter
        chapter_text = full_text[start_match.start():start_match.start() + end_match.start()]
        print(f"Found Chapter {chapter_number + 1} starting at position {start_match.start() + end_match.start()}")
        print(f"Chapter {chapter_number} isolated successfully. Length: {len(chapter_text)} characters")
    else:
        # If no next chapter found, extract from start of current chapter to end of document
        chapter_text = full_text[start_match.start():]
        print(f"Chapter {chapter_number + 1} not found. Extracting to end of document.")
        print(f"Chapter {chapter_number} isolated successfully. Length: {len(chapter_text)} characters")
    
    return chapter_text


def main():
    """
    Main execution function.
    """
    print("=" * 60)
    print("Caraka Samhita Chapter Extraction Script")
    print("=" * 60)
    
    # Extract full text from PDF
    full_text = extract_full_text(PDF_FILE_PATH)
    
    if not full_text:
        print("\nFailed to extract text from PDF. Exiting.")
        return
    
    # Isolate the specific chapter
    chapter_text = isolate_chapter(full_text, CHAPTER_TO_EXTRACT)
    
    if not chapter_text:
        print(f"\nFailed to isolate Chapter {CHAPTER_TO_EXTRACT}. Exiting.")
        return
    
    # Save the isolated chapter to a file
    output_filename = f"chapter_{CHAPTER_TO_EXTRACT}_text.txt"
    print(f"\nSaving chapter to: {output_filename}")
    
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            f.write(chapter_text)
        
        print(f"✅ Successfully saved Chapter {CHAPTER_TO_EXTRACT} to {output_filename}")
        print(f"File size: {os.path.getsize(output_filename)} bytes")
        print("=" * 60)
    
    except Exception as e:
        print(f"❌ Error saving file: {e}")


if __name__ == "__main__":
    main()

