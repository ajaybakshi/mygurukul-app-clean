#!/usr/bin/env python3
import os
import json
from pathlib import Path
from datetime import datetime

# CONFIGURATION - Update this path to match your Sushruta folder
SCRIPTURE_ROOT = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Sushruta_Samhita"
SCRIPTURE_ID = "sushruta_samhita"
SCRIPTURE_NAME = "Sushruta Saṃhitā"
GCS_BUCKET = "gs://mygurukul-sacred-texts-corpus"
GCS_BASE_PATH = "Gurukul_Library/Primary_Texts/Ayurveda/Sushruta_Samhita"

# Section name translations
SECTION_TRANSLATIONS = {
    "Sutrasthanam": "Foundational Principles",
    "Nidanasthanam": "Diagnostics", 
    "Sarirasthanam": "Anatomy",
    "Chikitsasthanam": "Therapeutics",
    "Kalpasthanam": "Pharmaceutics",
    "Uttaratantram": "Supplementary Treatise"
}

def extract_section_info(folder_name):
    clean_name = folder_name.replace("Sushruta_Samhita_", "").replace("sushruta_samhita_", "")
    if "Section_" in clean_name:
        parts = clean_name.split("_")
        if len(parts) >= 3:
            section_id = parts[1]
            section_name = "_".join(parts[2:])
        else:
            section_id = "unknown"
            section_name = clean_name
    else:
        section_id = "unknown"
        section_name = folder_name
    section_english = SECTION_TRANSLATIONS.get(section_name, "")
    return section_id, section_name, section_english

def main():
    print("=" * 80)
    print("SUSHRUTA SAMHITA CHAPTER MANIFEST GENERATOR")
    print("=" * 80)
    print(f"Scripture: {SCRIPTURE_NAME}")
    print(f"Root: {SCRIPTURE_ROOT}")
    print("=" * 80)

    root_path = Path(SCRIPTURE_ROOT)
    if not root_path.exists():
        print(f"ERROR: Directory not found: {SCRIPTURE_ROOT}")
        print("Please update SCRIPTURE_ROOT in the script")
        return

    manifest = {
        "scriptureId": SCRIPTURE_ID,
        "scriptureName": SCRIPTURE_NAME,
        "totalChapters": 0,
        "lastUpdated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "sections": []
    }

    section_folders = sorted([d for d in root_path.iterdir() if d.is_dir()])
    print(f"\nFound {len(section_folders)} section folders\n")

    for section_folder in section_folders:
        folder_name = section_folder.name
        print(f"Processing: {folder_name}")

        section_id, section_name, section_english = extract_section_info(folder_name)
        chapters = []

        for pdf_path in sorted(section_folder.glob("*.pdf")):
            pdf_filename = pdf_path.stem
            if "Chapter_" not in pdf_filename:
                continue

            try:
                chapter_part = pdf_filename.split("Chapter_")[1]
                chapter_num = int(chapter_part.split('_')[0] if '_' in chapter_part else chapter_part)
            except:
                print(f"  Warning: Could not parse chapter number from {pdf_path.name}")
                continue

            json_path = pdf_path.with_suffix('.json')
            has_metadata = json_path.exists()

            chapters.append({
                "chapterId": str(chapter_num),
                "chapterNumber": chapter_num,
                "title": f"Chapter {chapter_num}",
                "titleEnglish": "",
                "metadataUrl": f"{GCS_BUCKET}/{GCS_BASE_PATH}/{folder_name}/{json_path.name}",
                "pdfUrl": f"{GCS_BUCKET}/{GCS_BASE_PATH}/{folder_name}/{pdf_path.name}",
                "hasMetadata": has_metadata
            })
            manifest["totalChapters"] += 1

        chapters.sort(key=lambda x: x["chapterNumber"])

        manifest["sections"].append({
            "sectionId": section_id,
            "sectionName": section_name,
            "sectionNameEnglish": section_english,
            "chapterCount": len(chapters),
            "chapters": chapters
        })

        print(f"  Added {len(chapters)} chapters")

    try:
        manifest["sections"].sort(key=lambda x: int(x["sectionId"]))
    except:
        pass

    output_file = f"{SCRIPTURE_ID}_chapter_manifest.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 80)
    print("SUCCESS!")
    print("=" * 80)
    print(f"Created: {output_file}")
    print(f"Total Chapters: {manifest['totalChapters']}")
    print(f"Total Sections: {len(manifest['sections'])}")
    print("=" * 80)

if __name__ == "__main__":
    main()
