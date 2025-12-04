'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Scripture, Edition } from '@/types/library';
import EditionsModal from './EditionsModal';
import VolumeSelectorModal from './VolumeSelectorModal';
import { fetchChapterManifest, findEditionByLanguage, getEnglishEditions, hasMultipleEnglishVolumes, convertGcsUrlToHttps, hasChapterManifestSync } from '@/lib/libraryService';
import type { ChapterManifest } from '@/types/library';

interface ScriptureCardProps {
  scripture: Scripture;
}

export default function ScriptureCard({ scripture }: ScriptureCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVolumeModalOpen, setIsVolumeModalOpen] = useState(false);
  const [chapterManifest, setChapterManifest] = useState<ChapterManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [englishEdition, setEnglishEdition] = useState<Edition | null>(null);
  const [englishEditions, setEnglishEditions] = useState<Edition[]>([]);
  const [sanskritEdition, setSanskritEdition] = useState<Edition | null>(null);

  useEffect(() => {
    const loadManifest = async () => {
      // Use the centralized synchronous check to determine if this scripture has a manifest
      if (hasChapterManifestSync(scripture.id)) {
        setLoadingManifest(true);
        const manifest = await fetchChapterManifest(scripture.id);
        setChapterManifest(manifest);
        setLoadingManifest(false);
      }
    };
    loadManifest();
  }, [scripture.id]);

  // Find English and Sanskrit editions on mount
  useEffect(() => {
    const english = findEditionByLanguage(scripture, 'English');
    const allEnglish = getEnglishEditions(scripture);
    const sanskrit = findEditionByLanguage(scripture, 'Sanskrit');
    setEnglishEdition(english);
    setEnglishEditions(allEnglish);
    setSanskritEdition(sanskrit);
  }, [scripture]);

  const handleBrowseChapters = () => {
    router.push(`/library/${scripture.id}`);
  };

  const handleReadFullText = (edition: Edition) => {
    const gcsPath = edition['GCS Path'];
    if (gcsPath && typeof gcsPath === 'string') {
      const httpsUrl = convertGcsUrlToHttps(gcsPath);
      window.open(httpsUrl, '_blank', 'noopener,noreferrer');
    } else {
      console.error('Invalid GCS Path for edition:', edition);
    }
  };

  const handleReadEnglish = () => {
    if (hasMultipleEnglishVolumes(scripture)) {
      setIsVolumeModalOpen(true);
    } else if (englishEditions.length > 0) {
      handleReadFullText(englishEditions[0]);
    } else if (englishEdition) {
      handleReadFullText(englishEdition);
    }
  };

  return (
    <>
      <div className="flex-shrink-0 w-full sm:w-80 bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
        <h3 className="text-xl font-semibold mb-2 text-gray-900">
          {scripture.title}
        </h3>
        
        {chapterManifest && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {chapterManifest.totalChapters} Chapters • {chapterManifest.sections.length} Sections
          </p>
        )}
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {scripture.description}
        </p>

        <div className="mt-auto space-y-2">
          {hasChapterManifestSync(scripture.id) ? (
            // Scripture has chapter manifest - show Browse Chapters first, then Read buttons
            // Use synchronous check so button appears even if manifest fetch fails
            <>
              <button
                onClick={handleBrowseChapters}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Browse Chapters
              </button>
              {(englishEdition || englishEditions.length > 0) && (
                <button
                  onClick={handleReadEnglish}
                  className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium border border-blue-200"
                >
                  Read Full Text (English)
                </button>
              )}
              {sanskritEdition && (
                <button
                  onClick={() => handleReadFullText(sanskritEdition)}
                  className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium border border-blue-200"
                >
                  Read Full Text (Sanskrit)
                </button>
              )}
            </>
          ) : (
            // Scripture without chapter manifest - show Read buttons only
            <>
              {(englishEdition || englishEditions.length > 0) && (
                <button
                  onClick={handleReadEnglish}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Read Full Text (English)
                </button>
              )}
              {sanskritEdition && (
                <button
                  onClick={() => handleReadFullText(sanskritEdition)}
                  className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium border border-blue-200"
                >
                  Read Full Text (Sanskrit)
                </button>
              )}
              {!englishEdition && !sanskritEdition && (
                // Fallback: show old Read button if no editions found
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Read
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* VolumeSelectorModal for multi-volume English scriptures */}
      <VolumeSelectorModal
        isOpen={isVolumeModalOpen}
        onClose={() => setIsVolumeModalOpen(false)}
        scripture={scripture}
        volumes={englishEditions}
      />

      {/* EditionsModal only for non-chapter scriptures (backward compatibility) */}
      {!hasChapterManifestSync(scripture.id) && (
        <EditionsModal
          isModalOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          scripture={scripture}
        />
      )}
    </>
  );
}


