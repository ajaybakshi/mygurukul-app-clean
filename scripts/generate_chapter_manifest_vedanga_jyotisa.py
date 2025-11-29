#!/usr/bin/env python3
"""
Vedanga Jyotisa Laghdhara Chapter Manifest Generator

Generates a chapter manifest JSON file for Vedanga Jyotisa based on the folder structure.
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/VedangaShastra/Jyotisa/Vedanga Jyotisa Laghdhara"
SCRIPTURE_ID = "VedangaSastra_Jyotisa"
SCRIPTURE_NAME = "Vedanga Jyotisa Lagadha"
SECTION_ID = "1"
SECTION_NAME = "Vedanga Jyotisa Chapters"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
# Note: GCS path does NOT include "Vedanga Jyotisa Laghdhara" - chapters are directly under Jyotisa/
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Sastras/VedangaShastra/Jyotisa"


# ============================================================================
# HELPERS
# ============================================================================


def get_chapter_number(folder_name: str) -> int:
    """Extract chapter number from folder name like 'Chapter 1 History of...'"""
    match = re.search(r"Chapter\s+(\d+)", folder_name, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return 0
    return 0


def derive_fallback_title(folder_name: str) -> str:
    """Extract title from folder name as fallback"""
    # Remove "Chapter X" prefix
    cleaned = re.sub(r"^Chapter\s+\d+\s+", "", folder_name, flags=re.IGNORECASE)
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or folder_name


def iter_chapter_dirs(root_path: Path):
    """Iterate over chapter directories, skipping root-level files"""
    for directory in sorted(root_path.iterdir()):
        if not directory.is_dir():
            continue
        # Skip if it doesn't look like a chapter folder
        if not re.search(r"Chapter\s+\d+", directory.name, re.IGNORECASE):
            continue
        pdfs = list(directory.glob("*.pdf"))
        if pdfs:
            yield directory


# ============================================================================
# MANIFEST GENERATION
# ============================================================================


def generate_chapter_manifest(root_directory: str):
    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - VEDANGA JYOTISA LAGHDHARA")
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

    directories = list(iter_chapter_dirs(root_path))
    if not directories:
        print("❌ Error: No chapter directories found.")
        return None

    print(f"Found {len(directories)} chapter folder(s).")

    chapters = []

    for directory in directories:
        chapter_num = get_chapter_number(directory.name)
        print(f"\n📂 Processing {directory.name}")

        pdf_files = sorted(directory.glob("*.pdf"))
        if not pdf_files:
            print("  ⚠️ No PDF found, skipping")
            continue

        pdf_path = pdf_files[0]
        json_path = pdf_path.with_suffix(".json")
        has_metadata = json_path.exists()

        if not has_metadata:
            print("  ⚠️ Metadata JSON missing")

        # Try to get title from JSON metadata, otherwise use folder name
        title = derive_fallback_title(directory.name)
        title_english = title
        
        if has_metadata:
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                title = data.get("chapterTitle", title)
                title_english = title  # Use same title for English
            except Exception as exc:
                print(f"  ⚠️ Could not read metadata JSON: {exc}")
                has_metadata = False

        # Construct GCS URLs
        # Note: Files are directly under Jyotisa/ in GCS, not under Vedanga Jyotisa Laghdhara/
        # Pattern: gs://mygurukul-sacred-texts-corpus/Gurukul_Library/Primary_Texts/Sastras/VedangaShastra/Jyotisa/Chapter 1 History of Ancient Vedic Astronomy and Calendars/...
        metadata_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{directory.name}/{json_path.name}"
        pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{directory.name}/{pdf_path.name}"

        chapter_entry = {
            "chapterId": str(chapter_num or len(chapters) + 1),
            "chapterNumber": chapter_num or (len(chapters) + 1),
            "title": title,
            "titleEnglish": title_english,
            "metadataUrl": metadata_url,
            "pdfUrl": pdf_url,
            "hasMetadata": has_metadata
        }

        chapters.append(chapter_entry)
        print(f"  ✅ Chapter {chapter_num}: {title[:60]}...")
        time.sleep(0.05)

    if not chapters:
        print("❌ No chapters were added to manifest.")
        return None

    # Sort chapters by chapter number
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

    for field in ["scriptureId", "scriptureName", "totalChapters", "sections"]:
        if field not in manifest:
            print(f"❌ Missing required field: {field}")
            return False

    sections = manifest.get("sections", [])
    if len(sections) != 1:
        print(f"❌ Expected exactly one section, found {len(sections)}")
        return False

    section = sections[0]
    chapter_count = section.get("chapterCount", 0)
    chapters = section.get("chapters", [])

    if chapter_count != len(chapters):
        print("❌ Chapter count mismatch in section")
        return False

    if manifest["totalChapters"] != chapter_count:
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
    print("║  MYGURUKUL CHAPTER MANIFEST GENERATOR - VEDANGA JYOTISA    ║")
    print("║                                                          ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print("\n")

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
    print(f"📁 Section: {SECTION_NAME}")
    print("=" * 80)


if __name__ == "__main__":
    main()

