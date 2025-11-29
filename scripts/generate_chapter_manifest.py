import os
import json
from pathlib import Path
from datetime import datetime

# ============================================================================
# CONFIGURATION
# ============================================================================

# UPDATE THIS PATH to your local Caraka Samhita folder
SCRIPTURE_ROOT = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Charaka_samhita_english"

# Scripture metadata
SCRIPTURE_ID = "caraka_samhita"
SCRIPTURE_NAME = "Caraka Saṃhitā"

# GCS bucket base URL (will be prepended to paths)
GCS_BUCKET = "gs://mygurukul-library"

# ============================================================================
# SECTION NAME MAPPINGS (English translations)
# ============================================================================

SECTION_TRANSLATIONS = {
    "Sutrasthanam": "Foundational Principles",
    "Nidanasthanam": "Diagnostics",
    "Vimānasthanam": "Specific Determinations",
    "Śārīrasthanam": "Anatomy & Physiology",
    "Indriyasthanam": "Prognosis",
    "Cikitsāsthanam": "Therapeutics",
    "Kalpasthanam": "Pharmaceutics",
    "Siddhisthanam": "Success in Treatment"
}

# ============================================================================
# MANIFEST GENERATION FUNCTION
# ============================================================================

def generate_chapter_manifest(scripture_root, scripture_id, scripture_name):
    """
    Scans local folder structure and generates chapter manifest JSON.

    Expected folder structure:
    /scripture_root/
        Section_1_Sutrasthanam/
            Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.pdf
            Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.json
            Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_2.pdf
            Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_2.json
        Section_2_Nidanasthanam/
            ...

    Args:
        scripture_root: Path to the scripture's root folder
        scripture_id: Unique ID for the scripture (e.g., "caraka_samhita")
        scripture_name: Display name (e.g., "Caraka Saṃhitā")

    Returns:
        dict: The generated manifest
    """

    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR")
    print("=" * 80)
    print(f"Scripture: {scripture_name}")
    print(f"Root Directory: {scripture_root}")
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
        section_name = section_folder.name
        print(f"\n📂 Processing: {section_name}")

        # Extract section number and name
        # Example: "Section_1_Sutrasthanam" → sectionId=1, sectionName="Sutrasthanam"
        try:
            parts = section_name.split('_')
            if len(parts) >= 3 and parts[0] == "Section":
                section_id = parts[1]
                section_display_name = '_'.join(parts[2:])  # Handle names with underscores
            else:
                section_id = "unknown"
                section_display_name = section_name
        except:
            section_id = "unknown"
            section_display_name = section_name

        # Get English translation if available
        section_english = SECTION_TRANSLATIONS.get(section_display_name, "")

        chapters = []

        # Find all PDF files in this section
        pdf_files = sorted(section_folder.glob("*.pdf"))

        if not pdf_files:
            print(f"   ⚠️ No PDF files found in {section_name}")
            continue

        print(f"   Found {len(pdf_files)} PDF file(s)")

        for pdf_path in pdf_files:
            # Extract chapter number from filename
            # Example: "Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_4.pdf"
            # We want to extract "4"

            pdf_filename = pdf_path.stem  # filename without extension

            # Try to extract chapter number
            chapter_num = None
            if "Chapter_" in pdf_filename:
                try:
                    chapter_part = pdf_filename.split("Chapter_")[1]
                    chapter_num = chapter_part.split('_')[0] if '_' in chapter_part else chapter_part
                    chapter_num = int(chapter_num)
                except:
                    print(f"   ⚠️ Could not extract chapter number from: {pdf_path.name}")
                    continue
            else:
                print(f"   ⚠️ Filename does not contain 'Chapter_': {pdf_path.name}")
                continue

            # Check if corresponding JSON exists
            json_path = pdf_path.with_suffix('.json')
            if not json_path.exists():
                print(f"   ⚠️ Missing JSON for: {pdf_path.name}")
                # Still include in manifest, but note metadata is missing
                has_metadata = False
            else:
                has_metadata = True

            # Construct GCS URLs
            # Pattern: gs://mygurukul-library/metadata/chapters/caraka_samhita/Section_1_Sutrasthanam/Chapter_1.json
            metadata_url = f"{GCS_BUCKET}/metadata/chapters/{scripture_id}/{section_name}/{json_path.name}"
            pdf_url = f"{GCS_BUCKET}/pdfs/{scripture_id}/{section_name}/{pdf_path.name}"

            # Create chapter entry
            chapter_entry = {
                "chapterId": str(chapter_num),
                "chapterNumber": chapter_num,
                "title": f"Chapter {chapter_num}",  # Will be enhanced with Sanskrit title later
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
            "sectionName": section_display_name,
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
    """
    Validate the generated manifest for completeness and correctness.

    Args:
        manifest: The generated manifest dict

    Returns:
        bool: True if valid, False otherwise
    """
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

    # Check sections
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
    print("║       MYGURUKUL CHAPTER MANIFEST GENERATOR v1.0            ║")
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
        print("   2. Optionally add Sanskrit chapter titles manually")
        print("   3. Upload to GCS:")
        print(f"      - Upload this file to: gs://mygurukul-library/metadata/")
        print(f"      - Upload PDFs to: gs://mygurukul-library/pdfs/{SCRIPTURE_ID}/")
        print(f"      - Upload chapter JSONs to: gs://mygurukul-library/metadata/chapters/{SCRIPTURE_ID}/")
        print("   4. Verify CORS and IAM permissions on GCS bucket")
        print("   5. Test frontend with this manifest")
        print("\n")

    except Exception as e:
        print(f"\n❌ Fatal Error: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)
