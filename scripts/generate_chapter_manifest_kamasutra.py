import os
import json
from pathlib import Path
from datetime import datetime
import re

# ============================================================================
# CONFIGURATION
# ============================================================================

# This is the directory where all your Kama Sutra JSON files are located.
ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/KamaSutra"
SCRIPTURE_ID = "kamasutra"
SCRIPTURE_NAME = "Kama Sutra"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Sastras/KamaSutra"

# ============================================================================
# HELPER FUNCTION: Extract Part info from folder name
# ============================================================================

def extract_part_info(folder_name):
    """
    Extract part info from folder names like:
    "Part_1_General_Considerations"
    "Part_2_Sexual_Union"
    Returns: (part_id, part_name, part_name_english)
    """
    # Pattern: Part_1_General_Considerations
    match = re.match(r'Part_(\d+)_(.*)', folder_name)
    if match:
        part_id = match.group(1)  # "1", "2", etc.
        part_name = match.group(2) # "General_Considerations"
        part_name_english = part_name.replace("_", " ") # "General Considerations"
    else:
        part_id = "unknown"
        part_name = folder_name
        part_name_english = folder_name.replace("_", " ")

    return part_id, part_name, part_name_english

# ============================================================================
# HELPER FUNCTION: Extract chapter number from filename
# ============================================================================

def get_chapter_number(filename):
    """Extracts the chapter number from the filename using a regular expression."""
    # Handle patterns like: _Chapter_1.json
    match = re.search(r'_Chapter_(\d+)', filename)
    if match:
        return int(match.group(1))
    return 0  # Default if no number is found

# ============================================================================
# MANIFEST GENERATION
# ============================================================================

def generate_chapter_manifest(scripture_root, scripture_id, scripture_name):
    """
    Scans your Kama Sutra folder structure and generates the manifest.
    Handles folder structure like:
    Part_1_General_Considerations/
        Part_1_General_Considerations_Chapter_1.pdf
        Part_1_General_Considerations_Chapter_1.json
    ...
    """
    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - KAMA SUTRA")
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

    print("\n🔎 Scanning for Part folders...")
    part_folders = sorted(
        [d for d in root_path.iterdir() if d.is_dir() and d.name.startswith("Part_")],
        key=lambda d: int(re.match(r'Part_(\d+)', d.name).group(1))
    )

    if not part_folders:
        print(f"❌ Error: No Part folders found in {scripture_root}")
        return None

    print(f"✅ Found {len(part_folders)} Part folder(s)")

    for part_folder in part_folders:
        folder_name = part_folder.name
        print(f"\n📂 Processing: {folder_name}")

        part_id, part_name, part_name_english = extract_part_info(folder_name)
        print(f"  Part ID: {part_id}")
        print(f"  Part Name: {part_name}")
        print(f"  English: {part_name_english}")

        chapters = []
        json_files = sorted(
            [p for p in part_folder.glob("*.json") if "manifest" not in p.name.lower()],
            key=lambda p: get_chapter_number(p.name)
        )

        if not json_files:
            print(f"  ⚠️ No JSON files found in {folder_name}")
            continue

        print(f"  Found {len(json_files)} JSON file(s)")

        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                chapter_number = get_chapter_number(json_file.name)
                
                # Check for corresponding PDF
                pdf_path = json_file.with_suffix('.pdf')
                
                # Construct GCS URLs
                metadata_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{folder_name}/{json_file.name}"
                pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{folder_name}/{pdf_path.name}"

                chapter_info = {
                    "chapterId": str(chapter_number),
                    "chapterNumber": chapter_number,
                    "title": data.get("chapterTitle", json_file.stem.replace("_", " ")),
                    "metadataUrl": metadata_url,
                    "pdfUrl": pdf_url,
                    "hasMetadata": True
                }
                chapters.append(chapter_info)
                manifest["totalChapters"] += 1
            except Exception as e:
                print(f"  ⚠️ Warning: Could not process {json_file.name}. Error: {e}")
                continue
        
        # Sort chapters by chapter number
        chapters.sort(key=lambda x: x["chapterNumber"])

        section_entry = {
            "sectionId": part_id,
            "sectionName": f"Part {part_id}: {part_name_english}",
            "sectionNameEnglish": part_name_english,
            "chapterCount": len(chapters),
            "chapters": chapters
        }
        manifest["sections"].append(section_entry)
        print(f"  ✅ Processed {len(chapters)} chapter(s)")

    return manifest

# ============================================================================
# VALIDATION FUNCTION
# ============================================================================

def validate_manifest(manifest):
    # This function remains largely the same as the Arthashastra template
    # and is robust enough to validate the new structure.
    print("\n" + "=" * 80)
    print("VALIDATING MANIFEST")
    print("=" * 80)
    if not manifest:
        print("❌ Manifest is empty or None")
        return False

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

    total_chapters_in_sections = sum(s['chapterCount'] for s in manifest['sections'])
    if manifest['totalChapters'] != total_chapters_in_sections:
        print(f"❌ Mismatch: totalChapters is {manifest['totalChapters']} but sections contain {total_chapters_in_sections}")
        return False

    print("\n✅ Manifest validation passed!")
    return True

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main function to generate the chapter manifest."""
    print("\n")
    print("╔══════════════════════════════════════════════════════════╗")
    print("║                                                      ║")
    print("║      MYGURUKUL CHAPTER MANIFEST GENERATOR - KAMA SUTRA     ║")
    print("║                                                      ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print("\n")

    try:
        manifest = generate_chapter_manifest(
            scripture_root=ROOT_DIRECTORY,
            scripture_id=SCRIPTURE_ID,
            scripture_name=SCRIPTURE_NAME
        )

        if manifest is None:
            print("\n❌ Failed to generate manifest")
            exit(1)

        if not validate_manifest(manifest):
            print("\n❌ Manifest validation failed")
            exit(1)

        output_filename = f"{SCRIPTURE_ID}_chapter_manifest.json"
        output_path = Path(ROOT_DIRECTORY).parent / output_filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 80)
        print("SUCCESS!")
        print("=" * 80)
        print(f"✅ Generated: {output_path}")
        print(f"📊 Total Chapters: {manifest['totalChapters']}")
        print(f"📚 Total Sections (Parts): {len(manifest['sections'])}")
        print("=" * 80)
        print("\n📋 NEXT STEPS:")
        print(f" 1. Review the generated {output_filename}")
        print(f" 2. Upload the entire KamaSutra folder to GCS at: {GCS_BUCKET}/{GCS_BASE_PATH.rsplit('/', 1)[0]}")
        print(" 3. Upload the manifest file to its designated location.")
        print("\n")

    except Exception as e:
        print(f"\n❌ Fatal Error: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
