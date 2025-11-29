import json
import re
import time
from datetime import datetime
from pathlib import Path


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/NatyaShastra"
SCRIPTURE_ID = "natyashastra"
SCRIPTURE_NAME = "Nāṭyaśāstra"
SECTION_ID = "1"
SECTION_NAME = "Nāṭyaśāstra Chapters"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Sastras/NatyaShastra"


# ============================================================================
# HELPERS
# ============================================================================


def get_chapter_number(name: str) -> int:
    """Extract a chapter number from folder or filename; return 0 if missing."""

    match = re.search(r"Chapter_(\d+)", name)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return 0
    return 0


def derive_fallback_title(folder_name: str) -> str:
    """Create a human-readable title from the chapter folder name."""

    cleaned = folder_name.replace("_", " ")
    return cleaned.strip()


# ============================================================================
# MANIFEST GENERATION
# ============================================================================


def generate_chapter_manifest(root_directory: str):
    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - NĀṬYAŚĀSTRA")
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

    chapter_dirs = sorted(
        [d for d in root_path.iterdir() if d.is_dir() and d.name.startswith("Chapter_")],
        key=lambda d: get_chapter_number(d.name)
    )

    if not chapter_dirs:
        print(f"❌ Error: No chapter directories found in {root_directory}")
        return None

    print(f"✅ Found {len(chapter_dirs)} chapter folder(s)")

    chapters = []
    total_chapters = 0

    for chapter_dir in chapter_dirs:
        chapter_num = get_chapter_number(chapter_dir.name)
        print(f"\n📂 Processing: {chapter_dir.name}")

        pdf_files = sorted(chapter_dir.glob("*.pdf"))

        if not pdf_files:
            print("  ⚠️ No PDF files found; skipping directory")
            continue

        pdf_path = pdf_files[0]
        json_path = pdf_path.with_suffix(".json")

        has_metadata = json_path.exists()
        if not has_metadata:
            print("  ⚠️ Metadata JSON missing")

        title = derive_fallback_title(chapter_dir.name)
        if has_metadata:
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                title = data.get("chapterTitle", title)
            except Exception as exc:
                print(f"  ⚠️ Could not read metadata JSON: {exc}")
                has_metadata = False

        metadata_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{chapter_dir.name}/{json_path.name}"
        pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{chapter_dir.name}/{pdf_path.name}"

        chapter_entry = {
            "chapterId": str(chapter_num or total_chapters + 1),
            "chapterNumber": chapter_num or (total_chapters + 1),
            "title": title,
            "metadataUrl": metadata_url,
            "pdfUrl": pdf_url,
            "hasMetadata": has_metadata
        }

        chapters.append(chapter_entry)
        total_chapters += 1

        time.sleep(0.05)

    if not chapters:
        print("❌ No chapters were processed successfully")
        return None

    chapters.sort(key=lambda c: c["chapterNumber"])

    manifest = {
        "scriptureId": SCRIPTURE_ID,
        "scriptureName": SCRIPTURE_NAME,
        "totalChapters": len(chapters),
        "lastUpdated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "sections": [
            {
                "sectionId": SECTION_ID,
                "sectionName": SECTION_NAME,
                "sectionNameEnglish": SECTION_NAME,
                "chapterCount": len(chapters),
                "chapters": chapters,
            }
        ],
    }

    print(f"\n✅ Compiled {len(chapters)} chapter entries")
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

    sections = manifest.get("sections", [])
    if len(sections) != 1:
        print(f"❌ Expected exactly one section, found {len(sections)}")
        return False

    section = sections[0]
    if section.get("chapterCount", 0) != len(section.get("chapters", [])):
        print("❌ Chapter count mismatch in section")
        return False

    if manifest["totalChapters"] != section.get("chapterCount", 0):
        print("❌ totalChapters does not match section chapterCount")
        return False

    print(f"✅ Scripture ID: {manifest['scriptureId']}")
    print(f"✅ Scripture Name: {manifest['scriptureName']}")
    print(f"✅ Total Chapters: {manifest['totalChapters']}")
    print(f"✅ Section Name: {section['sectionName']}")
    print("\n✅ Manifest validation passed")
    return True


# ============================================================================
# MAIN
# ============================================================================


def main():
    print("\n")
    print("╔══════════════════════════════════════════════════════════╗")
    print("║                                                          ║")
    print("║    MYGURUKUL CHAPTER MANIFEST GENERATOR - NĀṬYAŚĀSTRA    ║")
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
        output_path = Path(ROOT_DIRECTORY).parent / output_filename

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 80)
        print("SUCCESS!")
        print("=" * 80)
        print(f"✅ Generated: {output_path}")
        print(f"📊 Total Chapters: {manifest['totalChapters']}")
        print(f"📁 Section: {SECTION_NAME}")
        print("=" * 80)

    except Exception as exc:
        print(f"\n❌ Fatal Error: {exc}")
        raise


if __name__ == "__main__":
    main()





