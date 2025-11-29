#!/usr/bin/env python3
"""Quick diagnostic script to check PDF dependencies"""

import sys

print("=" * 60)
print("PDF DEPENDENCY CHECKER")
print("=" * 60)
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
print(f"Python path (first 3): {sys.path[:3]}")
print("=" * 60)

# Check pdfplumber
print("\n1. Checking pdfplumber...")
try:
    import pdfplumber
    print(f"   ✅ pdfplumber version: {pdfplumber.__version__}")
    PDFPLUMBER_OK = True
except ImportError as e:
    print(f"   ❌ pdfplumber not found: {e}")
    PDFPLUMBER_OK = False
except Exception as e:
    print(f"   ⚠️  pdfplumber error: {e}")
    PDFPLUMBER_OK = False

# Check PyPDF2
print("\n2. Checking PyPDF2...")
try:
    from PyPDF2 import PdfReader, PdfWriter
    print(f"   ✅ PyPDF2 available")
    PYPDF2_OK = True
except ImportError as e:
    print(f"   ❌ PyPDF2 not found: {e}")
    PYPDF2_OK = False
    # Try pypdf (newer name)
    try:
        from pypdf import PdfReader, PdfWriter
        print(f"   ✅ pypdf available (newer version)")
        PYPDF2_OK = True
    except ImportError as e2:
        print(f"   ❌ pypdf also not found: {e2}")
except Exception as e:
    print(f"   ⚠️  PyPDF2 error: {e}")
    PYPDF2_OK = False

# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
if PDFPLUMBER_OK and PYPDF2_OK:
    print("✅ All dependencies are available!")
    print("   The script should work correctly.")
else:
    print("❌ Missing dependencies detected.")
    print("\nTo install missing packages:")
    if not PDFPLUMBER_OK:
        print("   pip install pdfplumber")
    if not PYPDF2_OK:
        print("   pip install PyPDF2")
    print("\nOr install both:")
    print("   pip install pdfplumber PyPDF2")
print("=" * 60)



