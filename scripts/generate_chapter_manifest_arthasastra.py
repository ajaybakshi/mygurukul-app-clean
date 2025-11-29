import os
import json
from pathlib import Path
from datetime import datetime
import re

# ============================================================================
# CONFIGURATION
# ============================================================================

# This is the directory where all your Arthashastra JSON files are located.
ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/ArthaShastra"

SCRIPTURE_ID = "arthashastra"
SCRIPTURE_NAME = "Arthashastra"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Sastras/ArthaShastra"

# ============================================================================
# HELPER FUNCTION: Extract Book info from folder name
# ============================================================================

def extract_book_info(folder_name):
    """
    Extract book info from folder names like:
    "Arthashastra_Book_1_Concerning_Discipline"
    "Arthashastra_Book_10_Relating_To_War"
    
    Returns: (book_id, book_name, book_name_english)
    """
    # Remove prefix if present
    clean_name = folder_name.replace("Arthashastra_", "")
    clean_name = clean_name.replace("arthashastra_", "")
    
    # Try to extract Book_X_Name pattern
    if "Book_" in clean_name:
        # Pattern: Book_1_Concerning_Discipline
        parts = clean_name.split("_")
        if len(parts) >= 3 and parts[0] == "Book":
            book_id = parts[1]  # "1", "2", "10", etc.
            # Everything after Book_X is the name
            book_name = "_".join(parts[2:])  # "Concerning_Discipline" or full name
            # For English name, replace underscores with spaces and title case
            book_name_english = " ".join(parts[2:]).replace("_", " ")
        else:
            book_id = "unknown"
            book_name = clean_name
            book_name_english = clean_name.replace("_", " ")
    else:
        book_id = "unknown"
        book_name = folder_name
        book_name_english = folder_name.replace("_", " ")
    
    return book_id, book_name, book_name_english

# ============================================================================
# HELPER FUNCTION: Extract chapter number from filename
# ============================================================================

def get_chapter_number(filename):
    """Extracts the chapter number from the filename using a regular expression."""
    # Handle both patterns: Chapter_1 or -Chapter_1
    match = re.search(r'[_-]Chapter_(\d+)', filename)
    if match:
        return int(match.group(1))
    return 0  # Default if no number is found

# ============================================================================
# MANIFEST GENERATION
# ============================================================================

def generate_chapter_manifest(scripture_root, scripture_id, scripture_name):
    """
    Scans your actual Arthashastra folder structure and generates manifest.
    
    Handles folder structure like:
        Arthashastra_Book_1_Concerning_Discipline/
            Arthashastra_Book_1_Concerning_Discipline_Chapter_1.pdf
            Arthashastra_Book_1_Concerning_Discipline_Chapter_1.json
            ...
        Arthashastra_Book_2_The_Duties_of_Government_Suprintendents/
            ...
    """
    
    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - ARTHASHASTRA")
    print("=" * 80)
    print(f"Scripture: {scripture_name}")
    print(f"Root Directory: {scripture_root}")
    print(f"GCS Bucket: {GCS_BUCKET}")
    print(f"GCS Path: {GCS_BASE_PATH}")
    print("=" * 80)
    
    manifest = {
        "scriptureId": scripture_id,
        "scriptureName": scripture_name,
        "totalChapters": 0,
        "lastUpdated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "sections": []
    }
    
    root_path = Path(scripture_root)
    
    if not root_path.exists():
        print(f"❌ Error: Directory does not exist: {scripture_root}")
        return None
    
    # Find all Book folders
    print("\n🔎 Scanning for Book folders...")
    book_folders = [
        d for d in root_path.iterdir() 
        if d.is_dir() and d.name.startswith("Arthashastra_Book_")
    ]
    
    if not book_folders:
        print(f"❌ Error: No Book folders found in {scripture_root}")
        return None
    
    print(f"✅ Found {len(book_folders)} Book folder(s)")
    
    # Process each Book folder
    for book_folder in book_folders:
        folder_name = book_folder.name
        print(f"\n📂 Processing: {folder_name}")
        
        # Extract book info
        book_id, book_name, book_name_english = extract_book_info(folder_name)
        
        print(f"   Book ID: {book_id}")
        print(f"   Book Name: {book_name}")
        print(f"   English: {book_name_english}")
        
        chapters = []
        
        # Find all JSON files in this Book folder
        json_files = sorted(
            [p for p in book_folder.glob("*.json") if "manifest" not in p.name.lower()],
            key=lambda p: get_chapter_number(p.name)
        )
        
        if not json_files:
            print(f"   ⚠️ No JSON files found in {folder_name}")
            continue
        
        print(f"   Found {len(json_files)} JSON file(s)")
        
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                chapter_number = get_chapter_number(json_file.name)
                
                # Check if corresponding PDF exists
                pdf_path = json_file.with_suffix('.pdf')
                has_metadata = True  # JSON exists
                
                # Construct GCS URLs
                metadata_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{folder_name}/{json_file.name}"
                pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{folder_name}/{pdf_path.name}"
                
                chapter_info = {
                    "chapterId": str(chapter_number),
                    "chapterNumber": chapter_number,
                    "title": data.get("chapterTitle", json_file.stem.replace("_", " ")),
                    "titleEnglish": data.get("chapterTitle", "").split(".")[-1].strip() if data.get("chapterTitle") else "",
                    "metadataUrl": metadata_url,
                    "pdfUrl": pdf_url,
                    "hasMetadata": has_metadata
                }
                chapters.append(chapter_info)
                manifest["totalChapters"] += 1
                
            except Exception as e:
                print(f"   ⚠️ Warning: Could not process {json_file.name}. Error: {e}")
                continue
        
        # Sort chapters by chapter number
        chapters.sort(key=lambda x: x["chapterNumber"])
        
        # Create section entry (Book = Section)
        section_entry = {
            "sectionId": book_id,
            "sectionName": book_name,
            "sectionNameEnglish": book_name_english,
            "chapterCount": len(chapters),
            "chapters": chapters
        }
        
        manifest["sections"].append(section_entry)
        print(f"   ✅ Processed {len(chapters)} chapter(s)")
    
    # Sort sections by Book ID (numeric)
    try:
        manifest["sections"].sort(key=lambda x: int(x["sectionId"]))
    except:
        pass  # If section IDs are not numeric, keep original order
    
    return manifest

# ============================================================================
# VALIDATION FUNCTION
# ============================================================================

def validate_manifest(manifest):
    """Validate the generated manifest for completeness."""
    
    print("\n" + "=" * 80)
    print("VALIDATING MANIFEST")
    print("=" * 80)
    
    if not manifest:
        print("❌ Manifest is empty or None")
        return False
    
    # Check required fields
    required_fields = ["scriptureId", "scriptureName", "totalChapters", "sections"]
    for field in required_fields:
        if field not in manifest:
            print(f"❌ Missing required field: {field}")
            return False
    
    if len(manifest["sections"]) == 0:
        print("❌ No sections found in manifest")
        return False
    
    print(f"✅ Scripture ID: {manifest['scriptureId']}")
    print(f"✅ Scripture Name: {manifest['scriptureName']}")
    print(f"✅ Total Chapters: {manifest['totalChapters']}")
    print(f"✅ Total Sections: {len(manifest['sections'])}")
    
    # Validate each section
    chapters_with_metadata = 0
    chapters_without_metadata = 0
    
    for section in manifest["sections"]:
        print(f"\n   Book {section['sectionId']}: {section['sectionName']}")
        print(f"      Chapters: {section['chapterCount']}")
        
        for chapter in section["chapters"]:
            if chapter.get("hasMetadata", False):
                chapters_with_metadata += 1
            else:
                chapters_without_metadata += 1
    
    print(f"\n✅ Chapters with JSON metadata: {chapters_with_metadata}")
    if chapters_without_metadata > 0:
        print(f"⚠️ Chapters without JSON metadata: {chapters_without_metadata}")
    
    print("\n✅ Manifest validation passed!")
    return True

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main function to generate the chapter manifest."""
    print("\n")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║                                                            ║")
    print("║       MYGURUKUL CHAPTER MANIFEST GENERATOR - ARTHASHASTRA  ║")
    print("║                                                            ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print("\n")
    
    try:
        # Generate manifest
        manifest = generate_chapter_manifest(
            scripture_root=ROOT_DIRECTORY,
            scripture_id=SCRIPTURE_ID,
            scripture_name=SCRIPTURE_NAME
        )
        
        if manifest is None:
            print("\n❌ Failed to generate manifest")
            exit(1)
        
        # Validate manifest
        if not validate_manifest(manifest):
            print("\n❌ Manifest validation failed")
            exit(1)
        
        # Save manifest
        output_filename = f"{SCRIPTURE_ID}_chapter_manifest.json"
        output_path = Path(ROOT_DIRECTORY) / output_filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        
        print("\n" + "=" * 80)
        print("SUCCESS!")
        print("=" * 80)
        print(f"✅ Generated: {output_path}")
        print(f"📊 Total Chapters: {manifest['totalChapters']}")
        print(f"📚 Total Sections (Books): {len(manifest['sections'])}")
        print("=" * 80)
        
        print("\n📋 NEXT STEPS:")
        print("   1. Review the generated JSON file")
        print("   2. Upload to GCS:")
        print(f"      a) Navigate to: {GCS_BUCKET}/Gurukul_Library/Primary_Texts/Sastras/")
        print(f"      b) Upload your entire ArthaShastra folder (with all Book subfolders)")
        print(f"      c) Upload this manifest JSON to the appropriate location")
        print("   3. Verify permissions (allUsers = Storage Object Viewer)")
        print("   4. Test access with curl")
        print("   5. Ready for frontend display!")
        print("\n")
        
    except Exception as e:
        print(f"\n❌ Fatal Error: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()

