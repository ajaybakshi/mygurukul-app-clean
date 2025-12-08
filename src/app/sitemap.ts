import { MetadataRoute } from 'next';
import type { Scripture } from '@/types/library';
import { seoConfig } from '@/lib/seoConfig';

const MANIFEST_URL = 'https://storage.googleapis.com/mygurukul-sacred-texts-corpus/Gurukul_Library/library_manifest.json';

/**
 * Server-side helper to fetch all scriptures from the library manifest
 */
async function fetchAllScriptures(): Promise<Scripture[]> {
  try {
    const response = await fetch(MANIFEST_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    
    if (!response.ok) {
      console.error('[Sitemap] Failed to fetch library manifest:', response.status);
      return [];
    }
    
    const scriptures: Scripture[] = await response.json();
    return scriptures;
  } catch (error) {
    console.error('[Sitemap] Error fetching library manifest:', error);
    return [];
  }
}

/**
 * Generate dynamic sitemap for MyGurukul
 * Includes static routes and all dynamic book routes
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = seoConfig.url;
  const currentDate = new Date().toISOString();
  
  // Fetch all scriptures for dynamic routes
  const scriptures = await fetchAllScriptures();
  
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/?tab=ask`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/library`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];
  
  // Dynamic book routes - map over all scriptures
  const dynamicRoutes: MetadataRoute.Sitemap = scriptures.map((scripture) => ({
    url: `${baseUrl}/library/${scripture.id}`,
    lastModified: currentDate,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));
  
  // Combine static and dynamic routes
  return [...staticRoutes, ...dynamicRoutes];
}

