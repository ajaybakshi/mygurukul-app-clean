#!/usr/bin/env python3
"""
Ramayana English PDF Chapterization Script

This script processes the English Ramayana PDF and:
1. Extracts text to identify sarga boundaries
2. Extracts page ranges for each sarga
3. Creates PDF files for each sarga organized by kanda

Requirements:
    pip install pdfplumber PyPDF2 reportlab

Usage:
    python3 scripts/chapterize_ramayana_english.py
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Optional

# Check dependencies
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    from PyPDF2 import PdfReader, PdfWriter
    PYPDF2_AVAILABLE = True
except ImportError:
    try:
        # Try newer pypdf library (PyPDF2 was renamed)
        from pypdf import PdfReader, PdfWriter
        PYPDF2_AVAILABLE = True
    except ImportError:
        PYPDF2_AVAILABLE = False

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

# ============================================================================
# CONFIGURATION
# ============================================================================

# Path to the English Ramayana PDF
RAMAYANA_PDF_FILE = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Epics/Ramayana/Ramayana_of_Valmiki_by_Hari_Prasad_Shastri-English.pdf"

# Output directory
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
# DEPENDENCY CHECK
# ============================================================================

def check_dependencies():
    """Check if required dependencies are available."""
    missing = []
    import sys
    
    if not PDFPLUMBER_AVAILABLE:
        missing.append("pdfplumber")
    if not PYPDF2_AVAILABLE:
        missing.append("PyPDF2 or pypdf")
    
    if missing:
        print("=" * 80)
        print("ERROR: Missing required dependencies")
        print("=" * 80)
        print(f"Python executable: {sys.executable}")
        print(f"Python version: {sys.version.split()[0]}")
        print(f"\nMissing packages: {', '.join(missing)}")
        print("\nTo fix this, install the packages in your current environment:")
        print(f"    pip install {' '.join(['pdfplumber', 'PyPDF2'])}")
        print("\nIf you're using a virtual environment (guru_env):")
        print("    Make sure it's activated, then run:")
        print("    pip install pdfplumber PyPDF2")
        print("\nTo check which Python you're using:")
        print("    which python")
        print("    python --version")
        print("=" * 80)
        
        # Try to provide more helpful error messages
        print("\nTroubleshooting:")
        print("1. If using venv, make sure it's activated:")
        print("   source guru_env/bin/activate")
        print("2. Then install packages:")
        print("   pip install pdfplumber PyPDF2")
        print("3. Verify installation:")
        print("   python -c 'import pdfplumber; from PyPDF2 import PdfReader; print(\"OK\")'")
        print("=" * 80)
        return False
    return True

# ============================================================================
# PDF TEXT EXTRACTION AND PARSING
# ============================================================================

def extract_text_from_pdf(pdf_path: str) -> Tuple[List[str], int]:
    """
    Extract text from all pages of the PDF.
    
    Returns:
        Tuple of (list of page texts, total pages)
    """
    print(f"📖 Extracting text from PDF: {pdf_path}")
    
    page_texts = []
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        print(f"   Total pages: {total_pages}")
        
        for page_num, page in enumerate(pdf.pages, 1):
            if page_num % 100 == 0:
                print(f"   Processing page {page_num}/{total_pages}...", end='\r')
            text = page.extract_text() or ""
            page_texts.append(text)
        
        print(f"\n✅ Extracted text from {total_pages} pages")
    
    return page_texts, total_pages

def find_sarga_boundaries(page_texts: List[str]) -> Dict[int, Dict[int, Tuple[int, int]]]:
    """
    Find sarga boundaries by looking for sarga markers in the text.
    
    Returns:
        Dict structure: {kanda: {sarga: (start_page, end_page)}}
    """
    print("\n🔍 Searching for sarga boundaries...")
    print("   Analyzing page content to find chapter markers...")
    
    # More flexible patterns for English PDFs
    # Look for various formats: "Sarga 1", "Chapter 1", "Canto 1 Sarga 1", etc.
    sarga_patterns = [
        # "Sarga 1" or "Sarga I" (Roman numerals)
        re.compile(r'\b(?:Sarga|sarga|SARGA|Chapter|chapter|CHAPTER)\s+([IVX\d]+)', re.IGNORECASE),
        # "Canto 1, Sarga 1" format
        re.compile(r'Canto\s+(\d+)[,\s]+(?:Sarga|sarga)\s+(\d+)', re.IGNORECASE),
        # "Book 1, Chapter 1" format
        re.compile(r'(?:Book|Kanda)\s+(\d+)[,\s]+(?:Chapter|Sarga)\s+(\d+)', re.IGNORECASE),
    ]
    
    # Kanda name patterns (more flexible)
    kanda_keywords = {
        1: ['bala', 'childhood'],
        2: ['ayodhya'],
        3: ['aranya', 'forest'],
        4: ['kishkindha', 'kishkindha'],
        5: ['sundara', 'beautiful'],
        6: ['yuddha', 'war', 'battle'],
        7: ['uttara', 'later', 'uttar']
    }
    
    chapters = defaultdict(lambda: defaultdict(list))  # {kanda: {sarga: [page_numbers]}}
    
    current_kanda = None
    current_sarga = None
    last_sarga_page = None
    
    # Roman numeral to integer mapping
    roman_to_int = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7,
                    'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7}
    
    for page_num, text in enumerate(page_texts, 1):
        if not text:
            continue
        
        text_lower = text.lower()
        
        # Check for kanda markers by keyword
        for kanda_num, keywords in kanda_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                if current_kanda != kanda_num:
                    current_kanda = kanda_num
                    print(f"   Found Kanda {kanda_num} at page {page_num}")
                break
        
        # Check for sarga markers
        for pattern in sarga_patterns:
            matches = pattern.findall(text)
            if matches:
                for match in matches:
                    if isinstance(match, tuple) and len(match) == 2:
                        # Format: "Canto X, Sarga Y" or "Book X, Chapter Y"
                        try:
                            kanda_candidate = int(match[0])
                            sarga_num = int(match[1])
                            if 1 <= kanda_candidate <= 7:
                                current_kanda = kanda_candidate
                                current_sarga = sarga_num
                                chapters[current_kanda][current_sarga].append(page_num)
                                last_sarga_page = page_num
                                break
                        except:
                            pass
                    else:
                        # Single sarga number (could be Roman or Arabic)
                        try:
                            # Try as integer first
                            sarga_num = int(match)
                            if current_kanda and sarga_num > 0 and sarga_num <= 200:
                                current_sarga = sarga_num
                                chapters[current_kanda][current_sarga].append(page_num)
                                last_sarga_page = page_num
                                break
                        except ValueError:
                            # Try as Roman numeral
                            if match.upper() in roman_to_int:
                                sarga_num = roman_to_int[match.upper()]
                                if current_kanda and sarga_num > 0:
                                    current_sarga = sarga_num
                                    chapters[current_kanda][current_sarga].append(page_num)
                                    last_sarga_page = page_num
                                    break
        
        # If we have a current sarga, add this page to it (until next sarga starts)
        if current_kanda and current_sarga:
            if page_num not in chapters[current_kanda][current_sarga]:
                chapters[current_kanda][current_sarga].append(page_num)
    
    # Convert page lists to ranges
    sarga_ranges = defaultdict(lambda: defaultdict(tuple))
    for kanda in chapters:
        for sarga in chapters[kanda]:
            pages = sorted(chapters[kanda][sarga])
            if pages:
                sarga_ranges[kanda][sarga] = (min(pages), max(pages))
    
    print(f"\n✅ Found sargas in {len(sarga_ranges)} kandas")
    for kanda in sorted(sarga_ranges.keys()):
        sarga_count = len(sarga_ranges[kanda])
        print(f"   Kanda {kanda}: {sarga_count} sargas")
        # Show first few for verification
        for sarga in sorted(sarga_ranges[kanda].keys())[:3]:
            start, end = sarga_ranges[kanda][sarga]
            print(f"      Sarga {sarga}: pages {start}-{end}")
    
    return sarga_ranges

# ============================================================================
# PDF PAGE EXTRACTION
# ============================================================================

def extract_pages_to_pdf(
    source_pdf_path: str,
    start_page: int,
    end_page: int,
    output_path: Path
) -> bool:
    """
    Extract a range of pages from source PDF and save as new PDF.
    Pages are 0-indexed in PyPDF2.
    """
    try:
        reader = PdfReader(source_pdf_path)
        writer = PdfWriter()
        
        # Extract pages (convert from 1-indexed to 0-indexed)
        for page_num in range(start_page - 1, end_page):
            if page_num < len(reader.pages):
                writer.add_page(reader.pages[page_num])
        
        # Write output PDF
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        return True
    except Exception as e:
        print(f"❌ Error extracting pages {start_page}-{end_page}: {e}")
        return False

# ============================================================================
# MAIN PROCESSING
# ============================================================================

def main():
    """Main function to process Ramayana PDF and extract sarga PDFs."""
    print("=" * 80)
    print("RĀMĀYAṆA ENGLISH PDF CHAPTERIZATION SCRIPT")
    print("=" * 80)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Check if PDF exists
    if not os.path.exists(RAMAYANA_PDF_FILE):
        print(f"❌ Error: PDF file not found: {RAMAYANA_PDF_FILE}")
        return
    
    # Extract text from PDF
    page_texts, total_pages = extract_text_from_pdf(RAMAYANA_PDF_FILE)
    
    # Find sarga boundaries
    sarga_ranges = find_sarga_boundaries(page_texts)
    
    if not sarga_ranges:
        print("\n⚠️  Warning: Could not automatically detect sarga boundaries.")
        print("   The PDF may use different formatting.")
        print("   You may need to manually specify page ranges.")
        return
    
    # Create output directory structure
    output_base = Path(OUTPUT_DIR)
    output_base.mkdir(parents=True, exist_ok=True)
    
    total_chapters = 0
    successful_extractions = 0
    
    # Process each kanda
    for kanda in sorted(sarga_ranges.keys()):
        kanda_name = KANDA_NAMES.get(kanda, f"Kanda_{kanda}")
        kanda_folder = output_base / f"Kanda_{kanda}_{kanda_name}"
        kanda_folder.mkdir(exist_ok=True)
        
        print(f"\n📚 Processing {KANDA_NAMES_ENGLISH.get(kanda, f'Kanda {kanda}')}...")
        print(f"   Folder: {kanda_folder.name}")
        
        # Process each sarga in this kanda
        for sarga in sorted(sarga_ranges[kanda].keys()):
            start_page, end_page = sarga_ranges[kanda][sarga]
            
            # Create PDF filename
            pdf_filename = f"Sarga_{sarga:03d}.pdf"
            pdf_path = kanda_folder / pdf_filename
            
            total_chapters += 1
            
            # Extract pages to PDF
            print(f"   📄 Creating {pdf_filename} (pages {start_page}-{end_page})...", end=" ")
            if extract_pages_to_pdf(RAMAYANA_PDF_FILE, start_page, end_page, pdf_path):
                successful_extractions += 1
                print("✅")
            else:
                print("❌")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total chapters processed: {total_chapters}")
    print(f"Successful PDFs created: {successful_extractions}")
    print(f"Failed extractions: {total_chapters - successful_extractions}")
    print(f"\n✅ Output directory: {output_base}")
    print("=" * 80)

if __name__ == "__main__":
    main()

