'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface CitationTooltipProps {
  text: string;
  source: string;
  onClose: () => void;
  anchorElement: HTMLElement | null;
}

export const CitationTooltip: React.FC<CitationTooltipProps> = ({
  text,
  source,
  onClose,
  anchorElement,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchorElement || !tooltipRef.current) return;

    const updatePosition = () => {
      if (!anchorElement || !tooltipRef.current) return;

      const rect = anchorElement.getBoundingClientRect();
      const tooltip = tooltipRef.current;
      
      // Force a layout recalculation to get accurate dimensions
      tooltip.style.visibility = 'hidden';
      tooltip.style.display = 'block';
      const tooltipRect = tooltip.getBoundingClientRect();
      tooltip.style.visibility = 'visible';

      // Position above the anchor, centered horizontally
      let top = rect.top - tooltipRect.height - 10;
      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

      // Adjust if tooltip goes off screen horizontally
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }

      // If not enough space above, position below
      if (top < 10) {
        top = rect.bottom + 10;
      }

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    };

    // Initial position - use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      updatePosition();
    });

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    // Close on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) && 
          anchorElement && !anchorElement.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [anchorElement, onClose]);

  // Show tooltip even if text is empty (for debugging)
  if (!text || text.trim().length === 0) {
    return (
      <div
        ref={tooltipRef}
        className="fixed z-50 bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-xl p-4 max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs text-yellow-800">
          <strong>Debug:</strong> No text extract available for this citation.
          <br />Source: {source}
        </div>
      </div>
    );
  }

  // Truncate text if too long (show first 500 chars)
  const displayText = text.length > 500 ? text.substring(0, 500) + '...' : text;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-white border-2 border-blue-200 rounded-lg shadow-xl p-4 max-w-md"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="text-xs font-semibold text-blue-600 mb-1">Source: {source}</div>
          <div className="text-xs text-blue-500">Text Extract:</div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
          aria-label="Close tooltip"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed max-h-64 overflow-y-auto">
        {displayText}
      </div>
      {text.length > 500 && (
        <div className="text-xs text-gray-500 mt-2 italic">
          (Truncated - {text.length} characters total)
        </div>
      )}
    </div>
  );
};

