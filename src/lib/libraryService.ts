import type { Scripture, Category, ChapterManifest, Edition } from '@/types/library';

const MANIFEST_URL = 'https://storage.googleapis.com/mygurukul-sacred-texts-corpus/Gurukul_Library/library_manifest.json';

/**
 * Fetches the library manifest via Next.js API route (avoids CORS issues)
 * Returns empty array if fetch fails
 */
export async function fetchLibraryManifest(): Promise<Scripture[]> {
  try {
    console.log("Attempting to fetch manifest via API route");
    // Add cache-busting to ensure fresh manifest
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(`/api/library-manifest${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

    console.log("API response received. Status:", response.status, response.statusText);

    if (!response.ok) {
      console.error("API fetch failed: Response was not OK.");
      return [];
    }

    const data: Scripture[] = await response.json();
    console.log(`Successfully parsed manifest. Found ${data.length} scriptures.`);
    
    if (data.length > 0) {
      console.log("First scripture title:", data[0].title);
    }

    return data;
  } catch (error) {
    console.error("Critical error in fetchLibraryManifest:", error);
    return [];
  }
}

/**
 * Mock function that simulates checking for conversational texts
 * In production, this would query a database or service
 */
export async function getConversationalScriptureIds(): Promise<Set<string>> {
  return new Promise((resolve) => {
    resolve(new Set(['bhagavad_gita', 'caraka_samhita']));
  });
}

/**
 * Main function to fetch and organize the library data
 * Enriches scriptures with conversational status and groups by category
 */
export async function getOrganizedLibrary(): Promise<Category[]> {
  // Fetch data from both sources
  const [scriptures, conversationalIds] = await Promise.all([
    fetchLibraryManifest(),
    getConversationalScriptureIds()
  ]);

  console.log(`getOrganizedLibrary received ${scriptures.length} scriptures.`);

  // Enrich scriptures with isConversational status
  const enrichedScriptures = scriptures.map(scripture => ({
    ...scripture,
    isConversational: conversationalIds.has(scripture.id)
  }));

  // Group scriptures by category
  const categoryMap = new Map<string, Scripture[]>();
  
  enrichedScriptures.forEach(scripture => {
    const existing = categoryMap.get(scripture.category) || [];
    existing.push(scripture);
    categoryMap.set(scripture.category, existing);
  });

  // Convert map to Category array
  const categories: Category[] = Array.from(categoryMap.entries()).map(
    ([name, scriptures]) => ({
      name,
      scriptures
    })
  );

  return categories;
}

// ============================================================================
// CHAPTER MANIFEST FUNCTIONS (v4.3 - Added Oct 16, 2025)
// ============================================================================

const MANIFEST_BASE_URL = 'https://storage.googleapis.com/mygurukul-sacred-texts-corpus/Metadata';

/**
 * Normalizes scripture ID to match chapter manifest file naming convention
 * Handles variations like "Arthasastra" -> "arthashastra"
 */
function normalizeScriptureIdForManifest(scriptureId: string): string {
  // Map known variations to their manifest file names
  const idMap: Record<string, string> = {
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
  
  // Return mapped ID if exists, otherwise return lowercase version
  return idMap[scriptureId] || scriptureId.toLowerCase();
}

/**
 * Fetches chapter manifest for a specific scripture
 * First tries to load from public/data/chapter-manifests/ (synced from Gurukul_Library)
 * Falls back to GCS if not found locally
 * @param scriptureId - The unique ID of the scripture (e.g., "caraka_samhita" or "Arthasastra")
 * @returns ChapterManifest object or null if not found/error
 */
export async function fetchChapterManifest(
  scriptureId: string
): Promise<ChapterManifest | null> {
  try {
    // Normalize the ID to match manifest file naming
    const normalizedId = normalizeScriptureIdForManifest(scriptureId);
    
    console.log(`[Manifest Debug] Fetching manifest for scriptureId: "${scriptureId}" (normalized: "${normalizedId}")`);
    
    // First, try to load from public/data/chapter-manifests/ (synced from Gurukul_Library)
    const localManifestUrl = `/data/chapter-manifests/${normalizedId}.json`;
    
    console.log(`[Manifest Debug] Attempting local fetch from: ${localManifestUrl}`);
    
    try {
      const localResponse = await fetch(localManifestUrl, {
        cache: 'no-store',
      });
      
      console.log(`[Manifest Debug] Local fetch response - Success: ${localResponse.ok}, Status: ${localResponse.status}, Source: ${localManifestUrl}`);
      
      if (localResponse.ok) {
        const manifest: ChapterManifest = await localResponse.json();
        console.log(`[Manifest Debug] ✅ Successfully loaded from LOCAL public folder: ${localManifestUrl}`);
        console.log(`[LibraryService] Loaded manifest from public folder for "${scriptureId}" (normalized: "${normalizedId}"): ${manifest.totalChapters} chapters`);
        return manifest;
      } else {
        console.log(`[Manifest Debug] Local manifest not found (status ${localResponse.status}), trying GCS fallback...`);
      }
    } catch (localError) {
      console.log(`[Manifest Debug] Local fetch error: ${localError instanceof Error ? localError.message : String(localError)}, trying GCS fallback...`);
    }
    
    // Fallback to GCS
    const manifestUrl = `${MANIFEST_BASE_URL}/${normalizedId}_chapter_manifest.json`;
    
    // Add cache-busting timestamp to ensure fresh manifest
    const cacheBuster = `?t=${Date.now()}`;
    const urlWithCacheBuster = `${manifestUrl}${cacheBuster}`;
    
    console.log(`[Manifest Debug] Attempting GCS fetch from: ${urlWithCacheBuster}`);
    console.log(`[LibraryService] Fetching chapter manifest from GCS for "${scriptureId}" (normalized: "${normalizedId}"): ${urlWithCacheBuster}`);
    
    const response = await fetch(urlWithCacheBuster, {
      cache: 'no-store',
    });
    
    console.log(`[Manifest Debug] GCS fetch response - Success: ${response.ok}, Status: ${response.status}, Source: ${urlWithCacheBuster}`);
    
    if (!response.ok) {
      console.warn(`[Manifest Debug] ❌ GCS manifest not found - Status: ${response.status}, URL: ${urlWithCacheBuster}`);
      console.warn(`[LibraryService] Manifest not found for ${scriptureId} (normalized: ${normalizedId}): ${response.status}`);
      return null;
    }
    
    const manifest: ChapterManifest = await response.json();
    
    console.log(`[Manifest Debug] ✅ Successfully loaded from GCS: ${urlWithCacheBuster}`);
    console.log(`[LibraryService] Successfully loaded manifest from GCS for ${scriptureId}: ${manifest.totalChapters} chapters`);
    
    return manifest;
  } catch (error) {
    console.error(`[Manifest Debug] ❌ Error fetching chapter manifest for ${scriptureId}:`, error);
    console.error(`[LibraryService] Error fetching chapter manifest for ${scriptureId}:`, error);
    return null;
  }
}

/**
 * Checks if a scripture has a chapter manifest available (async - fetches manifest)
 * @param scriptureId - The unique ID of the scripture
 * @returns boolean indicating if manifest exists
 */
export async function hasChapterManifest(scriptureId: string): Promise<boolean> {
  const manifest = await fetchChapterManifest(scriptureId);
  return manifest !== null;
}

/**
 * Synchronously checks if a scripture has a chapter manifest based on known scripture IDs
 * This is used for sorting without needing to fetch manifests
 * @param scriptureId - The unique ID of the scripture
 * @returns boolean indicating if scripture has chapter manifest
 */
export function hasChapterManifestSync(scriptureId: string): boolean {
  // Check if this scripture has a chapter manifest (case-insensitive check)
  // This matches the logic in ScriptureCard.tsx
  const normalizedId = scriptureId.toLowerCase();
  return (
    normalizedId === 'caraka_samhita' ||
    normalizedId === 'sushruta_samhita' ||
    normalizedId === 'arthashastra' ||
    normalizedId === 'arthasastra' || // Handle library manifest variation
    scriptureId === 'Arthasastra' || // Handle exact library manifest ID
    normalizedId === 'kamasutra' ||
    normalizedId === 'natyashastra' ||
    normalizedId === 'manu_smriti' ||
    normalizedId === 'aryabhatia' ||
    normalizedId === 'yoga_sutra' ||
    normalizedId === 'panchatantra' ||
    normalizedId === 'bhagvad_gita' ||
    normalizedId === 'vedangasastra_jyotisa' ||
    scriptureId === 'VedangaSastra_Jyotisa' ||
    normalizedId === 'vastu_sastra' ||
    scriptureId === 'Vastu_Sastra' ||
    scriptureId === 'Bhagvata_Purana' ||
    normalizedId === 'ramayana_valmiki' ||
    scriptureId === 'ramayana_valmiki'
  );
}

/**
 * Finds an edition by language from a scripture's editions array
 * @param scripture - The scripture object
 * @param language - The language to search for ('English' or 'Sanskrit')
 * @returns The matching edition or null if not found
 */
export function findEditionByLanguage(scripture: Scripture, language: 'English' | 'Sanskrit'): Edition | null {
  // First, try exact Language field match
  let edition = scripture.editions.find(e => 
    e['Language'].toLowerCase() === language.toLowerCase()
  );
  
  // For Sanskrit, also check title contains "sanskrit" as fallback
  if (!edition && language === 'Sanskrit') {
    edition = scripture.editions.find(e => 
      e['Edition Title'].toLowerCase().includes('sanskrit')
    );
  }
  
  return edition || null;
}

/**
 * Gets all English PDF editions for a scripture
 * @param scripture - The scripture object
 * @returns Array of all English PDF editions
 */
export function getEnglishEditions(scripture: Scripture): Edition[] {
  return scripture.editions.filter(e => 
    e['Language'].toLowerCase() === 'english' && 
    e['Format'].toUpperCase() === 'PDF'
  );
}

/**
 * Checks if a scripture has multiple English volumes
 * @param scripture - The scripture object
 * @returns true if scripture has 2+ English PDF editions
 */
export function hasMultipleEnglishVolumes(scripture: Scripture): boolean {
  const englishPdfs = getEnglishEditions(scripture);
  return englishPdfs.length > 1;
}

/**
 * Converts GCS gs:// URLs to HTTPS URLs that browsers can open
 * Properly URL-encodes path components to handle spaces and special characters
 * @param gcsPath - GCS URL in gs:// format
 * @returns HTTPS URL for browser access
 */
export function convertGcsUrlToHttps(gcsPath: string): string {
  if (gcsPath.startsWith('gs://')) {
    // Remove gs:// prefix
    const path = gcsPath.substring(5); // Remove 'gs://'
    
    // Split into bucket and object path
    const firstSlash = path.indexOf('/');
    if (firstSlash === -1) {
      // No path, just bucket
      return `https://storage.googleapis.com/${path}`;
    }
    
    const bucket = path.substring(0, firstSlash);
    const objectPath = path.substring(firstSlash + 1);
    
    // URL-encode each path segment (but not the slashes)
    const encodedPath = objectPath
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    
    return `https://storage.googleapis.com/${bucket}/${encodedPath}`;
  }
  return gcsPath;
}
