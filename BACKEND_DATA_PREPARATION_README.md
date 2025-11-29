# Sacred Library v4.3 - Backend Data Preparation Guide

**Date:** October 16, 2025  
**Purpose:** Prepare Caraka Saṃhitā chapter-level data for Sacred Library frontend

---

## Overview

This guide walks you through preparing the backend data structure for the new chapter-level discovery system. We'll use Caraka Saṃhitā as the first scripture to test the complete flow.

---

## Prerequisites

✅ **Chapter JSONs Generated**: All Caraka Saṃhitā chapter JSON files created using `create_library_metadata.py`  
✅ **PDFs Organized**: All chapter PDFs in section-based folder structure  
✅ **Python Environment**: `guru_env` with required packages  
✅ **GCS Access**: Permissions to upload to `mygurukul-library` bucket

---

## Current Folder Structure (Local)

Your current Caraka Saṃhitā folder should look like this:

```
/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Charaka_samhita_english/
├── Section_1_Sutrasthanam/
│   ├── Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.pdf
│   ├── Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.json
│   ├── Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_2.pdf
│   ├── Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_2.json
│   └── ... (30 chapters)
│
├── Section_2_Nidanasthanam/
│   ├── Charaka_samhita_english_Section_2_Nidanasthanam_Chapter_1.pdf
│   ├── Charaka_samhita_english_Section_2_Nidanasthanam_Chapter_1.json
│   └── ... (8 chapters)
│
├── Section_3_Vimānasthanam/
├── Section_4_Śārīrasthanam/
├── Section_5_Indriyasthanam/
├── Section_6_Cikitsāsthanam/
├── Section_7_Kalpasthanam/
└── Section_8_Siddhisthanam/
```

---

## Step 1: Generate Chapter Manifest

### 1.1 Update Configuration

Edit `generate_chapter_manifest.py`:

```python
# Line 9 - Update this path to match your local structure
SCRIPTURE_ROOT = "/Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Charaka_samhita_english"
```

### 1.2 Run the Script

```bash
cd /Users/AJ/Desktop/mygurukul-app
python generate_chapter_manifest.py
```

### 1.3 Expected Output

```
╔════════════════════════════════════════════════════════════╗
║       MYGURUKUL CHAPTER MANIFEST GENERATOR v1.0            ║
╚════════════════════════════════════════════════════════════╝

================================================================================
CHAPTER MANIFEST GENERATOR
================================================================================
Scripture: Caraka Saṃhitā
Root Directory: /Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Charaka_samhita_english
================================================================================

🔎 Scanning for section folders...
✅ Found 8 section folder(s)

📂 Processing: Section_1_Sutrasthanam
   Found 30 PDF file(s)
   ✅ Processed 30 chapter(s)

📂 Processing: Section_2_Nidanasthanam
   Found 8 PDF file(s)
   ✅ Processed 8 chapter(s)

[... continues for all 8 sections ...]

================================================================================
VALIDATING MANIFEST
================================================================================
✅ Scripture ID: caraka_samhita
✅ Scripture Name: Caraka Saṃhitā
✅ Total Chapters: 120
✅ Total Sections: 8

   Section 1: Sutrasthanam
      Chapters: 30

[... continues for all sections ...]

✅ Chapters with JSON metadata: 120
✅ Manifest validation passed!

================================================================================
SUCCESS!
================================================================================
✅ Generated: caraka_samhita_chapter_manifest.json
📊 Total Chapters: 120
📚 Total Sections: 8
================================================================================
```

### 1.4 Verify Generated File

Open `caraka_samhita_chapter_manifest.json` and verify:

```json
{
  "scriptureId": "caraka_samhita",
  "scriptureName": "Caraka Saṃhitā",
  "totalChapters": 120,
  "lastUpdated": "2025-10-16T12:25:00Z",
  "sections": [
    {
      "sectionId": "1",
      "sectionName": "Sutrasthanam",
      "sectionNameEnglish": "Foundational Principles",
      "chapterCount": 30,
      "chapters": [
        {
          "chapterId": "1",
          "chapterNumber": 1,
          "title": "Chapter 1",
          "titleEnglish": "",
          "metadataUrl": "gs://mygurukul-library/metadata/chapters/caraka_samhita/Section_1_Sutrasthanam/Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.json",
          "pdfUrl": "gs://mygurukul-library/pdfs/caraka_samhita/Section_1_Sutrasthanam/Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.pdf",
          "hasMetadata": true
        }
      ]
    }
  ]
}
```

---

## Step 2: Organize Files for GCS Upload

### 2.1 Create Local Upload Staging Directory

```bash
mkdir -p ~/Desktop/gcs_upload_staging/caraka_samhita
cd ~/Desktop/gcs_upload_staging/caraka_samhita
```

### 2.2 Copy Chapter Manifest

```bash
cp /Users/AJ/Desktop/mygurukul-app/caraka_samhita_chapter_manifest.json ~/Desktop/gcs_upload_staging/
```

### 2.3 Organize Chapter Metadata (JSONs)

Create the metadata folder structure:

```bash
mkdir -p ~/Desktop/gcs_upload_staging/metadata/chapters/caraka_samhita
```

Copy all chapter JSONs maintaining section structure:

```bash
# From your Charaka folder, copy each section's JSONs
cd /Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Charaka_samhita_english

# Copy Section 1
mkdir -p ~/Desktop/gcs_upload_staging/metadata/chapters/caraka_samhita/Section_1_Sutrasthanam
cp Section_1_Sutrasthanam/*.json ~/Desktop/gcs_upload_staging/metadata/chapters/caraka_samhita/Section_1_Sutrasthanam/

# Copy Section 2
mkdir -p ~/Desktop/gcs_upload_staging/metadata/chapters/caraka_samhita/Section_2_Nidanasthanam
cp Section_2_Nidanasthanam/*.json ~/Desktop/gcs_upload_staging/metadata/chapters/caraka_samhita/Section_2_Nidanasthanam/

# Repeat for all 8 sections...
```

Or use a loop:

```bash
for section in Section_*; do
  mkdir -p ~/Desktop/gcs_upload_staging/metadata/chapters/caraka_samhita/$section
  cp $section/*.json ~/Desktop/gcs_upload_staging/metadata/chapters/caraka_samhita/$section/
done
```

### 2.4 Organize PDFs

Create the PDF folder structure:

```bash
mkdir -p ~/Desktop/gcs_upload_staging/pdfs/caraka_samhita
```

Copy all PDFs:

```bash
cd /Users/AJ/Desktop/mygurukul-app/Gurukul_Library/Primary_Texts/Ayurveda/Charaka_samhita_english

for section in Section_*; do
  mkdir -p ~/Desktop/gcs_upload_staging/pdfs/caraka_samhita/$section
  cp $section/*.pdf ~/Desktop/gcs_upload_staging/pdfs/caraka_samhita/$section/
done
```

### 2.5 Verify Staging Directory

Your staging directory should look like:

```
~/Desktop/gcs_upload_staging/
├── caraka_samhita_chapter_manifest.json
│
├── metadata/
│   └── chapters/
│       └── caraka_samhita/
│           ├── Section_1_Sutrasthanam/
│           │   ├── Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.json
│           │   ├── Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_2.json
│           │   └── ... (30 JSONs)
│           ├── Section_2_Nidanasthanam/
│           │   └── ... (8 JSONs)
│           └── ... (8 sections total)
│
└── pdfs/
    └── caraka_samhita/
        ├── Section_1_Sutrasthanam/
        │   ├── Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.pdf
        │   └── ... (30 PDFs)
        └── ... (8 sections)
```

Verify file counts:

```bash
cd ~/Desktop/gcs_upload_staging

# Count chapter manifest (should be 1)
ls *.json | wc -l

# Count all metadata JSONs (should be 120)
find metadata -name "*.json" | wc -l

# Count all PDFs (should be 120)
find pdfs -name "*.pdf" | wc -l
```

---

## Step 3: Upload to Google Cloud Storage

### 3.1 Upload Chapter Manifest

**Destination**: `gs://mygurukul-library/metadata/`

**Manual Steps**:
1. Open Google Cloud Console → Storage → mygurukul-library bucket
2. Navigate to `metadata/` folder (create if doesn't exist)
3. Drag and drop `caraka_samhita_chapter_manifest.json`

### 3.2 Upload Chapter Metadata (JSONs)

**Destination**: `gs://mygurukul-library/metadata/chapters/`

**Manual Steps**:
1. Navigate to `metadata/` folder in GCS
2. Create `chapters/` subfolder if doesn't exist
3. Drag and drop entire `caraka_samhita/` folder from staging

This will upload:
```
gs://mygurukul-library/metadata/chapters/caraka_samhita/
├── Section_1_Sutrasthanam/
│   └── [all 30 JSONs]
├── Section_2_Nidanasthanam/
│   └── [all 8 JSONs]
└── ... [all 8 sections]
```

### 3.3 Upload PDFs

**Destination**: `gs://mygurukul-library/pdfs/`

**Manual Steps**:
1. Navigate to bucket root in GCS
2. Create `pdfs/` folder if doesn't exist
3. Drag and drop entire `caraka_samhita/` folder from staging

This will upload:
```
gs://mygurukul-library/pdfs/caraka_samhita/
├── Section_1_Sutrasthanam/
│   └── [all 30 PDFs]
└── ... [all 8 sections]
```

---

## Step 4: Verify GCS Permissions

### 4.1 Make Files Publicly Readable

As documented in ARCHITECTURE-v4.2.md, ensure:

1. **Remove Public Access Prevention**:
   - Bucket Settings → Edit → Public access → Remove prevention

2. **Add allUsers permission**:
   - Permissions → Add Principal → `allUsers`
   - Role: `Storage Object Viewer`

3. **Set CORS** (if not already done):

```bash
# Create cors.json file
cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Apply CORS
gsutil cors set cors.json gs://mygurukul-library
```

### 4.2 Test Access

Test that files are publicly accessible:

```bash
# Test chapter manifest
curl -I "https://storage.googleapis.com/mygurukul-library/metadata/caraka_samhita_chapter_manifest.json"

# Should return: HTTP/2 200

# Test a chapter JSON
curl -I "https://storage.googleapis.com/mygurukul-library/metadata/chapters/caraka_samhita/Section_1_Sutrasthanam/Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.json"

# Test a PDF
curl -I "https://storage.googleapis.com/mygurukul-library/pdfs/caraka_samhita/Section_1_Sutrasthanam/Charaka_samhita_english_Section_1_Sutrasthanam_Chapter_1.pdf"
```

All should return `200 OK`.

---

## Step 5: Final Verification Checklist

- [ ] `caraka_samhita_chapter_manifest.json` uploaded to `gs://mygurukul-library/metadata/`
- [ ] 120 chapter JSONs uploaded to `gs://mygurukul-library/metadata/chapters/caraka_samhita/`
- [ ] 120 chapter PDFs uploaded to `gs://mygurukul-library/pdfs/caraka_samhita/`
- [ ] All files publicly accessible (test with curl)
- [ ] CORS configured on bucket
- [ ] IAM permissions set correctly
- [ ] File counts verified:
  - 1 manifest JSON
  - 120 chapter JSONs (15 per section × 8 sections average)
  - 120 chapter PDFs

---

## Next Steps

Once backend data is ready:

1. **Update library_manifest.json** (if needed) to include chapter counts
2. **Begin Phase 2 frontend development**: Category browsing + scripture cards
3. **Test with Caraka data**: Verify all URLs resolve correctly
4. **Repeat process for Sushruta Saṃhitā** once its metadata generation completes

---

## Troubleshooting

### Issue: Script can't find section folders

**Solution**: Verify `SCRIPTURE_ROOT` path in `generate_chapter_manifest.py` is correct.

### Issue: Missing JSON files warning

**Solution**: Some chapters may not have generated JSONs yet. Script will note `"hasMetadata": false` for these. Frontend will handle gracefully.

### Issue: GCS upload fails

**Solution**: Check bucket permissions, verify you're logged into correct Google account.

### Issue: 403 Forbidden when accessing files

**Solution**: Re-check IAM permissions and public access settings.

---

## Support Files

- `generate_chapter_manifest.py` - Manifest generation script
- `SACRED_LIBRARY_v4.3_ARCHITECTURE.md` - Complete architecture documentation
- `create_library_metadata.py` - Chapter JSON generation (already used)

---

**End of Guide**

🙏 Built as seva for seekers worldwide 🙏
