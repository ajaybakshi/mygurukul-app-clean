import type { Metadata } from 'next';
import { seoConfig } from '@/lib/seoConfig';
import type { ChapterManifest, Scripture } from '@/types/library';

const MANIFEST_URL = 'https://storage.googleapis.com/mygurukul-sacred-texts-corpus/Gurukul_Library/library_manifest.json';
const MANIFEST_BASE_URL = 'https://storage.googleapis.com/mygurukul-sacred-texts-corpus/Metadata';

/**
 * Server-side helper to fetch a single scripture by ID from the library manifest
 */
async function fetchScriptureById(scriptureId: string): Promise<Scripture | null> {
  try {
    const response = await fetch(MANIFEST_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    
    if (!response.ok) {
      return null;
    }
    
    const scriptures: Scripture[] = await response.json();
    const scripture = scriptures.find(s => s.id === scriptureId || s.id.toLowerCase() === scriptureId.toLowerCase());
    
    return scripture || null;
  } catch (error) {
    console.error(`[Metadata] Error fetching scripture for ${scriptureId}:`, error);
    return null;
  }
}

/**
 * Server-side helper to normalize scripture ID for chapter manifest
 */
function normalizeScriptureIdForManifest(scriptureId: string): string {
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
  
  return idMap[scriptureId] || scriptureId.toLowerCase();
}

/**
 * Server-side helper to fetch chapter manifest for metadata generation
 */
async function fetchChapterManifestForMetadata(scriptureId: string): Promise<ChapterManifest | null> {
  const normalizedId = normalizeScriptureIdForManifest(scriptureId);
  const manifestUrl = `${MANIFEST_BASE_URL}/${normalizedId}_chapter_manifest.json`;
  
  try {
    const response = await fetch(manifestUrl, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[Metadata] Error fetching chapter manifest for ${scriptureId}:`, error);
    return null;
  }
}

/**
 * Truncate description to 150 characters for SEO
 */
function truncateDescription(text: string, maxLength: number = 150): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Generate metadata for the scripture chapter browser page
 * Handles both:
 * - Case A: Full Text books (Metadata = Book Title + Description)
 * - Case B: Chapter-based books (Metadata = Book Title + Chapter Info)
 */
export async function generateMetadata({
  params,
}: {
  params: { scriptureId: string };
}): Promise<Metadata> {
  const scriptureId = params.scriptureId;
  
  // Fetch both scripture info and chapter manifest in parallel
  const [scripture, chapterManifest] = await Promise.all([
    fetchScriptureById(scriptureId),
    fetchChapterManifestForMetadata(scriptureId),
  ]);
  
  // Default fallback metadata
  const defaultTitle = 'Sacred Text | MyGurukul';
  const defaultDescription = 'Explore ancient Sanskrit texts with AI-enhanced insights and translations.';
  
  // Case A: Full Text Book (no chapter manifest)
  if (scripture && !chapterManifest) {
    const title = `${scripture.title} | MyGurukul`;
    const description = truncateDescription(scripture.description || `Read ${scripture.title}, an ancient ${scripture.category} text.`);
    
    return {
      title,
      description,
      keywords: [
        scripture.title,
        scripture.category,
        'Sanskrit text',
        'ancient wisdom',
        ...seoConfig.keywords,
      ],
      openGraph: {
        title,
        description,
        url: `${seoConfig.url}/library/${scriptureId}`,
        siteName: 'MyGurukul',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
      alternates: {
        canonical: `${seoConfig.url}/library/${scriptureId}`,
      },
    };
  }
  
  // Case B: Chapter-based Book (has chapter manifest)
  if (chapterManifest) {
    const bookTitle = scripture?.title || chapterManifest.scriptureName;
    const title = `${bookTitle} - Chapters & Sections | MyGurukul`;
    
    // Build description from available data
    let description = '';
    if (scripture?.description) {
      description = truncateDescription(scripture.description);
    } else {
      description = `Explore ${chapterManifest.totalChapters} chapters across ${chapterManifest.sections.length} sections of ${bookTitle}. Access original Sanskrit texts, translations, and AI-powered insights.`;
    }
    
    return {
      title,
      description,
      keywords: [
        bookTitle,
        'Sanskrit text',
        'ancient wisdom',
        'chapter browser',
        'sacred texts',
        scripture?.category || '',
        ...seoConfig.keywords.filter(k => k),
      ],
      openGraph: {
        title,
        description,
        url: `${seoConfig.url}/library/${scriptureId}`,
        siteName: 'MyGurukul',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
      alternates: {
        canonical: `${seoConfig.url}/library/${scriptureId}`,
      },
    };
  }
  
  // Fallback: Neither scripture nor manifest found
  return {
    title: defaultTitle,
    description: defaultDescription,
    openGraph: {
      title: defaultTitle,
      description: defaultDescription,
      url: `${seoConfig.url}/library/${scriptureId}`,
      siteName: 'MyGurukul',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: defaultDescription,
    },
    alternates: {
      canonical: `${seoConfig.url}/library/${scriptureId}`,
    },
  };
}

/**
 * Layout component - just passes through children
 * Metadata is handled by generateMetadata above
 */
export default function ScriptureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

