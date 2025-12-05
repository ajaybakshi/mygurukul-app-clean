#!/usr/bin/env node

/**
 * Sync Chapter Manifests Script
 * 
 * Scans Gurukul_Library for chapter manifest JSON files and copies them
 * to public/data/chapter-manifests/ with normalized names.
 * 
 * Usage: node scripts/sync-manifests.js
 */

const fs = require('fs');
const path = require('path');

const GURUKUL_LIBRARY = path.join(process.cwd(), 'Gurukul_Library');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data', 'chapter-manifests');

// Mapping of scripture IDs to normalized names (matches libraryService.ts logic)
const ID_NORMALIZATION_MAP = {
  'Arthasastra': 'arthashastra',
  'arthashastra': 'arthashastra',
  'Arthashastra': 'arthashastra',
  'bhagvad_gita': 'bhagvad_gita',
  'Bhagvad_Gita': 'bhagvad_gita',
  'bhagavad_gita': 'bhagvad_gita',
  'Bhagavad_Gita': 'bhagvad_gita',
  'VedangaSastra_Jyotisa': 'VedangaSastra_Jyotisa',
  'vedangasastra_jyotisa': 'VedangaSastra_Jyotisa',
  'vedanga_jyotisa': 'VedangaSastra_Jyotisa',
  'Vastu_Sastra': 'Vastu_Sastra',
  'vastu_sastra': 'Vastu_Sastra',
  'vastu_shastra': 'Vastu_Sastra',
  'Bhagvata_Purana': 'Bhagvata_Purana',
  'bhagvata_purana': 'Bhagvata_Purana',
  'Bhagavata_Purana': 'Bhagvata_Purana',
  'ramayana_valmiki': 'ramayana_valmiki',
  'Ramayana_Valmiki': 'ramayana_valmiki',
  'ramayana': 'ramayana_valmiki',
};

/**
 * Normalizes scripture ID to match manifest file naming convention
 */
function normalizeScriptureId(scriptureId) {
  return ID_NORMALIZATION_MAP[scriptureId] || scriptureId.toLowerCase();
}

/**
 * Recursively finds all JSON manifest files in a directory
 */
function findManifestFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findManifestFiles(filePath, fileList);
    } else if (stat.isFile() && file.endsWith('.json')) {
      // Check if it's a manifest file
      const lowerName = file.toLowerCase();
      if (lowerName.includes('manifest') || lowerName.includes('_chapter_manifest')) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

/**
 * Extracts scripture ID from manifest file path or filename
 */
function extractScriptureId(filePath) {
  const filename = path.basename(filePath, '.json');
  
  // Try to extract from patterns like: "caraka_samhita_chapter_manifest" or "caraka_samhita_manifest"
  let scriptureId = filename
    .replace(/_chapter_manifest$/i, '')
    .replace(/_manifest$/i, '')
    .replace(/manifest$/i, '');
  
  // If filename contains underscores, try to extract the scripture name
  // e.g., "caraka_samhita_chapter_manifest" -> "caraka_samhita"
  if (scriptureId.includes('_')) {
    // Take the part before the last meaningful segment
    const parts = scriptureId.split('_');
    if (parts.length > 1) {
      scriptureId = parts.slice(0, -1).join('_');
    }
  }
  
  return scriptureId;
}

/**
 * Main sync function
 */
function syncManifests() {
  console.log('🔄 Starting chapter manifest sync...\n');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created output directory: ${OUTPUT_DIR}\n`);
  }
  
  // Check if Gurukul_Library exists
  if (!fs.existsSync(GURUKUL_LIBRARY)) {
    console.log(`⚠️  Warning: Gurukul_Library directory not found at ${GURUKUL_LIBRARY}`);
    console.log('   The script will create the output directory, but no manifests will be synced.\n');
    return;
  }
  
  // Find all manifest files
  console.log(`📂 Scanning ${GURUKUL_LIBRARY} for manifest files...\n`);
  const manifestFiles = findManifestFiles(GURUKUL_LIBRARY);
  
  if (manifestFiles.length === 0) {
    console.log('ℹ️  No manifest files found in Gurukul_Library.');
    console.log('   Manifest files should be named like:');
    console.log('   - "*_chapter_manifest.json"');
    console.log('   - "*manifest.json"\n');
    return;
  }
  
  console.log(`📋 Found ${manifestFiles.length} manifest file(s):\n`);
  
  let syncedCount = 0;
  let skippedCount = 0;
  
  manifestFiles.forEach(filePath => {
    try {
      // Extract scripture ID from filename
      const scriptureId = extractScriptureId(filePath);
      const normalizedId = normalizeScriptureId(scriptureId);
      
      // Create output filename: [scripture_id].json
      const outputFilename = `${normalizedId}.json`;
      const outputPath = path.join(OUTPUT_DIR, outputFilename);
      
      // Read and validate JSON
      const content = fs.readFileSync(filePath, 'utf-8');
      const manifest = JSON.parse(content);
      
      // Basic validation - check if it looks like a chapter manifest
      if (!manifest.sections && !manifest.totalChapters) {
        console.log(`⚠️  Skipping ${path.basename(filePath)} - doesn't appear to be a chapter manifest`);
        skippedCount++;
        return;
      }
      
      // Write to output directory
      fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
      
      console.log(`✅ Synced: ${path.basename(filePath)}`);
      console.log(`   → ${outputFilename}`);
      console.log(`   (${manifest.totalChapters || 0} chapters, ${manifest.sections?.length || 0} sections)\n`);
      
      syncedCount++;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      skippedCount++;
    }
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Sync complete!`);
  console.log(`   Synced: ${syncedCount} file(s)`);
  console.log(`   Skipped: ${skippedCount} file(s)`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);
}

// Run the sync
syncManifests();

