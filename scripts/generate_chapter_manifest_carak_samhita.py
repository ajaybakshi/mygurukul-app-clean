import os
import json
from pathlib import Path
from datetime import datetime

# ============================================================================
# CONFIGURATION - UPDATE THESE PATHS
# ============================================================================

# UPDATE THIS to point to your Caraka_Samhita folder
SCRIPTURE_ROOT = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Caraka_Samhita"

# Scripture metadata
SCRIPTURE_ID = "caraka_samhita"
SCRIPTURE_NAME = "Caraka Saṃhitā"

# Your actual GCS bucket name (from screenshot)
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"

# Base path in GCS where Caraka_Samhita will be uploaded
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Ayurveda/Caraka_Samhita"

# ============================================================================
# SECTION NAME MAPPINGS (English translations)
# ============================================================================

SECTION_TRANSLATIONS = {
    "Sutrasthana": "Foundational Principles",
    "Nidanasthana": "Diagnostics",
    "Vimanasthana": "Specific Determinations",
    "Sasirasthana": "Anatomy & Physiology",
    "Indriyasthana": "Prognosis",
    "Chikitasthanam": "Therapeutics",
    "Kalpasthanam": "Pharmaceutics",
    "Siddhisthanam": "Success in Treatment"
}

# ============================================================================
# HELPER FUNCTION: Extract section name from folder
# ============================================================================

def extract_section_info(folder_name):
    """
    Extract section info from folder names like:
    "Charaka_samhita_english_Section_1_Sutrasthana"

    Returns: (section_id, section_name, section_english)
    """
    # Remove prefix if present
    clean_name = folder_name.replace("Charaka_samhita_english_", "")

    # Try to extract Section_X_Name pattern
    if "Section_" in clean_name:
        parts = clean_name.split("_")
        if len(parts) >= 3:
            section_id = parts[1]  # "1", "2", etc.
            section_name = "_".join(parts[2:])  # "Sutrasthana" or "Vimanasthana"
        else:
            section_id = "unknown"
            section_name = clean_name
    else:
        section_id = "unknown"
        section_name = folder_name

    # Get English translation
    section_english = SECTION_TRANSLATIONS.get(section_name, "")

    return section_id, section_name, section_english

# ============================================================================
# MANIFEST GENERATION FUNCTION
# ============================================================================

def generate_chapter_manifest(scripture_root, scripture_id, scripture_name):
    """
    Scans your actual Caraka_Samhita folder structure and generates manifest.

    Handles folder names like:
        Charaka_samhita_english_Section_1_Sutrasthana/
        Charaka_samhita_english_Section_2_Nidanasthana/
        etc.

    With files like:
        Charaka_samhita_english_Section_1_Sutrasthana_Chapter_1.pdf
        Charaka_samhita_english_Section_1_Sutrasthana_Chapter_1.json
    """

    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - CARAKA SAMHITA")
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

    # Find all section folders
    print("\n🔎 Scanning for section folders...")
    section_folders = sorted([d for d in root_path.iterdir() if d.is_dir()])

    if not section_folders:
        print(f"❌ Error: No section folders found in {scripture_root}")
        return None

    print(f"✅ Found {len(section_folders)} section folder(s)")

    # Process each section
    for section_folder in section_folders:
        folder_name = section_folder.name
        print(f"\n📂 Processing: {folder_name}")

        # Extract section info
        section_id, section_name, section_english = extract_section_info(folder_name)

        print(f"   Section ID: {section_id}")
        print(f"   Section Name: {section_name}")
        print(f"   English: {section_english}")

        chapters = []

        # Find all PDF files in this section
        pdf_files = sorted(section_folder.glob("*.pdf"))

        if not pdf_files:
            print(f"   ⚠️ No PDF files found in {folder_name}")
            continue

        print(f"   Found {len(pdf_files)} PDF file(s)")

        for pdf_path in pdf_files:
            # Extract chapter number from filename
            # Example: "Charaka_samhita_english_Section_1_Sutrasthana_Chapter_4.pdf"

            pdf_filename = pdf_path.stem  # filename without extension

            # Try to extract chapter number
            chapter_num = None
            if "Chapter_" in pdf_filename:
                try:
                    chapter_part = pdf_filename.split("Chapter_")[1]
                    # Handle cases like "Chapter_4" or "Chapter_4_something"
                    chapter_num = chapter_part.split('_')[0] if '_' in chapter_part else chapter_part
                    chapter_num = int(chapter_num)
                except Exception as e:
                    print(f"   ⚠️ Could not extract chapter number from: {pdf_path.name}")
                    continue
            else:
                print(f"   ⚠️ Filename does not contain 'Chapter_': {pdf_path.name}")
                continue

            # Check if corresponding JSON exists
            json_path = pdf_path.with_suffix('.json')
            if not json_path.exists():
                print(f"   ⚠️ Missing JSON for: {pdf_path.name}")
                has_metadata = False
            else:
                has_metadata = True

            # Construct GCS URLs matching your actual bucket structure
            # URLs will be: gs://mygurukul-sacred-texts-corpus/Gurukul_Library/Primary_Texts/Ayurveda/Caraka_Samhita/[folder]/[file]

            metadata_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{folder_name}/{json_path.name}"
            pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{folder_name}/{pdf_path.name}"

            # Create chapter entry
            chapter_entry = {
                "chapterId": str(chapter_num),
                "chapterNumber": chapter_num,
                "title": f"Chapter {chapter_num}",  # Can be enhanced later with Sanskrit titles
                "titleEnglish": "",  # Can be manually added later
                "metadataUrl": metadata_url,
                "pdfUrl": pdf_url,
                "hasMetadata": has_metadata
            }

            chapters.append(chapter_entry)
            manifest["totalChapters"] += 1

        # Sort chapters by chapter number
        chapters.sort(key=lambda x: x["chapterNumber"])

        # Create section entry
        section_entry = {
            "sectionId": section_id,
            "sectionName": section_name,
            "sectionNameEnglish": section_english,
            "chapterCount": len(chapters),
            "chapters": chapters
        }

        manifest["sections"].append(section_entry)
        print(f"   ✅ Processed {len(chapters)} chapter(s)")

    # Sort sections by section ID
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
        print(f"\n   Section {section['sectionId']}: {section['sectionName']}")
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

if __name__ == "__main__":
    print("\n")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║                                                            ║")
    print("║       MYGURUKUL CHAPTER MANIFEST GENERATOR v2.0            ║")
    print("║            (Adapted for your folder structure)             ║")
    print("║                                                            ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print("\n")

    try:
        # Generate manifest
        manifest = generate_chapter_manifest(
            scripture_root=SCRIPTURE_ROOT,
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
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 80)
        print("SUCCESS!")
        print("=" * 80)
        print(f"✅ Generated: {output_filename}")
        print(f"📊 Total Chapters: {manifest['totalChapters']}")
        print(f"📚 Total Sections: {len(manifest['sections'])}")
        print("=" * 80)

        print("\n📋 NEXT STEPS:")
        print("   1. Review the generated JSON file")
        print("   2. Upload to GCS:")
        print(f"      a) Navigate to: {GCS_BUCKET}/Gurukul_Library/Primary_Texts/Ayurveda/")
        print(f"      b) Upload your entire Caraka_Samhita folder (with all section subfolders)")
        print(f"      c) Create 'metadata' folder at Gurukul_Library level")
        print(f"      d) Upload this manifest JSON to the metadata folder")
        print("   3. Verify permissions (allUsers = Storage Object Viewer)")
        print("   4. Test access with curl")
        print("   5. Ready for frontend development!")
        print("\n")

    except Exception as e:
        print(f"\n❌ Fatal Error: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)
