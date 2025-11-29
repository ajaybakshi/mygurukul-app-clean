import json
import re
import time
from datetime import datetime
from pathlib import Path


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Epics/Ramayana"
SCRIPTURE_ID = "ramayana_valmiki"  # Matches library manifest ID format
SCRIPTURE_NAME = "Ramayana by Valmiki"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Epics/Ramayana"


# ============================================================================
# HELPERS
# ============================================================================


def extract_kanda_info(folder_name: str) -> tuple:
    """
    Extract Kanda number and name from folder name.
    Normalizes to "Kanda X: Name" format.
    Example: "1. Bala Kanda" -> (1, "Kanda 1: Bala Kanda")
    Example: "4. Kishkindha Kanda " -> (4, "Kanda 4: Kishkindha Kanda") (handles trailing space)
    """
    # Match pattern: "1. Bala Kanda" or "4. Kishkindha Kanda "
    match = re.match(r"(\d+)\.\s*(.+?)\s*$", folder_name)
    if match:
        try:
            kanda_num = int(match.group(1))
            kanda_name = match.group(2).strip()  # Remove trailing spaces
            normalized_name = f"Kanda {kanda_num}: {kanda_name}"
            return kanda_num, normalized_name
        except ValueError:
            pass
    return None, None


def extract_chapter_number(filename: str) -> int:
    """
    Extract chapter number from filename.
    Handles formats:
    1. "CHAPTER 10 He describes..." -> 10
    2. "CHAPTER I" (Roman numerals) -> 1
    3. "Chapter 10" -> 10
    """
    # Try Arabic numerals first (most common)
    match = re.search(r"(?:CHAPTER|Chapter)\s+(\d+)", filename, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            pass
    
    # Try Roman numerals
    roman_to_int = {
        'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
        'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
        'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
        'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
        'xi': 11, 'xii': 12, 'xiii': 13, 'xiv': 14, 'xv': 15,
    }
    match = re.search(r"(?:CHAPTER|Chapter)\s+([IVX]+)", filename, re.IGNORECASE)
    if match:
        roman = match.group(1).upper()
        return roman_to_int.get(roman, None)
    
    return None


def derive_fallback_title(filename: str) -> str:
    """Create a human-readable title from the filename."""
    # Remove extension
    cleaned = Path(filename).stem
    
    # Remove CHAPTER/Chapter prefix and number
    cleaned = re.sub(r"^(?:CHAPTER|Chapter)\s+\d+\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^(?:CHAPTER|Chapter)\s+[IVX]+\s+", "", cleaned, flags=re.IGNORECASE)
    
    # Replace underscores/hyphens with spaces
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    
    # Clean up multiple spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    return cleaned if cleaned else "Ramayana Chapter"


# ============================================================================
# MANIFEST GENERATION
# ============================================================================


def generate_chapter_manifest(root_directory: str):
    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - RAMAYANA")
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

    # Find all Kanda folders (sections)
    print("\n🔎 Scanning for Kanda folders...")
    kanda_folders = []
    for d in root_path.iterdir():
        if d.is_dir() and re.match(r"^\d+\.\s+.+", d.name):
            kanda_folders.append(d)
    
    # Sort by kanda number
    kanda_folders = sorted(
        kanda_folders,
        key=lambda d: extract_kanda_info(d.name)[0] or 999,
    )

    if not kanda_folders:
        print(f"❌ Error: No Kanda folders found in {root_directory}")
        return None

    print(f"✅ Found {len(kanda_folders)} Kanda folder(s)")

    manifest = {
        "scriptureId": SCRIPTURE_ID,
        "scriptureName": SCRIPTURE_NAME,
        "totalChapters": 0,
        "lastUpdated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "sections": [],
    }

    # Process each Kanda (section)
    for kanda_folder in kanda_folders:
        kanda_num, normalized_name = extract_kanda_info(kanda_folder.name)
        if kanda_num is None:
            print(f"\n⚠️ Skipping {kanda_folder.name} - could not extract Kanda info")
            continue

        print(f"\n📂 Processing {normalized_name}")

        # Find all PDF files in this Kanda
        pdf_files = sorted(kanda_folder.glob("*.pdf"))

        if not pdf_files:
            print(f"  ⚠️ No PDF files found in {kanda_folder.name}")
            continue

        print(f"  Found {len(pdf_files)} PDF file(s)")

        chapters = []

        for pdf_path in pdf_files:
            pdf_filename = pdf_path.name
            
            # Extract chapter number from filename
            chapter_num = extract_chapter_number(pdf_filename)
            
            if chapter_num is None:
                print(f"    ⚠️ Could not extract chapter number from: {pdf_filename}")
                continue

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
                f"{GCS_BUCKET}/{GCS_BASE_PATH}/{kanda_folder.name}/{json_path.name}"
                if has_metadata
                else ""
            )
            pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{kanda_folder.name}/{pdf_path.name}"

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

        # Create section entry (Kanda = Section)
        section_entry = {
            "sectionId": str(kanda_num),
            "sectionName": normalized_name,
            "sectionNameEnglish": normalized_name,
            "chapterCount": len(chapters),
            "chapters": chapters,
        }

        manifest["sections"].append(section_entry)
        print(f"  ✅ Processed {len(chapters)} chapter(s)")

    # Sort sections by Kanda number
    manifest["sections"].sort(key=lambda x: int(x["sectionId"]))

    if not manifest["sections"]:
        print("❌ No sections were processed successfully")
        return None

    print(f"\n✅ Compiled {manifest['totalChapters']} total chapter(s) across {len(manifest['sections'])} Kanda(s)")
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
    print(f"✅ Total Sections (Kandas): {len(manifest['sections'])}")

    # Validate each section
    chapters_with_metadata = 0
    chapters_without_metadata = 0

    for section in manifest["sections"]:
        print(f"\n   {section['sectionName']}")
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
    print("║  MYGURUKUL CHAPTER MANIFEST GENERATOR - RAMAYANA         ║")
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
        print(f"📚 Total Sections (Kandas): {len(manifest['sections'])}")
        print("=" * 80)

    except Exception as exc:
        print(f"\n❌ Fatal Error: {exc}")
        raise


if __name__ == "__main__":
    main()


