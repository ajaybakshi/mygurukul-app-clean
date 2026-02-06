'use client';

import React, { useState } from 'react';
import { Share2, Copy, Check, Twitter, MessageCircle } from 'lucide-react';

interface ShareButtonProps {
  /** The main text content to share */
  text: string;
  /** Optional title (e.g., scripture name) */
  title?: string;
  /** Optional source reference */
  source?: string;
  /** Style variant */
  variant?: 'primary' | 'secondary' | 'minimal';
  /** Optional className for custom styling */
  className?: string;
  /** Whether to show all buttons or just a share icon that expands */
  compact?: boolean;
}

const SITE_URL = 'https://www.mygurukul.org';
const HASHTAGS = '#SanskritWisdom #Vedas #AncientWisdom #Dharma #MyGurukul';

export default function ShareButton({
  text,
  title,
  source,
  variant = 'primary',
  className = '',
  compact = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Format the shareable text
  const formatShareText = (includeUrl: boolean = true): string => {
    let shareText = '';

    if (title) {
      shareText += `${title}\n\n`;
    }

    // Truncate text if too long for social sharing
    const maxLength = 200;
    const truncatedText = text.length > maxLength
      ? text.substring(0, maxLength).trim() + '...'
      : text;

    shareText += `"${truncatedText}"`;

    if (source) {
      shareText += `\n\n— ${source}`;
    }

    if (includeUrl) {
      shareText += `\n\n${SITE_URL}`;
    }

    return shareText;
  };

  // Format for Twitter (with character limit consideration)
  const formatTwitterText = (): string => {
    // Twitter limit is 280 chars, but we need room for URL (23 chars) and hashtags
    const availableChars = 280 - 23 - HASHTAGS.length - 10; // 10 for spacing

    let tweetText = '';

    // Use truncated wisdom text
    const maxTextLength = Math.min(availableChars - (source ? source.length + 5 : 0), 150);
    const truncatedText = text.length > maxTextLength
      ? text.substring(0, maxTextLength).trim() + '...'
      : text;

    tweetText = `"${truncatedText}"`;

    if (source) {
      tweetText += `\n— ${source}`;
    }

    tweetText += `\n\n${HASHTAGS}`;

    return tweetText;
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatShareText(true));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Share to Twitter
  const handleTwitterShare = () => {
    const tweetText = formatTwitterText();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(SITE_URL)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
  };

  // Share to WhatsApp
  const handleWhatsAppShare = () => {
    const shareText = formatShareText(true);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  // Use Web Share API if available (mainly mobile)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'Sacred Wisdom from MyGurukul',
          text: formatShareText(false),
          url: SITE_URL,
        });
      } catch (err) {
        // User cancelled or error - fall back to expanded menu
        if ((err as Error).name !== 'AbortError') {
          setIsExpanded(true);
        }
      }
    } else {
      setIsExpanded(true);
    }
  };

  // Variant styles
  const variantStyles = {
    primary: {
      container: 'bg-amber-50 border border-amber-200 rounded-lg',
      button: 'text-amber-700 hover:text-amber-800 hover:bg-amber-100',
      icon: 'text-amber-600',
    },
    secondary: {
      container: 'bg-blue-50 border border-blue-200 rounded-lg',
      button: 'text-blue-700 hover:text-blue-800 hover:bg-blue-100',
      icon: 'text-blue-600',
    },
    minimal: {
      container: 'bg-transparent',
      button: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
      icon: 'text-gray-500',
    },
  };

  const styles = variantStyles[variant];

  // Compact mode - single share button that expands
  if (compact) {
    return (
      <div className={`relative inline-block ${className}`}>
        <button
          onClick={handleNativeShare}
          className={`p-2 rounded-full transition-all duration-200 ${styles.button}`}
          title="Share this wisdom"
          aria-label="Share"
        >
          <Share2 className={`w-4 h-4 ${styles.icon}`} />
        </button>

        {/* Expanded menu */}
        {isExpanded && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsExpanded(false)}
            />

            {/* Share menu */}
            <div className={`absolute right-0 top-full mt-2 z-50 ${styles.container} p-2 shadow-lg min-w-[140px]`}>
              <button
                onClick={() => { handleCopy(); setIsExpanded(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${styles.button}`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                onClick={() => { handleTwitterShare(); setIsExpanded(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${styles.button}`}
              >
                <Twitter className="w-4 h-4" />
                <span>Twitter</span>
              </button>

              <button
                onClick={() => { handleWhatsAppShare(); setIsExpanded(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${styles.button}`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full mode - all buttons visible
  return (
    <div className={`flex items-center gap-2 ${styles.container} p-2 ${className}`}>
      <span className={`text-xs font-medium ${styles.icon} mr-1`}>Share:</span>

      <button
        onClick={handleCopy}
        className={`p-2 rounded-full transition-all duration-200 ${styles.button}`}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>

      <button
        onClick={handleTwitterShare}
        className={`p-2 rounded-full transition-all duration-200 ${styles.button}`}
        title="Share on Twitter"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
      </button>

      <button
        onClick={handleWhatsAppShare}
        className={`p-2 rounded-full transition-all duration-200 ${styles.button}`}
        title="Share on WhatsApp"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="w-4 h-4" />
      </button>
    </div>
  );
}
