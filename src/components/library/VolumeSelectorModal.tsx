'use client';

import { X } from 'lucide-react';
import type { Scripture, Edition } from '@/types/library';
import { convertGcsUrlToHttps } from '@/lib/libraryService';

interface VolumeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scripture: Scripture;
  volumes: Edition[];
}

/**
 * VolumeSelectorModal - Displays a modal for selecting which volume to read
 * when a scripture has multiple English PDF volumes.
 * 
 * Features:
 * - Clean modal UI with volume selection
 * - Opens GCS URLs in new window using dynamic URL conversion
 * - Accessible with proper ARIA labels
 * - Error handling for invalid GCS paths
 */
export default function VolumeSelectorModal({ 
  isOpen, 
  onClose, 
  scripture, 
  volumes 
}: VolumeSelectorModalProps) {
  // Early return if modal is closed
  if (!isOpen) return null;

  /**
   * Handles reading a specific volume
   * Converts GCS path to HTTPS URL and opens in new window
   */
  const handleReadVolume = (edition: Edition) => {
    const gcsPath = edition['GCS Path'];
    
    if (!gcsPath || typeof gcsPath !== 'string') {
      console.error('Invalid GCS Path for edition:', edition);
      return;
    }

    try {
      const httpsUrl = convertGcsUrlToHttps(gcsPath);
      window.open(httpsUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error converting GCS URL:', error);
      // Could show user-friendly error message here
    }
  };

  /**
   * Handles escape key to close modal
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="volume-modal-title"
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 
            id="volume-modal-title"
            className="text-2xl font-bold text-gray-900"
          >
            {scripture.title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close modal"
            type="button"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Select Volume to Read (English)
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            This scripture has multiple volumes. Please select which volume you would like to read.
          </p>
          
          {volumes.length > 0 ? (
            <div className="space-y-3">
              {volumes.map((edition, index) => (
                <div
                  key={edition['Edition ID'] || `volume-${index}`}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        {edition['Edition Title'] || `Volume ${index + 1}`}
                      </h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Volume:</span> {index + 1} of {volumes.length}
                        </p>
                        <p>
                          <span className="font-medium">Format:</span> {edition['Format'] || 'PDF'}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleReadVolume(edition)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      type="button"
                      aria-label={`Read Volume ${index + 1} of ${scripture.title}`}
                    >
                      Read Volume {index + 1}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No English volumes available for this scripture.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

