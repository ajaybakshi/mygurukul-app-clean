'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { ClientTimestamp } from './ClientTimestamp';
import { CitationTooltip } from './CitationTooltip';

interface Citation {
  startIndex: number;
  endIndex: number;
  text?: string; // Text extract from the source
  sources: Array<{
    referenceId: string;
    title?: string;
    uri?: string;
  }>;
}

interface Reference {
  title?: string;
  uri?: string;
  chunkInfo?: {
    content: string;
    relevanceScore?: number;
    documentMetadata?: {
      document: string;
      uri: string;
      title: string;
    };
  };
}

interface GuideMessageBubbleProps {
  answerText: string;
  citations?: Citation[];
  references?: Reference[];
  timestamp: Date | string;
}

export const GuideMessageBubble: React.FC<GuideMessageBubbleProps> = ({
  answerText,
  citations = [],
  references = [],
  timestamp,
}) => {
  // Safety check: ensure answerText is a string
  const safeAnswerText = typeof answerText === 'string' ? answerText : String(answerText || '');
  
  // Safety check: ensure citations is an array
  const safeCitations = Array.isArray(citations) ? citations : [];
  
  // Safety check: ensure references is an array
  const safeReferences = Array.isArray(references) ? references : [];
  
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const [hoveredCitationIndex, setHoveredCitationIndex] = useState<number | null>(null);
  const [hoveredMarkerElement, setHoveredMarkerElement] = useState<HTMLElement | null>(null);
  const [hoveredSourceIndex, setHoveredSourceIndex] = useState<number | null>(null);
  const [hoveredSourceElement, setHoveredSourceElement] = useState<HTMLElement | null>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Map<number, HTMLElement>>(new Map());
  const sourceRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Auto-scroll to show expanded sources
  useEffect(() => {
    if (isSourcesExpanded && sourcesRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        sourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [isSourcesExpanded]);

  // Parse text and create interactive citation markers
  const parsedText = useMemo(() => {
    try {
      if (!safeCitations || safeCitations.length === 0) {
        return { parts: [{ type: 'text', content: safeAnswerText || '' }], validCitations: [] };
      }
      
      if (!safeAnswerText || safeAnswerText.length === 0) {
        return { parts: [{ type: 'text', content: '' }], validCitations: [] };
      }
      
      // Filter out invalid citations (edge case handling)
      // Store validCitations in a way that preserves the mapping
      const validCitations = safeCitations.filter(citation => {
        try {
          const startIndex = citation?.startIndex ?? 0;
          const endIndex = citation?.endIndex ?? startIndex;
          return startIndex >= 0 && 
                 endIndex >= startIndex && 
                 startIndex < safeAnswerText.length &&
                 (citation?.sources && citation.sources.length > 0);
        } catch (e) {
          console.warn('Error filtering citation:', e, citation);
          return false;
        }
      });
      
      if (validCitations.length === 0) {
        return { parts: [{ type: 'text', content: safeAnswerText }], validCitations: [] };
      }
      
      // Sort citations by startIndex to process in order, preserving original index from validCitations
      const sortedCitationsWithIndex = validCitations
        .map((citation, indexInValid) => ({ citation, originalIndex: indexInValid }))
        .sort((a, b) => (a.citation.startIndex || 0) - (b.citation.startIndex || 0));
    
    const parts: Array<{ type: 'text' | 'marker'; content: string; citationIndex?: number }> = [];
    let lastIndex = 0;
    
    // Process each citation individually to place markers inline at sentence/paragraph boundaries
    sortedCitationsWithIndex.forEach(({ citation, originalIndex }) => {
      // Ensure indices are valid (edge case: invalid indices)
      const startIndex = Math.max(0, Math.min(citation.startIndex || 0, safeAnswerText.length));
      const endIndex = Math.max(startIndex, Math.min(citation.endIndex || startIndex, safeAnswerText.length));
      
      // Add text before this citation
      if (startIndex > lastIndex) {
        parts.push({
          type: 'text',
          content: safeAnswerText.substring(lastIndex, startIndex)
        });
      }
      
      // Add text within citation (preserve the actual cited text)
      if (endIndex > startIndex) {
        parts.push({
          type: 'text',
          content: safeAnswerText.substring(startIndex, endIndex)
        });
      }
      
      // Find the nearest sentence boundary after endIndex for marker placement
      // This ensures markers appear at the end of sentences/paragraphs
      let markerPosition = endIndex;
      
      // Look forward for sentence ending (., !, ?) followed by space
      for (let i = endIndex; i < safeAnswerText.length && i < endIndex + 100; i++) {
        const char = safeAnswerText[i];
        if (char === '.' || char === '!' || char === '?') {
          // Check if followed by space or end of text
          if (i + 1 >= safeAnswerText.length || safeAnswerText[i + 1] === ' ') {
            markerPosition = i + 1;
            break;
          }
        }
      }
      
      // If no sentence boundary found nearby, use endIndex (which should already be at a boundary from mapFileSearchCitations)
      if (markerPosition === endIndex) {
        markerPosition = endIndex;
      }
      
      // Add any text between endIndex and markerPosition
      if (markerPosition > endIndex) {
        parts.push({
          type: 'text',
          content: safeAnswerText.substring(endIndex, markerPosition)
        });
      }
      
      // Determine if we need spacing around the marker
      const needsSpaceBefore = markerPosition > 0 && markerPosition <= safeAnswerText.length && 
                               safeAnswerText[markerPosition - 1] !== ' ' && 
                               safeAnswerText[markerPosition - 1] !== '.' &&
                               safeAnswerText[markerPosition - 1] !== '!' &&
                               safeAnswerText[markerPosition - 1] !== '?';
      
      const needsSpaceAfter = markerPosition < safeAnswerText.length && 
                              safeAnswerText[markerPosition] !== ' ' && 
                              safeAnswerText[markerPosition] !== '.' &&
                              safeAnswerText[markerPosition] !== '!' &&
                              safeAnswerText[markerPosition] !== '?' &&
                              safeAnswerText[markerPosition] !== ',' &&
                              safeAnswerText[markerPosition] !== ';' &&
                              safeAnswerText[markerPosition] !== ':';
      
      // Add space before marker if needed
      if (needsSpaceBefore) {
        parts.push({
          type: 'text',
          content: ' '
        });
      }
      
      // Add citation marker inline at the sentence boundary
      parts.push({
        type: 'marker',
        content: `[${originalIndex + 1}]`,
        citationIndex: originalIndex
      });
      
      // Add space after marker if needed
      if (needsSpaceAfter) {
        parts.push({
          type: 'text',
          content: ' '
        });
      }
      
      lastIndex = markerPosition;
    });
    
    // Add remaining text
    if (lastIndex < safeAnswerText.length) {
      parts.push({
        type: 'text',
        content: safeAnswerText.substring(lastIndex)
      });
    }
    
    return parts;
    } catch (error) {
      console.error('Error parsing citations in GuideMessageBubble:', error);
      // Fallback: return plain text without citations
      return [{ type: 'text', content: safeAnswerText || '' }];
    }
  }, [safeAnswerText, safeCitations]);

  // Combine citations and references for sources list with text extracts
  const sources = useMemo(() => {
    const sourceMap = new Map<string, { title: string; uri?: string; location?: string; text?: string }>();
    
    // Add from citations
    safeCitations.forEach((citation, index) => {
      citation.sources.forEach((source) => {
        if (source.referenceId && !sourceMap.has(source.referenceId)) {
          sourceMap.set(source.referenceId, {
            title: source.title || source.referenceId,
            uri: source.uri,
            text: citation.text, // Include text extract
          });
        }
      });
    });
    
    // Add from references
    safeReferences.forEach((ref) => {
      const key = ref.uri || ref.title || `ref-${sourceMap.size}`;
      if (!sourceMap.has(key)) {
        const title = ref.title || ref.chunkInfo?.documentMetadata?.title || 'Unknown Source';
        const location = ref.chunkInfo?.documentMetadata?.document || '';
        sourceMap.set(key, {
          title,
          uri: ref.uri || ref.chunkInfo?.documentMetadata?.uri,
          location,
          text: ref.chunkInfo?.content, // Include text extract from chunkInfo
        });
      }
    });
    
    return Array.from(sourceMap.values());
  }, [safeCitations, safeReferences]);

  // Extract the parts and validCitations from parsedText with safety checks
  const parsedParts = parsedText?.parts || [{ type: 'text', content: safeAnswerText || '' }];
  const validCitationsForRender = parsedText?.validCitations || [];

  const sourcesCount = sources.length;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] bg-gradient-to-r from-white to-blue-50 border border-blue-100 rounded-r-lg rounded-tl-lg p-4 shadow-sm">
        <div className="text-xs font-medium text-blue-600 text-left mb-2 flex items-center gap-2">
          <span>🕉️</span>
          <span>Spiritual Guide</span>
        </div>
        
        <div className="text-gray-800 text-left leading-relaxed whitespace-pre-wrap mb-3">
            {parsedParts && Array.isArray(parsedParts) ? parsedParts.map((part, idx) => {
            if (part.type === 'text') {
              return <span key={idx}>{part.content}</span>;
            } else {
              const citationIndex = part.citationIndex!;
              // Use validCitations array which matches the originalIndex used in markers
              const citation = validCitationsForRender[citationIndex];
              const sourceTitle = citation?.sources[0]?.title || 'Unknown Source';
              const citationText = citation?.text || '';
              
              // Debug logging
              if (process.env.NODE_ENV === 'development' && citationIndex === 0) {
                console.log('🔍 Citation Marker Debug:', {
                  citationIndex,
                  hasCitation: !!citation,
                  hasText: !!citationText,
                  textLength: citationText?.length || 0,
                  textPreview: citationText?.substring(0, 50) || 'none',
                  sourceTitle
                });
              }
              
              return (
                <span
                  key={idx}
                  ref={(el) => {
                    if (el) markerRefs.current.set(citationIndex, el);
                  }}
                  className="inline-block mx-1 px-1 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 hover:underline transition-colors font-medium"
                  onMouseEnter={(e) => {
                    if (citationText) {
                      console.log('🖱️ Hovering over citation:', {
                        index: citationIndex,
                        hasText: !!citationText,
                        textLength: citationText.length,
                        textPreview: citationText.substring(0, 50)
                      });
                      setHoveredCitationIndex(citationIndex);
                      setHoveredMarkerElement(e.currentTarget);
                    } else {
                      console.warn('⚠️ Citation has no text extract:', {
                        index: citationIndex,
                        citation: citation
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredCitationIndex(null);
                    setHoveredMarkerElement(null);
                  }}
                  title={citationText ? `Hover to see text extract from ${sourceTitle}` : `No text extract available for ${sourceTitle}`}
                >
                  {part.content}
                </span>
              );
            }
          }) : <span>{safeAnswerText}</span>}
        </div>
        
        {/* Citation Tooltip for markers */}
        {hoveredCitationIndex !== null && hoveredMarkerElement && (
          <CitationTooltip
            text={validCitationsForRender[hoveredCitationIndex]?.text || ''}
            source={validCitationsForRender[hoveredCitationIndex]?.sources[0]?.title || 'Unknown Source'}
            onClose={() => {
              setHoveredCitationIndex(null);
              setHoveredMarkerElement(null);
            }}
            anchorElement={hoveredMarkerElement}
          />
        )}
        
        {/* Citation Tooltip for sources list */}
        {hoveredSourceIndex !== null && hoveredSourceElement && sources[hoveredSourceIndex]?.text && (
          <CitationTooltip
            text={sources[hoveredSourceIndex].text!}
            source={sources[hoveredSourceIndex].title}
            onClose={() => {
              setHoveredSourceIndex(null);
              setHoveredSourceElement(null);
            }}
            anchorElement={hoveredSourceElement}
          />
        )}
        
        {sourcesCount > 0 && (
          <div ref={sourcesRef} className="mt-4 pt-3 border-t border-blue-100">
            <button
              onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
              className="w-full flex items-center justify-between text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <span className="font-medium">
                Sources from sacred texts ({sourcesCount})
              </span>
              {isSourcesExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {isSourcesExpanded && (
              <div className="mt-3 space-y-2">
                {sources.map((source, index) => (
                  <div
                    key={index}
                    ref={(el) => {
                      if (el) sourceRefs.current.set(index, el);
                    }}
                    className={`text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded transition-colors ${
                      source.text ? 'cursor-pointer hover:bg-blue-100' : ''
                    }`}
                    onMouseEnter={(e) => {
                      if (source.text) {
                        setHoveredSourceIndex(index);
                        setHoveredSourceElement(e.currentTarget);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredSourceIndex(null);
                      setHoveredSourceElement(null);
                    }}
                    title={source.text ? 'Hover to see text extract' : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-medium">{index + 1}.</span>{' '}
                        <span>{source.title}</span>
                        {source.location && (
                          <span className="text-blue-600"> – {source.location}</span>
                        )}
                      </div>
                      {source.uri && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(source.uri, '_blank');
                          }}
                          className="text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Open</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="text-xs text-blue-500 text-left mt-3">
          <ClientTimestamp timestamp={timestamp} />
        </div>
      </div>
    </div>
  );
};

