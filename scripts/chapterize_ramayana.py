#!/usr/bin/env python3
"""
Ramayana Chapterization Script

This script parses the Valmiki Ramayana Sanskrit text file and:
1. Extracts chapters (sargas) organized by kanda (book)
2. Creates folders for each kanda
3. Saves each sarga as a text file preserving original formatting

Structure:
- Kanda folders: Kanda_1_Bala_Kanda, Kanda_2_Ayodhya_Kanda, etc.
- Chapter files: Sarga_001.txt, Sarga_002.txt, etc.

Usage:
    python3 scripts/chapterize_ramayana.py
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, List

# ============================================================================
# CONFIGURATION
# ============================================================================

# Path to the Ramayana text file
RAMAYANA_TEXT_FILE = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Epics/Ramayana/Valmiki-Ramayana_Sanskrit.txt"

# Output directory (will create kanda folders here)
OUTPUT_DIR = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Epics/Ramayana"

# Kanda names mapping
KANDA_NAMES = {
    1: "Bala_Kanda",
    2: "Ayodhya_Kanda",
    3: "Aranya_Kanda",
    4: "Kishkindha_Kanda",
    5: "Sundara_Kanda",
    6: "Yuddha_Kanda",
    7: "Uttara_Kanda"
}

# Kanda names in English (for display)
KANDA_NAMES_ENGLISH = {
    1: "Bala Kanda (Childhood)",
    2: "Ayodhya Kanda",
    3: "Aranya Kanda (Forest)",
    4: "Kishkindha Kanda",
    5: "Sundara Kanda (Beautiful)",
    6: "Yuddha Kanda (War)",
    7: "Uttara Kanda (Later)"
}

# ============================================================================
# TEXT PARSING - PRESERVE ORIGINAL FORMATTING
# ============================================================================

def parse_ramayana_text(file_path: str) -> Dict[int, Dict[int, str]]:
    """
    Parse the Ramayana text file and organize sargas by kanda.
    Preserves original text formatting exactly as-is.
    
    Returns:
        Dict structure: {kanda: {sarga: full_text}}
    """
    print(f"📖 Reading Ramayana text from: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Structure: {kanda: {sarga: full_text}}
    chapters = defaultdict(lambda: defaultdict(str))
    
    current_kanda = None
    current_sarga = None
    current_sarga_lines = []
    
    verse_pattern = re.compile(r'R_(\d+),(\d+)\.(\d+)')
    
    for line_num, line in enumerate(lines, 1):
        original_line = line  # Keep original line with newline
        
        # Skip header lines (but keep empty lines and verse content)
        stripped = line.strip()
        if stripped.startswith('#') or stripped.startswith('##'):
            continue
        
        # Look for verse reference pattern: R_kanda,sarga.verse
        match = verse_pattern.search(line)
        
        if match:
            kanda = int(match.group(1))
            sarga = int(match.group(2))
            verse_num = int(match.group(3))
            
            # If we're starting a new sarga, save the previous one
            if current_kanda is not None and current_sarga is not None:
                if kanda != current_kanda or sarga != current_sarga:
                    # Save previous sarga (join all lines preserving formatting)
                    if current_sarga_lines:
                        chapters[current_kanda][current_sarga] = ''.join(current_sarga_lines)
                    current_sarga_lines = []
            
            # Update current kanda/sarga
            current_kanda = kanda
            current_sarga = sarga
            
            # Add the line as-is (preserving original formatting)
            current_sarga_lines.append(original_line)
        
        elif current_kanda is not None and current_sarga is not None:
            # Continuation of current sarga (lines between verses, empty lines, etc.)
            # Preserve everything exactly as-is
            current_sarga_lines.append(original_line)
    
    # Don't forget the last sarga
    if current_kanda is not None and current_sarga is not None and current_sarga_lines:
        chapters[current_kanda][current_sarga] = ''.join(current_sarga_lines)
    
    print(f"✅ Parsed {len(chapters)} kandas")
    for kanda in sorted(chapters.keys()):
        sarga_count = len(chapters[kanda])
        total_chars = sum(len(text) for text in chapters[kanda].values())
        print(f"   Kanda {kanda}: {sarga_count} sargas, ~{total_chars:,} characters")
    
    return chapters

# ============================================================================
# FILE SAVING
# ============================================================================

def save_sarga_text(
    kanda: int,
    sarga: int,
    text: str,
    output_path: Path
) -> bool:
    """
    Save a sarga's text to a file, preserving original formatting.
    
    Args:
        kanda: Kanda number (1-7)
        sarga: Sarga number
        text: Full text content of the sarga
        output_path: Path where text file should be saved
    """
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)
        return True
    except Exception as e:
        print(f"❌ Error saving file for Kanda {kanda}, Sarga {sarga}: {e}")
        return False

# ============================================================================
# MAIN PROCESSING
# ============================================================================

def main():
    """Main function to process Ramayana and extract chapter text files."""
    print("=" * 80)
    print("RĀMĀYAṆA CHAPTERIZATION SCRIPT")
    print("=" * 80)
    print("Extracting sargas as text files preserving original formatting")
    print("=" * 80)
    
    # Parse text file
    if not os.path.exists(RAMAYANA_TEXT_FILE):
        print(f"❌ Error: Text file not found: {RAMAYANA_TEXT_FILE}")
        return
    
    chapters = parse_ramayana_text(RAMAYANA_TEXT_FILE)
    
    if not chapters:
        print("❌ Error: No chapters found in text file")
        return
    
    # Create output directory structure
    output_base = Path(OUTPUT_DIR)
    output_base.mkdir(parents=True, exist_ok=True)
    
    total_chapters = 0
    successful_saves = 0
    
    # Process each kanda
    for kanda in sorted(chapters.keys()):
        kanda_name = KANDA_NAMES.get(kanda, f"Kanda_{kanda}")
        kanda_folder = output_base / f"Kanda_{kanda}_{kanda_name}"
        kanda_folder.mkdir(exist_ok=True)
        
        print(f"\n📚 Processing {KANDA_NAMES_ENGLISH.get(kanda, f'Kanda {kanda}')}...")
        print(f"   Folder: {kanda_folder.name}")
        
        # Process each sarga in this kanda
        for sarga in sorted(chapters[kanda].keys()):
            text = chapters[kanda][sarga]
            
            if not text.strip():
                print(f"   ⚠️  Skipping Sarga {sarga:03d} (empty)")
                continue
            
            # Create text filename
            txt_filename = f"Sarga_{sarga:03d}.txt"
            txt_path = kanda_folder / txt_filename
            
            total_chapters += 1
            
            # Save text file
            print(f"   📄 Saving {txt_filename} ({len(text):,} chars)...", end=" ")
            if save_sarga_text(kanda, sarga, text, txt_path):
                successful_saves += 1
                print("✅")
            else:
                print("❌")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total chapters processed: {total_chapters}")
    print(f"Successful text files created: {successful_saves}")
    print(f"Failed saves: {total_chapters - successful_saves}")
    print(f"\n✅ Output directory: {output_base}")
    print("\n💡 Tip: You can convert text files to PDF later if needed using:")
    print("   - macOS: Use 'textutil' or print to PDF")
    print("   - Linux: Use 'enscript' or 'pandoc'")
    print("   - Python: Use 'reportlab' or 'fpdf' libraries")
    print("=" * 80)

if __name__ == "__main__":
    main()
