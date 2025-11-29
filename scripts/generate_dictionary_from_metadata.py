#!/usr/bin/env python3
"""
Generate ayurveda_terms.json from chapter metadata
Extracts keyConcepts from all chapter JSON files

Usage:
  python scripts/generate_dictionary_from_metadata.py

Directory structure:
  Gurukul_Library/Primary_Texts/Ayurveda/
    ├── Caraka_Samhita/
    │   ├── Charaka_samhita_english_Section_1_Sutrasthana/
    │   │   ├── Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.json
    │   │   └── ...
    │   └── ...
    └── Sushruta_Samhita/
        └── ...
"""

import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict

# ====== CONFIGURATION - UPDATE THESE PATHS ======

# Base directory for your Gurukul Library
LIBRARY_BASE = Path("/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda")

# Scriptures to process
SCRIPTURES = [
    "Caraka_Samhita",
    "Sushruta_Samhita"
]

# Output paths
CURRENT_DICT_PATH = Path("/Users/AJ/Desktop/mygurukul-app/src/lib/data/ayurveda_terms.json")
OUTPUT_PATH = Path("/Users/AJ/Desktop/mygurukul-app/src/lib/data/ayurveda_terms_auto.json")

# ================================================

def normalize_diacritics(text: str) -> str:
    """Remove diacritical marks from text (āṃḥṛṇṭḍśṣ → amhrntsds)"""
    nfd = unicodedata.normalize('NFD', text)
    without_diacritics = ''.join(
        char for char in nfd 
        if unicodedata.category(char) != 'Mn'
    )
    return without_diacritics

def extract_english_terms(text: str) -> List[str]:
    """
    Extract English words from definition text
    Filters out common stop words
    """
    text_cleaned = normalize_diacritics(text).lower()
    
    # Extract words (alphanumeric + hyphen)
    words = re.findall(r'\b[a-z][a-z-]{2,}\b', text_cleaned)
    
    # Filter out common stop words
    stop_words = {
        'the', 'and', 'that', 'which', 'this', 'from', 'with', 'for',
        'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
        'refers', 'literally', 'also', 'known', 'called', 'means',
        'described', 'defined', 'indicates'
    }
    
    meaningful_words = [w for w in words if w not in stop_words and len(w) > 3]
    
    return meaningful_words

def generate_variants(term: str, definition: str) -> List[str]:
    """
    Generate search variants for a term
    
    Example:
      term: "Vājīkaraṇa"
      definition: "science of aphrodisiacs..."
      
    Returns: ["vajikarana", "vaajeekarana", "aphrodisiac", "aphrodisiacs", ...]
    """
    variants = set()
    
    # Add normalized version (remove diacritics)
    normalized = normalize_diacritics(term).lower()
    variants.add(normalized)
    
    # Add common transliteration variations
    # ā → aa, ī → ee, ū → uu, ṛ → ri
    transliterations = [
        term.replace('ā', 'aa').replace('Ā', 'aa'),
        term.replace('ī', 'ee').replace('Ī', 'ee'),
        term.replace('ū', 'uu').replace('Ū', 'uu'),
        term.replace('ṛ', 'ri').replace('Ṛ', 'ri'),
    ]
    
    for trans in transliterations:
        variants.add(normalize_diacritics(trans).lower())
    
    # Extract English terms from definition (first 200 chars)
    english_terms = extract_english_terms(definition[:200])
    
    # Add most relevant English terms (up to 8)
    for english_term in english_terms[:8]:
        variants.add(english_term)
        # Add plural
        if not english_term.endswith('s'):
            variants.add(english_term + 's')
        # Add singular if it's plural
        if english_term.endswith('s') and len(english_term) > 4:
            variants.add(english_term[:-1])
    
    # Remove empty strings and sort by relevance
    filtered = [v for v in variants if v and len(v) > 2]
    
    return filtered

def categorize_term(term_name: str, definition: str) -> str:
    """Auto-categorize based on term patterns and definition"""
    term_lower = term_name.lower()
    def_lower = definition.lower()
    
    # Herb indicators
    if any(marker in def_lower for marker in ['herb', 'plant', 'root', 'leaf', 'botanical', 'flower', 'seed']):
        return 'herbs'
    
    # Treatment indicators
    if any(marker in def_lower for marker in ['treatment', 'therapy', 'procedure', 'science of', 'formulation', 'remedy']):
        return 'treatments'
    
    # Disease indicators
    if any(marker in def_lower for marker in ['disease', 'disorder', 'condition', 'ailment', 'affliction', 'illness']):
        return 'diseases'
    
    # Symptom indicators
    if any(marker in def_lower for marker in ['pain', 'ache', 'fever', 'cough', 'inflammation', 'swelling']):
        return 'symptoms'
    
    # Physiology indicators
    if any(marker in def_lower for marker in ['dosha', 'tissue', 'channel', 'bodily', 'vital', 'energy', 'body']):
        return 'physiology'
    
    return 'concepts'

def extract_related_concepts(all_concept_names: Set[str], definition: str) -> List[str]:
    """Find mentions of other concepts in this definition"""
    related = []
    
    for other_concept in all_concept_names:
        if other_concept in definition and len(other_concept) > 3:
            related.append(other_concept)
            if len(related) >= 5:
                break
    
    return related

def find_all_chapter_files() -> List[Path]:
    """
    Recursively find all chapter JSON files in the library structure
    """
    all_files = []
    
    for scripture in SCRIPTURES:
        scripture_path = LIBRARY_BASE / scripture
        
        if not scripture_path.exists():
            print(f"⚠️  Warning: {scripture_path} not found, skipping")
            continue
        
        # Find all JSON files recursively
        json_files = list(scripture_path.rglob("*.json"))
        all_files.extend(json_files)
        
        print(f"📖 {scripture}: found {len(json_files)} chapter files")
    
    return all_files

def process_chapter_file(filepath: Path, all_concept_names: Set[str]) -> List[Dict]:
    """Extract dictionary entries from a single chapter JSON file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # FIX: keyConcepts is at ROOT level, not under metadata
        key_concepts = data.get('keyConcepts', [])
        
        if not key_concepts:
            return []
        
        dictionary_entries = []
        
        for concept in key_concepts:
            term_name = concept.get('term', '')
            definition = concept.get('definition', '')
            
            if not term_name or not definition:
                continue
            
            # Generate entry
            entry = {
                "term": term_name,
                "category": categorize_term(term_name, definition),
                "variants": generate_variants(term_name, definition),
                "description": definition[:250],  # Truncate to 250 chars
                "relatedConcepts": extract_related_concepts(all_concept_names, definition),
                "doshaAssociations": []
            }
            
            dictionary_entries.append(entry)
        
        return dictionary_entries
        
    except Exception as e:
        print(f"⚠️  Error processing {filepath.name}: {e}")
        return []


def load_existing_dictionary() -> List[Dict]:
    """Load current manual dictionary"""
    try:
        with open(CURRENT_DICT_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('terms', [])
    except FileNotFoundError:
        print(f"ℹ️  No existing dictionary found at {CURRENT_DICT_PATH}")
        return []
    except Exception as e:
        print(f"⚠️  Error loading existing dictionary: {e}")
        return []

def merge_dictionaries(manual_terms: List[Dict], auto_terms: List[Dict]) -> List[Dict]:
    """
    Merge manual and auto-generated dictionaries
    Manual entries take precedence for conflicts
    """
    # Index manual terms by normalized name
    manual_index = {}
    for term in manual_terms:
        key = normalize_diacritics(term['term']).lower()
        manual_index[key] = term
    
    # Start with manual terms
    merged = list(manual_terms)
    
    # Add auto-generated terms that don't conflict
    added = 0
    for auto_term in auto_terms:
        key = normalize_diacritics(auto_term['term']).lower()
        
        if key not in manual_index:
            merged.append(auto_term)
            added += 1
        else:
            # Merge variants from auto into manual
            manual_entry = manual_index[key]
            auto_variants = set(auto_term.get('variants', []))
            manual_variants = set(manual_entry.get('variants', []))
            
            # Combine and deduplicate
            combined_variants = list(manual_variants | auto_variants)
            manual_entry['variants'] = combined_variants
    
    print(f"   → Added {added} new terms")
    print(f"   → Enhanced {len(manual_terms)} existing terms with new variants")
    
    return merged

def main():
    print("🔍 DICTIONARY GENERATION FROM METADATA\n")
    print(f"📂 Library base: {LIBRARY_BASE}\n")
    
    # Check if base directory exists
    if not LIBRARY_BASE.exists():
        print(f"❌ ERROR: Library directory not found: {LIBRARY_BASE}")
        print("\nPlease update LIBRARY_BASE path in the script")
        return
    
    # Find all chapter files
    print("📚 Scanning for chapter files...\n")
    chapter_files = find_all_chapter_files()
    
    if not chapter_files:
        print("❌ No chapter files found!")
        return
    
    print(f"\n✅ Total: {len(chapter_files)} chapter files found\n")
    
    # First pass: collect all concept names
    print("🔍 Pass 1: Collecting unique concepts...")
    all_concept_names = set()

    for filepath in chapter_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # FIX: keyConcepts at root level
                key_concepts = data.get('keyConcepts', [])
                for concept in key_concepts:
                    term_name = concept.get('term', '')
                    if term_name:
                        all_concept_names.add(term_name)
        except:
            pass

    
    print(f"✅ Found {len(all_concept_names)} unique concepts\n")
    
    # Second pass: extract dictionary entries
    print("📝 Pass 2: Extracting dictionary entries...")
    all_auto_entries = []
    
    for i, filepath in enumerate(chapter_files, 1):
        entries = process_chapter_file(filepath, all_concept_names)
        all_auto_entries.extend(entries)
        
        if i % 20 == 0:
            print(f"   Processed {i}/{len(chapter_files)} files...")
    
    print(f"\n✅ Extracted {len(all_auto_entries)} dictionary entries\n")
    
    # Deduplicate auto entries
    seen_terms = {}
    unique_auto_entries = []
    
    for entry in all_auto_entries:
        key = normalize_diacritics(entry['term']).lower()
        if key not in seen_terms:
            seen_terms[key] = entry
            unique_auto_entries.append(entry)
    
    print(f"📊 After deduplication: {len(unique_auto_entries)} unique terms\n")
    
    # Load existing manual dictionary
    print("🔄 Loading existing manual dictionary...")
    manual_terms = load_existing_dictionary()
    print(f"✅ Found {len(manual_terms)} manually curated terms\n")
    
    # Merge
    print("🔗 Merging manual and auto-generated dictionaries...")
    merged_terms = merge_dictionaries(manual_terms, unique_auto_entries)
    
    print(f"\n✅ FINAL DICTIONARY: {len(merged_terms)} terms")
    print(f"   - Manual: {len(manual_terms)}")
    print(f"   - Auto-generated new: {len(merged_terms) - len(manual_terms)}")
    print(f"   - Total coverage increase: {((len(merged_terms) - len(manual_terms)) / max(len(manual_terms), 1)) * 100:.0f}%\n")
    
    # Write output
    output_data = {
        "terms": merged_terms,
        "metadata": {
            "generatedFrom": "chapter metadata keyConcepts",
            "generatedDate": "2025-10-25",
            "totalTerms": len(merged_terms),
            "manualTerms": len(manual_terms),
            "autoGeneratedTerms": len(unique_auto_entries),
            "sourceChapters": len(chapter_files),
            "scriptures": SCRIPTURES
        }
    }
    
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"💾 Wrote enriched dictionary to:\n   {OUTPUT_PATH}\n")
    print("🎉 SUCCESS!\n")
    print("📋 Next steps:")
    print(f"   1. Review: {OUTPUT_PATH}")
    print("   2. Test search for 'aphrodisiacs', 'vajikarana'")
    print(f"   3. If satisfied: cp {OUTPUT_PATH} {CURRENT_DICT_PATH}")
    print("   4. Restart dev server and test\n")

if __name__ == "__main__":
    main()
