import json
import re
import time
from datetime import datetime
from pathlib import Path


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/NitiShastra/Panchatantra"
SCRIPTURE_ID = "panchatantra"
SCRIPTURE_NAME = "Pañcatantra"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Sastras/NitiShastra/Panchatantra"


# ============================================================================
# HELPERS
# ============================================================================


def extract_tantra_info(folder_name: str) -> tuple:
    """
    Extract Tantra number and name from folder name.
    Example: "Panchtantra_Tantra_1_Conflict_Among Friends" -> (1, "Conflict Among Friends")
    """
    match = re.search(r"Tantra_(\d+)_(.+)", folder_name)
    if match:
        try:
            tantra_num = int(match.group(1))
            tantra_name = match.group(2).replace("_", " ")
            return tantra_num, tantra_name
        except ValueError:
            pass
    return None, None


def get_story_number(folder_name: str) -> int:
    """
    Extract story number from folder name.
    Examples:
    - "Panchatantra_CAF_0_Conflict_Among_Friends" -> 0
    - "Panchatantra_CAF_1_Monkey_and_the_Log" -> 1
    - "Panchtantra_WOF_2_Mother_Shandili" -> 2
    """
    # Pattern: PREFIX_NUMBER_ or PREFIX_NUMBER
    match = re.search(r"_(CAF|WOF|COA|FOP|AWDC)_(\d+)_", folder_name, re.IGNORECASE)
    if match:
        try:
            return int(match.group(2))
        except ValueError:
            pass
    
    # Fallback: look for any number after the prefix
    match = re.search(r"_(CAF|WOF|COA|FOP|AWDC)_(\d+)", folder_name, re.IGNORECASE)
    if match:
        try:
            return int(match.group(2))
        except ValueError:
            pass
    
    return 0


def derive_fallback_title(folder_name: str) -> str:
    """Create a human-readable title from the story folder name."""
    # Remove Panchatantra prefix
    cleaned = re.sub(r"^Panch(?:a|t)ntra[_-]", "", folder_name, flags=re.IGNORECASE)
    # Remove Tantra prefixes (CAF, WOF, COA, FOP, AWDC) and numbers
    cleaned = re.sub(r"^(CAF|WOF|COA|FOP|AWDC)[_-]\d+[_-]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^(CAF|WOF|COA|FOP|AWDC)[_-]", "", cleaned, flags=re.IGNORECASE)
    # Remove leading numbers
    cleaned = re.sub(r"^\d+[_-]", "", cleaned)
    # Replace underscores with spaces
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    # Clean up multiple spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.title() if cleaned else "Panchatantra Story"


# ============================================================================
# MANIFEST GENERATION
# ============================================================================


def generate_chapter_manifest(root_directory: str):
    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - PAÑCATANTRA")
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

    # Find all Tantra folders (sections)
    print("\n🔎 Scanning for Tantra folders...")
    tantra_folders = sorted(
        [
            d
            for d in root_path.iterdir()
            if d.is_dir() and d.name.startswith("Panchtantra_Tantra_")
        ],
        key=lambda d: extract_tantra_info(d.name)[0] or 999,
    )

    if not tantra_folders:
        print(f"❌ Error: No Tantra folders found in {root_directory}")
        return None

    print(f"✅ Found {len(tantra_folders)} Tantra folder(s)")

    manifest = {
        "scriptureId": SCRIPTURE_ID,
        "scriptureName": SCRIPTURE_NAME,
        "totalChapters": 0,
        "lastUpdated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "sections": [],
    }

    # Process each Tantra (section)
    for tantra_folder in tantra_folders:
        tantra_num, tantra_name = extract_tantra_info(tantra_folder.name)
        if tantra_num is None:
            print(f"\n⚠️ Skipping {tantra_folder.name} - could not extract Tantra info")
            continue

        print(f"\n📂 Processing Tantra {tantra_num}: {tantra_name}")

        # Find all story folders in this Tantra
        story_folders = sorted(
            [
                d
                for d in tantra_folder.iterdir()
                if d.is_dir()
                and (d.name.startswith("Panchatantra_") or d.name.startswith("Panchtantra_"))
            ],
            key=lambda d: get_story_number(d.name),
        )

        if not story_folders:
            print(f"  ⚠️ No story folders found in {tantra_folder.name}")
            continue

        print(f"  Found {len(story_folders)} story folder(s)")

        chapters = []

        for story_folder in story_folders:
            story_num = get_story_number(story_folder.name)
            print(f"  📖 Processing story {story_num}: {story_folder.name}")

            # Find PDF and JSON files
            pdf_files = sorted(story_folder.glob("*.pdf"))
            if not pdf_files:
                print(f"    ⚠️ No PDF found, skipping")
                continue

            pdf_path = pdf_files[0]
            json_path = pdf_path.with_suffix(".json")

            # Try to find JSON with same base name as PDF
            if not json_path.exists():
                # Try alternative: look for any JSON in the folder
                json_files = list(story_folder.glob("*.json"))
                if json_files:
                    json_path = json_files[0]
                else:
                    json_path = None

            has_metadata = json_path is not None and json_path.exists()

            if not has_metadata:
                print(f"    ⚠️ Metadata JSON missing")

            # Get title from JSON if available, otherwise use fallback
            title = derive_fallback_title(story_folder.name)
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
                f"{GCS_BUCKET}/{GCS_BASE_PATH}/{tantra_folder.name}/{story_folder.name}/{json_path.name}"
                if has_metadata and json_path
                else ""
            )
            pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{tantra_folder.name}/{story_folder.name}/{pdf_path.name}"

            chapter_entry = {
                "chapterId": str(story_num),
                "chapterNumber": story_num,
                "title": title,
                "titleEnglish": title,  # Same as title for stories
                "metadataUrl": metadata_url,
                "pdfUrl": pdf_url,
                "hasMetadata": has_metadata,
            }

            chapters.append(chapter_entry)
            manifest["totalChapters"] += 1
            time.sleep(0.05)

        # Sort chapters by story number
        chapters.sort(key=lambda c: c["chapterNumber"])

        # Create section entry (Tantra = Section)
        section_entry = {
            "sectionId": str(tantra_num),
            "sectionName": f"Tantra {tantra_num}: {tantra_name}",
            "sectionNameEnglish": f"Tantra {tantra_num}: {tantra_name}",
            "chapterCount": len(chapters),
            "chapters": chapters,
        }

        manifest["sections"].append(section_entry)
        print(f"  ✅ Processed {len(chapters)} story/stories")

    # Sort sections by Tantra number
    manifest["sections"].sort(key=lambda x: int(x["sectionId"]))

    if not manifest["sections"]:
        print("❌ No sections were processed successfully")
        return None

    print(f"\n✅ Compiled {manifest['totalChapters']} total story/stories across {len(manifest['sections'])} Tantra(s)")
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
    print(f"✅ Total Sections (Tantras): {len(manifest['sections'])}")

    # Validate each section
    chapters_with_metadata = 0
    chapters_without_metadata = 0

    for section in manifest["sections"]:
        print(f"\n   Tantra {section['sectionId']}: {section['sectionName']}")
        print(f"      Stories: {section['chapterCount']}")

        if section.get("chapterCount", 0) != len(section.get("chapters", [])):
            print(f"      ❌ Chapter count mismatch")
            return False

        for chapter in section["chapters"]:
            if chapter.get("hasMetadata", False):
                chapters_with_metadata += 1
            else:
                chapters_without_metadata += 1

    print(f"\n✅ Stories with JSON metadata: {chapters_with_metadata}")
    if chapters_without_metadata > 0:
        print(f"⚠️ Stories without JSON metadata: {chapters_without_metadata}")

    print("\n✅ Manifest validation passed!")
    return True


# ============================================================================
# MAIN
# ============================================================================


def main():
    print("\n")
    print("╔══════════════════════════════════════════════════════════╗")
    print("║                                                          ║")
    print("║    MYGURUKUL CHAPTER MANIFEST GENERATOR - PAÑCATANTRA     ║")
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
        print(f"📊 Total Stories: {manifest['totalChapters']}")
        print(f"📚 Total Sections (Tantras): {len(manifest['sections'])}")
        print("=" * 80)

    except Exception as exc:
        print(f"\n❌ Fatal Error: {exc}")
        raise


if __name__ == "__main__":
    main()



