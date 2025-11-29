#!/usr/bin/env python3
"""
Vastu Sastra Chapter Manifest Generator

Generates a chapter manifest JSON file for Vastu Sastra based on the folder structure.
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path


# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIRECTORY = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Sastras/VastuShastra/Vastu Sastra"
SCRIPTURE_ID = "Vastu_Sastra"
SCRIPTURE_NAME = "Vastu Sastra Viswakarma"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
# Note: GCS path does NOT include "Vastu Sastra" - Parts are directly under VastuShastra/
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Sastras/VastuShastra"


# ============================================================================
# HELPERS
# ============================================================================


def extract_part_info(folder_name: str) -> tuple:
    """Extract Part number and name from folder name."""
    match = re.search(r"Part\s+(\d+)\s+(.+)", folder_name, re.IGNORECASE)
    if match:
        try:
            part_num = int(match.group(1))
            part_name = match.group(2).strip()
            return part_num, part_name
        except ValueError:
            pass
    return None, None


def get_chapter_number(filename: str) -> int:
    """Extract chapter number from filename."""
    # Pattern: "Chapter 1", "Chapter 2", etc.
    match = re.search(r"Chapter\s+(\d+)", filename, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            pass
    
    # Handle "Introduction" files - assign 0 or a high number
    if "Introduction" in filename or "Introductory" in filename:
        return 0
    
    return 999  # Put non-chapter files at the end


def derive_fallback_title(filename: str) -> str:
    """Extract title from filename as fallback."""
    # Remove file extension
    stem = Path(filename).stem
    # Remove "Chapter X" prefix if present
    cleaned = re.sub(r"^Chapter\s+\d+\s*[-:]?\s*", "", stem, flags=re.IGNORECASE)
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or filename


# ============================================================================
# MANIFEST GENERATION
# ============================================================================


def generate_chapter_manifest(root_directory: str):
    print("=" * 80)
    print("CHAPTER MANIFEST GENERATOR - VASTU SASTRA")
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

    # Find all Part folders (sections)
    print("\n🔎 Scanning for Part folders...")
    part_folders = sorted(
        [
            d
            for d in root_path.iterdir()
            if d.is_dir() and re.search(r"Part\s+\d+", d.name, re.IGNORECASE)
        ],
        key=lambda d: extract_part_info(d.name)[0] or 999,
    )

    if not part_folders:
        print(f"❌ Error: No Part folders found in {root_directory}")
        return None

    print(f"✅ Found {len(part_folders)} Part folder(s)")

    manifest = {
        "scriptureId": SCRIPTURE_ID,
        "scriptureName": SCRIPTURE_NAME,
        "totalChapters": 0,
        "lastUpdated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "sections": [],
    }

    # Process each Part (section)
    for part_folder in part_folders:
        part_num, part_name = extract_part_info(part_folder.name)
        if part_num is None:
            print(f"\n⚠️ Skipping {part_folder.name} - could not extract Part info")
            continue

        print(f"\n📂 Processing Part {part_num}: {part_name}")

        # Find all PDF files in this Part
        pdf_files = sorted(part_folder.glob("*.pdf"), key=lambda p: get_chapter_number(p.name))

        if not pdf_files:
            print(f"  ⚠️ No PDF files found in {part_folder.name}")
            continue

        print(f"  Found {len(pdf_files)} PDF file(s)")

        chapters = []

        for pdf_path in pdf_files:
            chapter_num = get_chapter_number(pdf_path.name)
            
            # Skip if it's an introduction file (we'll handle it separately if needed)
            if chapter_num == 0 and "Introduction" not in pdf_path.name and "Introductory" not in pdf_path.name:
                continue

            json_path = pdf_path.with_suffix(".json")
            has_metadata = json_path.exists()

            if not has_metadata:
                print(f"    ⚠️ Metadata JSON missing for: {pdf_path.name}")

            # Get title from JSON if available, otherwise use fallback
            title = derive_fallback_title(pdf_path.name)
            title_english = title
            
            if has_metadata:
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    title = data.get("chapterTitle", title)
                    title_english = title
                except Exception as exc:
                    print(f"    ⚠️ Could not read metadata JSON: {exc}")
                    has_metadata = False

            # Construct GCS URLs
            # Note: Files are directly under VastuShastra/ in GCS, not under Vastu Sastra/
            # Pattern: gs://mygurukul-sacred-texts-corpus/Gurukul_Library/Primary_Texts/Sastras/VastuShastra/Part 1 The Fundamental Canons/Chapter 1 Introductory Part 1.pdf
            metadata_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{part_folder.name}/{json_path.name}" if has_metadata else ""
            pdf_url = f"{GCS_BUCKET}/{GCS_BASE_PATH}/{part_folder.name}/{pdf_path.name}"

            # For chapter numbering, use sequential numbering within the part
            # Introduction files get chapter 0, then chapters are numbered 1, 2, 3...
            if chapter_num == 0:
                chapter_id = "0"
            else:
                chapter_id = str(chapter_num)

            chapter_entry = {
                "chapterId": chapter_id,
                "chapterNumber": chapter_num if chapter_num != 999 else len(chapters) + 1,
                "title": title,
                "titleEnglish": title_english,
                "metadataUrl": metadata_url,
                "pdfUrl": pdf_url,
                "hasMetadata": has_metadata,
            }

            chapters.append(chapter_entry)
            manifest["totalChapters"] += 1
            print(f"    ✅ Chapter {chapter_num}: {title[:50]}...")
            time.sleep(0.05)

        # Sort chapters by chapter number
        chapters.sort(key=lambda c: c["chapterNumber"])

        # Create section entry (Part = Section)
        section_entry = {
            "sectionId": str(part_num),
            "sectionName": f"Part {part_num}: {part_name}",
            "sectionNameEnglish": f"Part {part_num}: {part_name}",
            "chapterCount": len(chapters),
            "chapters": chapters,
        }

        manifest["sections"].append(section_entry)
        print(f"  ✅ Processed {len(chapters)} chapter(s)")

    # Sort sections by Part number
    manifest["sections"].sort(key=lambda x: int(x["sectionId"]))

    if not manifest["sections"]:
        print("❌ No sections were processed successfully")
        return None

    print(f"\n✅ Compiled {manifest['totalChapters']} total chapters across {len(manifest['sections'])} Part(s)")
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
    print(f"✅ Total Sections (Parts): {len(manifest['sections'])}")

    # Validate each section
    chapters_with_metadata = 0
    chapters_without_metadata = 0

    for section in manifest["sections"]:
        print(f"\n   Part {section['sectionId']}: {section['sectionName']}")
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
    print("║   MYGURUKUL CHAPTER MANIFEST GENERATOR - VASTU SASTRA     ║")
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
        print(f"📚 Total Sections (Parts): {len(manifest['sections'])}")
        print("=" * 80)

    except Exception as exc:
        print(f"\n❌ Fatal Error: {exc}")
        raise


if __name__ == "__main__":
    main()

