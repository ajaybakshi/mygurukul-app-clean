import json
import re
import time
from datetime import datetime
from pathlib import Path


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Puranas/Bhagvata_Purana"
SCRIPTURE_ID = "Bhagvata_Purana"  # Matches library manifest ID format
SCRIPTURE_NAME = "Bhagavata Purana"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Puranas/Bhagvata_Purana"


# ============================================================================
# HELPERS
# ============================================================================


def extract_canto_info(folder_name: str) -> tuple:
    """
    Extract Canto number and descriptive name from folder name.
    Example: "Canto_1_Srimad_Bhagvatam_Creation" -> (1, "Creation")
    Example: "Canto_10_Srimad_Bhagvatam_Summum_Bonum" -> (10, "Summum Bonum")
    """
    match = re.search(r"Canto_(\d+)_Srimad_Bhagvatam_(.+)", folder_name)
    if match:
        try:
            canto_num = int(match.group(1))
            canto_desc = match.group(2).replace("_", " ")
            return canto_num, canto_desc
        except ValueError:
            pass
    return None, None


def extract_chapter_info(filename: str) -> tuple:
    """
    Extract Canto and Chapter numbers from filename.
    Handles two formats:
    1. "SB_1_1_Questions_by_the_Sages.pdf" -> (1, 1)
    2. "SB 10.1- The Advent of Lord Kṛṣṇa- Introduction.pdf" -> (10, 1)
    """
    # Format 1: SB_X_Y_Title.pdf
    match = re.search(r"SB_(\d+)_(\d+)_", filename)
    if match:
        try:
            canto_num = int(match.group(1))
            chapter_num = int(match.group(2))
            return canto_num, chapter_num
        except ValueError:
            pass
    
    # Format 2: SB X.Y- Title.pdf
    match = re.search(r"SB\s+(\d+)\.(\d+)[\s-]", filename)
    if match:
        try:
            canto_num = int(match.group(1))
            chapter_num = int(match.group(2))
            return canto_num, chapter_num
        except ValueError:
            pass
    
    return None, None


def derive_fallback_title(filename: str) -> str:
    """Create a human-readable title from the filename."""
    # Remove extension
    cleaned = Path(filename).stem
    
    # Remove SB prefix and numbers
    cleaned = re.sub(r"^SB[_\s]*\d+[._]\d+[_\s-]*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^SB[_\s]*", "", cleaned, flags=re.IGNORECASE)
    
    # Replace underscores/hyphens with spaces
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    
    # Clean up multiple spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    return cleaned.title() if cleaned else "Bhagavata Purana Chapter"


# ============================================================================
# MANIFEST GENERATION
# ============================================================================


def generate_chapter_manifest(root_directory: str):
    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - BHAGAVATA PURANA")
    print("=" * 80)
    print(f"Scripture: {SCRIPTURE_NAME}")
    print(f"Root Directory: {root_directory}")
    print(f"GCS Bucket: {GCS_BUCKET}")
    print(f"GCS Base Path: {GCS_BASE_PATH}")
    print("=" * 80)

    root_path = Path(root_directory)
    if not root_path.exists():
        print(f"❌ Error: Directory does not exist: {root_directory}")
        return None

    # Find all Canto folders (sections)
    print("\n🔎 Scanning for Canto folders...")
    canto_folders = sorted(
        [
            d
            for d in root_path.iterdir()
            if d.is_dir() and d.name.startswith("Canto_")
        ],
        key=lambda d: extract_canto_info(d.name)[0] or 999,
    )

    if not canto_folders:
        print(f"❌ Error: No Canto folders found in {root_directory}")
        return None

    print(f"✅ Found {len(canto_folders)} Canto folder(s)")

    manifest = {
        "scriptureId": SCRIPTURE_ID,
        "scriptureName": SCRIPTURE_NAME,
        "totalChapters": 0,
        "lastUpdated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "sections": [],
    }

    # Process each Canto (section)
    for canto_folder in canto_folders:
        canto_num, canto_desc = extract_canto_info(canto_folder.name)
        if canto_num is None:
            print(f"\n⚠️ Skipping {canto_folder.name} - could not extract Canto info")
            continue

        print(f"\n📂 Processing Canto {canto_num}: {canto_desc}")

        # Find all PDF files in this Canto
        pdf_files = sorted(canto_folder.glob("*.pdf"))

        if not pdf_files:
            print(f"  ⚠️ No PDF files found in {canto_folder.name}")
            continue

        print(f"  Found {len(pdf_files)} PDF file(s)")

        chapters = []

        for pdf_path in pdf_files:
            pdf_filename = pdf_path.name
            
            # Extract canto and chapter numbers from filename
            file_canto, chapter_num = extract_chapter_info(pdf_filename)
            
            # Verify canto matches folder
            if file_canto is None or chapter_num is None:
                print(f"    ⚠️ Could not extract chapter info from: {pdf_filename}")
                continue
            
            if file_canto != canto_num:
                print(f"    ⚠️ Canto mismatch: file says {file_canto}, folder says {canto_num} - {pdf_filename}")
                # Use folder canto number
                file_canto = canto_num

            # Check if corresponding JSON exists
            json_path = pdf_path.with_suffix(".json")
            has_metadata = json_path.exists()

            if not has_metadata:
                print(f"    ⚠️ Metadata JSON missing for: {pdf_filename}")

            # Get title from JSON if available, otherwise use fallback
            title = derive_fallback_title(pdf_filename)
            if has_metadata:
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    title = data.get("chapterTitle", title)
                except Exception as exc:
                    print(f"    ⚠️ Could not read metadata JSON: {exc}")
                    has_metadata = False

            # Construct GCS URLs
            metadata_url = (
                f"{GCS_BUCKET}/{GCS_BASE_PATH}/{canto_folder.name}/{json_path.name}"
                if has_metadata
                else ""
            )
            pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{canto_folder.name}/{pdf_path.name}"

            chapter_entry = {
                "chapterId": str(chapter_num),
                "chapterNumber": chapter_num,
                "title": title,
                "titleEnglish": title,  # Same as title for chapters
                "metadataUrl": metadata_url,
                "pdfUrl": pdf_url,
                "hasMetadata": has_metadata,
            }

            chapters.append(chapter_entry)
            manifest["totalChapters"] += 1
            time.sleep(0.01)  # Small delay to avoid overwhelming system

        # Sort chapters by chapter number
        chapters.sort(key=lambda c: c["chapterNumber"])

        # Create section entry (Canto = Section)
        section_entry = {
            "sectionId": str(canto_num),
            "sectionName": f"Canto {canto_num}: {canto_desc}",
            "sectionNameEnglish": f"Canto {canto_num}: {canto_desc}",
            "chapterCount": len(chapters),
            "chapters": chapters,
        }

        manifest["sections"].append(section_entry)
        print(f"  ✅ Processed {len(chapters)} chapter(s)")

    # Sort sections by Canto number
    manifest["sections"].sort(key=lambda x: int(x["sectionId"]))

    if not manifest["sections"]:
        print("❌ No sections were processed successfully")
        return None

    print(f"\n✅ Compiled {manifest['totalChapters']} total chapter(s) across {len(manifest['sections'])} Canto(s)")
    return manifest


# ============================================================================
# VALIDATION
# ============================================================================


def validate_manifest(manifest):
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
    print(f"✅ Total Sections (Cantos): {len(manifest['sections'])}")

    # Validate each section
    chapters_with_metadata = 0
    chapters_without_metadata = 0

    for section in manifest["sections"]:
        print(f"\n   Canto {section['sectionId']}: {section['sectionName']}")
        print(f"      Chapters: {section['chapterCount']}")

        if section.get("chapterCount", 0) != len(section.get("chapters", [])):
            print(f"      ❌ Chapter count mismatch")
            return False

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
# MAIN
# ============================================================================


def main():
    print("\n")
    print("╔══════════════════════════════════════════════════════════╗")
    print("║                                                          ║")
    print("║  MYGURUKUL CHAPTER MANIFEST GENERATOR - BHAGAVATA PURANA  ║")
    print("║                                                          ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print("\n")

    try:
        manifest = generate_chapter_manifest(ROOT_DIRECTORY)
        if manifest is None:
            print("\n❌ Failed to generate manifest")
            return

        if not validate_manifest(manifest):
            print("\n❌ Manifest validation failed")
            return

        output_filename = f"{SCRIPTURE_ID}_chapter_manifest.json"
        output_path = Path(ROOT_DIRECTORY) / output_filename

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 80)
        print("SUCCESS!")
        print("=" * 80)
        print(f"✅ Generated: {output_path}")
        print(f"📊 Total Chapters: {manifest['totalChapters']}")
        print(f"📚 Total Sections (Cantos): {len(manifest['sections'])}")
        print("=" * 80)

    except Exception as exc:
        print(f"\n❌ Fatal Error: {exc}")
        raise


if __name__ == "__main__":
    main()

