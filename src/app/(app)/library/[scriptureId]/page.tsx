'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchChapterManifest } from '@/lib/libraryService';
import type { ChapterManifest, SectionMetadata, ChapterMetadata } from '@/types/library';
import ChapterInsightsModal from '@/components/library/ChapterInsightsModal';
import { expandQuery } from '@/lib/semanticSearch/queryExpansion';
import { runAllTests, testQueryExpansion } from '@/lib/semanticSearch/searchDiagnostics';

/**
 * Normalize text for search by removing diacritical marks
 * 
 * Converts: ā→a, ī→i, ū→u, ṛ→r, ṝ→r, ḷ→l, ḹ→l, ṅ→n, ñ→n, ṭ→t, ḍ→d, ṇ→n, ś→s, ṣ→s, ḥ→h, ṃ→m, ḻ→l
 * 
 * This allows "vajikarana" to match "Vājīkaraṇa"
 */
function normalizeDiacritics(text: string): string {
  return text
    .normalize('NFD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase();
}

/**
 * Safely convert any value to a renderable string
 * Prevents "Objects are not valid as a React child" errors
 */
function toSafeString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    // Handle malformed metadata - extract text from object wrappers
    if (value.advice) return String(value.advice);
    if (value.text) return String(value.text);
    if (value.content) return String(value.content);
    // Log warning for debugging
    console.warn('[toSafeString] Malformed metadata - converting object to string:', value);
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Converts GCS gs:// URLs to HTTPS URLs that browsers can open
 * Properly URL-encodes path components to handle spaces and special characters
 * @param gcsUrl - GCS URL in gs:// format
 * @returns HTTPS URL for browser access
 */
function convertGcsUrlToHttps(gcsUrl: string): string {
  if (gcsUrl.startsWith('gs://')) {
    // Remove gs:// prefix
    const path = gcsUrl.substring(5); // Remove 'gs://'
    
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
  return gcsUrl;
}

/**
 * Interface for chapters with search scores
 */
interface ChapterWithScore {
  chapter: ChapterMetadata;
  section: SectionMetadata;
  score: number;
  metadata: any;
}

/**
 * Calculate search relevance score for a chapter
 * Weighted scoring: Key concepts (10), Chapter# (8), Section (6), Summary (4), Definitions (3), Advice (2)
 */
function calculateSearchScore(
  chapter: ChapterMetadata,
  section: SectionMetadata,
  metadata: any,
  query: string,
  expansion: any = null
): number {
  if (!query.trim()) return 0;

  let score = 0;
  const normalizedQuery = normalizeDiacritics(query.trim());

  // 1. Key concept terms (10 points per match)
  // Note: keyConcepts come from metadata JSON, not from ChapterMetadata type
  const keyConcepts = metadata?.keyConcepts || [];
  
  if (keyConcepts.length > 0) {
    const termMatches = keyConcepts.filter((k: any) =>
      normalizeDiacritics(k.term || '').includes(normalizedQuery)
    ).length;
    score += termMatches * 10;
  }

  // 2. Exact chapter number match (8 points)
  if (
    chapter.chapterNumber.toString() === normalizedQuery ||
    `chapter ${chapter.chapterNumber}` === normalizedQuery ||
    `ch ${chapter.chapterNumber}` === normalizedQuery
  ) {
    score += 8;
  }

  // 3. Section name match (6 points)
  if (
    normalizeDiacritics(section.sectionName).includes(normalizedQuery) ||
    normalizeDiacritics(section.sectionNameEnglish).includes(normalizedQuery)
  ) {
    score += 6;
  }

  // 4. AI summary matches (4 points per occurrence)
  if (metadata?.aiSummary) {
    const summaryText = normalizeDiacritics(metadata.aiSummary);
    const matches = (summaryText.match(new RegExp(normalizedQuery, 'g')) || []).length;
    score += matches * 4;
  }

  // 5. Key concept definitions (3 points per match)
  if (keyConcepts.length > 0) {
    const defMatches = keyConcepts.filter((k: any) =>
      normalizeDiacritics(k.definition || '').includes(normalizedQuery)
    ).length;
    score += defMatches * 3;
  }

  // 6. Practical advice (2 points per match)
  if (metadata?.deeperInsights?.practicalAdvice) {
    const adviceMatches = metadata.deeperInsights.practicalAdvice.filter((a: any) => {
      // Handle both string format ["text"] and object format [{advice: "text"}]
      const adviceText = typeof a === 'string' ? a : (a?.advice || a?.text || '');
      return typeof adviceText === 'string' && normalizeDiacritics(adviceText).includes(normalizedQuery);
    }).length;
    score += adviceMatches * 2;
  }

  // === TOPIC CENTRALITY DETECTION ===
  // If the query matches MULTIPLE key concepts, this chapter is likely ABOUT that topic
  // Apply a strong multiplier (3x-5x) to reward dedicated chapters

  let centralityMultiplier = 1.0;

  if (keyConcepts.length > 0) {
    // Count how many key concepts match the query (term OR definition)
    const matchingConceptsCount = keyConcepts.filter((k: any) => {
      const termMatches = normalizeDiacritics(k.term || '').includes(normalizedQuery);
      const defMatches = normalizeDiacritics(k.definition || '').includes(normalizedQuery);
      return termMatches || defMatches;
    }).length;
    
    const totalConcepts = keyConcepts.length;
    const matchRatio = matchingConceptsCount / totalConcepts;
    
    // Apply graduated multipliers based on match density
    if (matchRatio >= 0.5) {
      // 50%+ of key concepts match = this chapter is ABOUT this topic
      centralityMultiplier = 5.0;
    } else if (matchRatio >= 0.33) {
      // 33-49% match = major topic but not exclusive
      centralityMultiplier = 3.5;
    } else if (matchRatio >= 0.25) {
      // 25-32% match = significant topic
      centralityMultiplier = 2.5;
    } else if (matchingConceptsCount >= 2) {
      // At least 2 concepts match (regardless of ratio) = notable mention
      centralityMultiplier = 1.5;
    }
  }

  // Apply the multiplier to the current score
  score = Math.round(score * centralityMultiplier);

  // NEW SEMANTIC BONUS RULES 7-8:
  // 7. Semantic term matches (12 points bonus per found term)
  let semanticMatchCount = 0;

  if (expansion?.expandedTerms) {
    for (const expandedTerm of expansion.expandedTerms) {
      const termLower = expandedTerm.toLowerCase();
      
      // Check against key concepts
      if (keyConcepts.length > 0) {
        const hasSemanticMatch = keyConcepts.some((k: any) => {
          const term = k.term?.toLowerCase() || '';
          const def = k.definition?.toLowerCase() || '';
          return term.includes(termLower) || def.includes(termLower);
        });
        if (hasSemanticMatch) {
          score += 12;
          semanticMatchCount++;
        }
      }
      
      // Check against AI summary
      if (metadata?.aiSummary) {
        const summaryLower = metadata.aiSummary.toLowerCase();
        if (summaryLower.includes(termLower)) {
          score += 8;
        }
      }
    }
    
    // BONUS: If multiple semantic matches found, apply additional centrality boost
    if (semanticMatchCount >= 3) {
      const semanticBonus = semanticMatchCount * 10;
      score += semanticBonus;
    }
  }
  
  // 8. Related concept matches (6 points bonus per related term)
  if (expansion?.relatedConcepts) {
    for (const related of expansion.relatedConcepts) {
      const relatedLower = related.toLowerCase();
      
      if (keyConcepts.length > 0) {
        const hasRelatedMatch = keyConcepts.some((k: any) => {
          const term = k.term?.toLowerCase() || '';
          const def = k.definition?.toLowerCase() || '';
          return term.includes(relatedLower) || def.includes(relatedLower);
        });
        if (hasRelatedMatch) {
          score += 6;
        }
      }
      
      // Also check AI summary for related concepts
      if (metadata?.aiSummary) {
        const summaryLower = metadata.aiSummary.toLowerCase();
        if (summaryLower.includes(relatedLower)) {
          score += 4;
        }
      }
    }
  }

  return score;
}

/**
 * Highlight matching search terms in text
 */
function highlightMatches(text: string, query: string): string {
  if (!query.trim() || !text) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(
    regex,
    '<mark class="bg-yellow-200 dark:bg-yellow-600 px-1 rounded font-semibold">$1</mark>'
  );
}


export default function ChapterBrowserPage() {
  const params = useParams();
  const router = useRouter();
  const scriptureId = params.scriptureId as string;

  const [manifest, setManifest] = useState<ChapterManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState<any>(null);
  
  // Global chapter scores for all sections (lifted up for section sorting)
  const [chapterScores, setChapterScores] = useState<Map<string, number>>(new Map());
  const [scoringComplete, setScoringComplete] = useState(false);
  const [totalChaptersToScore, setTotalChaptersToScore] = useState(0);

  // Trigger search only when button clicked
  useEffect(() => {
    if (searchTriggered && searchQuery.trim().length > 0) {
      setSearchActive(true);
      const expansion = expandQuery(searchQuery);
      setExpandedQuery(expansion);
      
      // Calculate total chapters to score
      if (manifest) {
        const total = manifest.sections.reduce((sum, section) => sum + section.chapters.length, 0);
        setTotalChaptersToScore(total);
        
        // CRITICAL: Expand ALL sections so ChapterCards can mount and calculate scores
        const allSectionIds = new Set(manifest.sections.map(s => s.sectionId));
        setExpandedSections(allSectionIds);
      } else {
        console.error('[SearchTriggered] ERROR: manifest is null!');
      }
    } else if (!searchTriggered) {
      setSearchActive(false);
      setExpandedQuery(null);
      setChapterScores(new Map());
      setScoringComplete(false);
      hasAutoExpandedRef.current = false; // Reset for next search
    }
  }, [searchTriggered, searchQuery, manifest]);

  // Detect when ALL chapters have been scored (with timeout for missing data)
  useEffect(() => {
    if (searchActive && chapterScores.size > 0 && totalChaptersToScore > 0) {
      // Check if all chapters have been scored
      if (chapterScores.size >= totalChaptersToScore) {
        setScoringComplete(true);
      } else {
        // Set a timeout to force completion if stuck (e.g., missing metadata)
        const timeoutId = setTimeout(() => {
          if (chapterScores.size < totalChaptersToScore && chapterScores.size > 0) {
            console.warn('[ScoringComplete] TIMEOUT: Forcing completion with partial results');
            console.warn('[ScoringComplete] Scored:', chapterScores.size, 'Expected:', totalChaptersToScore);
            console.warn('[ScoringComplete] Missing chapters likely have no metadata files');
            setScoringComplete(true);
          }
        }, 10000); // 10 second timeout
        
        return () => clearTimeout(timeoutId);
      }
    } else {
      setScoringComplete(false);
    }
  }, [searchActive, chapterScores.size, totalChaptersToScore]);

  // Auto-expand sections when scoring completes (run only once)
  const hasAutoExpandedRef = useRef(false);
  
  useEffect(() => {
    if (searchActive && scoringComplete && manifest && chapterScores.size > 0 && !hasAutoExpandedRef.current) {
      hasAutoExpandedRef.current = true; // Mark as expanded
      
      // Collect ALL scored chapters globally
      const allChaptersGlobal: Array<{chapter: any, section: any, score: number, uniqueChapterId: string}> = [];
      manifest.sections.forEach(section => {
        section.chapters.forEach(chapter => {
          const uniqueChapterId = `${section.sectionId}-${chapter.chapterId}`;
          const score = chapterScores.get(uniqueChapterId) || 0;
          if (score > 0) {
            allChaptersGlobal.push({ chapter, section, score, uniqueChapterId });
          }
        });
      });

      // Sort and get top 5
      const globalTop5 = allChaptersGlobal
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Get unique section IDs from top 5
      const sectionsToExpand = new Set(globalTop5.map(item => item.section.sectionId));
      setExpandedSections(sectionsToExpand);
    }
  }, [searchActive, scoringComplete, manifest]); // Removed chapterScores to prevent re-running on every score update

  // Note: Scores are cleared when searchTriggered changes (in the main search useEffect)

  useEffect(() => {
    const loadManifest = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchChapterManifest(scriptureId);

        if (!data) {
          setError('Chapter manifest not found for this scripture.');
          return;
        }

        setManifest(data);

        // Expand first section by default (or all if searching)
        if (data.sections.length > 0) {
          setExpandedSections(new Set([data.sections[0].sectionId]));
        }
      } catch (err) {
        console.error('[ChapterBrowser] Error loading manifest:', err);
        setError('Failed to load chapter manifest. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (scriptureId) {
      loadManifest();
    }
  }, [scriptureId]);

  // Auto-expand all sections when searching
  useEffect(() => {
    if (searchActive && manifest) {
      const allSectionIds = manifest.sections.map((s) => s.sectionId);
      setExpandedSections(new Set(allSectionIds));
    } else if (!searchActive && manifest && manifest.sections.length > 0) {
      // Collapse back to first section when search cleared
      setExpandedSections(new Set([manifest.sections[0].sectionId]));
    }
  }, [searchActive, manifest]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleBack = () => {
    router.back();
  };

  const handleViewPDF = (pdfUrl: string) => {
    const httpsUrl = convertGcsUrlToHttps(pdfUrl);
    window.open(httpsUrl, '_blank', 'noopener,noreferrer');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading chapters...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !manifest) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Unable to Load Chapters
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'Chapter manifest not found for this scripture.'}
          </p>
          <button
            onClick={handleBack}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            ← Back to Library
          </button>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={handleBack}
            className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-3 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Library
          </button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {manifest.scriptureName}
          </h1>

          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {manifest.totalChapters} Chapters
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {manifest.sections.length} Sections
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search chapters by concept, term, number, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setSearchTriggered(true);
                }
              }}
              className="block w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchTriggered(false);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Find Ancient Wisdom Button */}
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => {
                setSearchTriggered(true);
              }}
              disabled={!searchQuery.trim() || searchTriggered}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center gap-3"
            >
              <span className="text-xl">🔍</span>
              <span>Find Ancient Wisdom</span>
            </button>
            
            {/* TEMPORARY: Search Quality Diagnostics */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  console.clear();
                  console.log('🧪 RUNNING SEARCH QUALITY TESTS...\n');
                  runAllTests();
                  
                  // Also test current search query if one exists
                  if (searchQuery.trim()) {
                    console.log('\n📊 TESTING CURRENT QUERY: "' + searchQuery + '"');
                    testQueryExpansion(searchQuery);
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🧪 Test Search Quality
              </button>
            )}
          </div>
          
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-screen">
        {/* Om Loading Animation - Overlay on top while scoring */}
        {searchActive && !scoringComplete && (
          <div className="fixed inset-0 z-50 bg-gray-900/95 dark:bg-gray-950/95 flex flex-col items-center justify-center space-y-6">
            {/* Pulsating Om Symbol */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur-2xl opacity-50 animate-pulse"></div>
              <div className="relative text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 animate-pulse">
                ॐ
              </div>
            </div>
            
            {/* Loading Text */}
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-gray-100 dark:text-gray-200">
                Analyzing chapters for &ldquo;{searchQuery}&rdquo;...
              </p>
              <p className="text-sm text-gray-300 dark:text-gray-400">
                Scored {chapterScores.size} of {totalChaptersToScore} chapters
              </p>
              {/* Progress Bar */}
              <div className="w-64 h-2 bg-gray-700 dark:bg-gray-800 rounded-full overflow-hidden mx-auto">
                <div 
                  className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
                  style={{ width: `${totalChaptersToScore > 0 ? (chapterScores.size / totalChaptersToScore) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Sections render always (hidden behind Om during loading) */}
        <div 
          className="space-y-4 transition-opacity duration-300" 
          style={{ 
            opacity: searchActive && !scoringComplete ? 0 : 1,
            pointerEvents: searchActive && !scoringComplete ? 'none' : 'auto'
          }}
        >
            {/* During loading: render all sections simply to allow scoring */}
            {searchActive && !scoringComplete && manifest.sections.map(section => (
              <SectionAccordion
                key={section.sectionId}
                section={section}
                onViewPDF={handleViewPDF}
                searchQuery={searchQuery}
                searchActive={searchActive}
                expandedQuery={expandedQuery}
                chapterScores={chapterScores}
                setChapterScores={setChapterScores}
                maxScore={0}
                totalScore={0}
                matchingChapters={0}
                globalTop5Chapters={undefined}
                globalResultText=""
              />
            ))}
            
            {/* After scoring complete: render with global top 5 filtering */}
            {searchActive && scoringComplete && (() => {
            // Calculate scores for each section
            const sectionsWithScores = manifest.sections.map(section => {
              let maxScore = 0;
              let totalScore = 0;
              let matchingChapters = 0;

              section.chapters.forEach(chapter => {
                const uniqueChapterId = `${section.sectionId}-${chapter.chapterId}`;
                const score = chapterScores.get(uniqueChapterId) || 0;
                if (score > 0) {
                  matchingChapters++;
                  totalScore += score;
                  maxScore = Math.max(maxScore, score);
                }
              });

              return { section, maxScore, totalScore, matchingChapters };
            });

            // Global top 5 logic
            let sectionsToRender = sectionsWithScores;
            let globalResultText = '';

            // During scoring: show all sections (so ChapterCards can render and calculate)
            // After scoring: filter to global top 5
            if (searchActive && scoringComplete && chapterScores.size > 0) {
              // Collect ALL scored chapters globally
              const allChaptersGlobal: Array<{chapter: any, section: any, score: number, uniqueChapterId: string}> = [];
              manifest.sections.forEach(section => {
                section.chapters.forEach(chapter => {
                  const uniqueChapterId = `${section.sectionId}-${chapter.chapterId}`;
                  const score = chapterScores.get(uniqueChapterId);
                  if (score && score > 0) {
                    allChaptersGlobal.push({ chapter, section, score, uniqueChapterId });
                  }
                });
              });

              // Sort by score and take top 5
              const globalTop5 = allChaptersGlobal
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

              // Group by section
              const sectionsWithTop5 = new Map<string, Array<{chapter: any, score: number}>>();
              globalTop5.forEach(item => {
                if (!sectionsWithTop5.has(item.section.sectionId)) {
                  sectionsWithTop5.set(item.section.sectionId, []);
                }
                sectionsWithTop5.get(item.section.sectionId)!.push({
                  chapter: item.chapter,
                  score: item.score
                });
              });

              // Filter to only sections with top 5
              sectionsToRender = sectionsWithScores
                .filter(s => sectionsWithTop5.has(s.section.sectionId))
                .map(s => ({
                  ...s,
                  globalTop5Chapters: sectionsWithTop5.get(s.section.sectionId)
                }));

              globalResultText = `Showing top ${globalTop5.length} of ${allChaptersGlobal.length} results`;
            } else if (searchActive) {
              // Show loading state - all sections visible (so ChapterCards can render)
              sectionsToRender = sectionsWithScores;
            }

            return sectionsToRender.map(({ section, maxScore, totalScore, matchingChapters, globalTop5Chapters }: any) => (
              <SectionAccordion
                key={section.sectionId}
                section={section}
                onViewPDF={handleViewPDF}
                searchQuery={searchQuery}
                searchActive={searchActive}
                expandedQuery={expandedQuery}
                chapterScores={chapterScores}
                setChapterScores={setChapterScores}
                maxScore={maxScore}
                totalScore={totalScore}
                matchingChapters={matchingChapters}
                globalTop5Chapters={globalTop5Chapters}
                globalResultText={globalResultText}
              />
            ));
          })()}
          
          {/* When not searching: render all sections normally */}
          {!searchActive && manifest.sections.map(section => (
            <SectionAccordion
              key={section.sectionId}
              section={section}
              onViewPDF={handleViewPDF}
              searchQuery={searchQuery}
              searchActive={searchActive}
              expandedQuery={expandedQuery}
              chapterScores={chapterScores}
              setChapterScores={setChapterScores}
              maxScore={0}
              totalScore={0}
              matchingChapters={0}
              globalTop5Chapters={undefined}
              globalResultText=""
            />
          ))}
        </div>

        {/* Footer - Back to Library */}
        <div className="mt-12 text-center">
          <button
            onClick={handleBack}
            className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Library
          </button>
        </div>
      </div>
    </div>
  );
}

// Section Accordion Component
interface SectionAccordionProps {
  section: SectionMetadata;
  onViewPDF: (pdfUrl: string) => void;
  searchQuery: string;
  searchActive: boolean;
  expandedQuery?: any;
  chapterScores: Map<string, number>;
  setChapterScores: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  maxScore: number;
  totalScore: number;
  matchingChapters: number;
  globalTop5Chapters?: Array<{chapter: ChapterMetadata, score: number}>;
  globalResultText?: string;
}

function SectionAccordion({
  section,
  onViewPDF,
  searchQuery,
  searchActive,
  expandedQuery,
  chapterScores,
  setChapterScores,
  maxScore,
  totalScore,
  matchingChapters,
  globalTop5Chapters,
  globalResultText,
}: SectionAccordionProps) {
  const [totalResults, setTotalResults] = useState(0);
  const [showAllInSection, setShowAllInSection] = useState<Set<number>>(new Set());

  // Stable callback to prevent infinite re-renders
  const stableOnScoreCalculated = useCallback((chapterId: string, score: number) => {
    setChapterScores((prev) => {
      const newMap = new Map(prev);
      newMap.set(chapterId, score);
      return newMap;
    });
  }, []); // Empty dependency array - setChapterScores is stable

  // Use global top 5 if provided, otherwise use section's own filtering
  const chaptersToRender = searchActive && globalTop5Chapters && globalTop5Chapters.length > 0
    ? globalTop5Chapters.map(item => item.chapter)
    : (() => {
        // Existing filtering logic for non-global mode
        let filtered = searchActive
          ? section.chapters.filter((chapter) => {
              const uniqueChapterId = `${section.sectionId}-${chapter.chapterId}`;
              const score = chapterScores.get(uniqueChapterId);
              return score === undefined || score > 0;
            })
          : section.chapters;
        
        if (searchActive) {
          filtered = filtered.sort((a, b) => {
            const scoreA = chapterScores.get(`${section.sectionId}-${a.chapterId}`) || 0;
            const scoreB = chapterScores.get(`${section.sectionId}-${b.chapterId}`) || 0;
            return scoreB - scoreA;
          });
        }
        
        return filtered;
      })();

  const sortedChapters = chaptersToRender;

  // Don't render section if no results when searching (but not in global top 5 mode)
  if (searchActive && !globalTop5Chapters && sortedChapters.length === 0) {
    const allScored = section.chapters.every((chapter) => {
      const uniqueChapterId = `${section.sectionId}-${chapter.chapterId}`;
      return chapterScores.has(uniqueChapterId);
    });
    
    if (allScored) {
      return null;
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Section Header - Always Expanded */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{section.sectionName}</h3>
              {searchActive && maxScore > 0 && (
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <span className="text-xs">
                    ({totalScore} pts total)
                  </span>
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{section.sectionNameEnglish}</p>
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
            {searchActive && globalResultText
              ? globalResultText
              : searchActive
                ? `${sortedChapters.length} result${sortedChapters.length !== 1 ? 's' : ''}`
                : `${section.chapterCount} ${section.chapterCount === 1 ? 'Chapter' : 'Chapters'}`
            }
          </span>
        </div>
      </div>

      {/* Section Content - Always Visible */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedChapters.map((chapter) => {
              // Calculate individual chapter score for star rating
              const uniqueChapterId = `${section.sectionId}-${chapter.chapterId}`;
              const chapterScore = chapterScores.get(uniqueChapterId) || 0;
              
              return (
                <div key={chapter.chapterId} className="relative">
                  {/* Individual Chapter Score Display */}
                  {searchActive && chapterScore > 0 && (
                    <div className="absolute top-2 right-2 z-10 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                        Score: {chapterScore}
                      </span>
                    </div>
                  )}
                  <ChapterCard
                    chapter={chapter}
                    section={section}
                    onViewPDF={onViewPDF}
                    searchQuery={searchQuery}
                    searchActive={searchActive}
                    expandedQuery={expandedQuery}
                    onScoreCalculated={stableOnScoreCalculated}
                  />
                </div>
              );
            })}
          </div>
      </div>
    </div>
  );
}

// Chapter Card Component
interface ChapterCardProps {
  chapter: ChapterMetadata;
  section: SectionMetadata;
  onViewPDF: (pdfUrl: string) => void;
  searchQuery: string;
  searchActive: boolean;
  expandedQuery?: any;
  onScoreCalculated: (chapterId: string, score: number) => void;
}

interface ChapterMetadataJson {
  aiSummary?: string;
  keyConcepts?: Array<{ term: string; definition: string }>;
  deeperInsights?: {
    philosophicalViewpoint?: string;
    practicalAdvice?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

function ChapterCard({
  chapter,
  section,
  onViewPDF,
  searchQuery,
  searchActive,
  expandedQuery,
  onScoreCalculated,
}: ChapterCardProps) {
  const [fullMetadata, setFullMetadata] = useState<ChapterMetadataJson | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true); // Start as true to prevent premature scoring
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [searchScore, setSearchScore] = useState(0);
  const lastReportedScoreRef = useRef<number>(-1); // Track last reported score to prevent infinite loops

  useEffect(() => {
    // Only fetch if chapter has metadata and metadataUrl is available
    if (!chapter.hasMetadata || !chapter.metadataUrl) {
      setFullMetadata(null);
      setLoadingSummary(false);
      return;
    }

    const fetchMetadata = async () => {
      try {
        setLoadingSummary(true);
        const httpsUrl = convertGcsUrlToHttps(chapter.metadataUrl);

        // Add cache-busting to ensure fresh metadata
        const cacheBuster = httpsUrl.includes('?') ? '&' : '?';
        const urlWithCacheBuster = `${httpsUrl}${cacheBuster}t=${Date.now()}`;
        
        const response = await fetch(urlWithCacheBuster, {
          cache: 'no-store',
        });
        
        if (response.ok) {
          const data: ChapterMetadataJson = await response.json();
          setFullMetadata(data);
        } else {
          const errorText = await response.text().catch(() => 'Could not read error response');
          console.error(`[ChapterCard] Failed to fetch metadata for Chapter ${chapter.chapterNumber}:`, {
            status: response.status,
            statusText: response.statusText,
            url: httpsUrl,
            errorPreview: errorText.substring(0, 200)
          });
          setFullMetadata(null); // Set to null so scoring can proceed with 0
        }
      } catch (error) {
        console.error(`[ChapterCard] Error fetching chapter metadata for Chapter ${chapter.chapterNumber}:`, error);
        if (error instanceof Error) {
          console.error(`[ChapterCard] Error details: ${error.message}`);
        }
        setFullMetadata(null); // Set to null so scoring can proceed with 0
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchMetadata();
  }, [chapter.metadataUrl, chapter.hasMetadata, chapter.chapterNumber]);

  // Calculate search score when metadata loads or query changes
  useEffect(() => {
    // If search is not active, don't calculate or report scores
    if (!searchActive) {
      setSearchScore(0);
      lastReportedScoreRef.current = -1;  // Reset for next search
      return;
    }
    
    // If still loading metadata, wait
    if (loadingSummary) {
      return;
    }
    
    // Calculate score (will be 0 if no metadata)
    const newScore = fullMetadata 
      ? calculateSearchScore(chapter, section, fullMetadata, searchQuery, expandedQuery)
      : 0; // No metadata = score 0
    
    setSearchScore(newScore);
    
    // Only call onScoreCalculated if the score actually changed
    // Don't include onScoreCalculated in dependencies to avoid infinite loop
    if (lastReportedScoreRef.current !== newScore) {
      lastReportedScoreRef.current = newScore;
      // Create globally unique ID by combining section + chapter
      const uniqueChapterId = `${section.sectionId}-${chapter.chapterId}`;
      onScoreCalculated(uniqueChapterId, newScore);
    }
  }, [searchActive, searchQuery, fullMetadata, loadingSummary, chapter.chapterId, section.sectionId, chapter, expandedQuery, section]);

  // Extract and truncate summary for card display
  const aiSummary = fullMetadata?.aiSummary || '';
  const truncatedSummary = aiSummary.length > 250 ? aiSummary.substring(0, 250).trim() + '...' : aiSummary;

  // Highlight matches in summary
  const displaySummary = searchActive && searchQuery ? highlightMatches(truncatedSummary, searchQuery) : truncatedSummary;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow relative">

      {/* Chapter Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
            Chapter {chapter.chapterNumber}
          </span>
          {chapter.hasMetadata && (
            <span className="text-xs text-green-600 dark:text-green-400" title="Metadata available">
              ✓
            </span>
          )}
        </div>
        <h4 className="font-semibold text-gray-900 dark:text-white text-base mb-1 leading-snug">
          {chapter.title}
        </h4>
        {chapter.titleEnglish && chapter.titleEnglish.trim() !== '' && (
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
            {chapter.titleEnglish}
          </p>
        )}
      </div>

      {/* AI Summary Section */}
      {chapter.hasMetadata && (
        <div className="mb-3">
          {loadingSummary ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span>Loading summary...</span>
            </div>
          ) : aiSummary ? (
            <div
              className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-4"
              dangerouslySetInnerHTML={{ __html: displaySummary }}
            />
          ) : null}
        </div>
      )}

      {/* Chapter Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onViewPDF(chapter.pdfUrl)}
          className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View PDF
        </button>

        <button
          onClick={() => setIsInsightsOpen(true)}
          disabled={!chapter.hasMetadata || !fullMetadata}
          className={`w-full px-3 py-2 text-sm rounded font-medium flex items-center justify-center gap-2 transition-colors ${
            chapter.hasMetadata && fullMetadata
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
          }`}
          title={chapter.hasMetadata ? 'View detailed insights' : 'No insights available'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          View Full Insights
        </button>
      </div>

      {/* Chapter Insights Modal */}
      <ChapterInsightsModal
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        chapterMetadata={fullMetadata}
        chapterNumber={chapter.chapterNumber}
        chapterTitle={chapter.title}
      />
    </div>
  );
}
