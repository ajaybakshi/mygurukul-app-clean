'use client';

import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  keywords?: string[];
  type?: string;
  twitterHandle?: string;
}

export default function SEOHead({
  title,
  description,
  url,
  image = '/logo.png',
  keywords = [],
  type = 'website',
  twitterHandle = '@MyGurukul',
}: SEOHeadProps) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper function to update or create meta tag
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Helper function to update or create link tag
    const updateLinkTag = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
    };

    // Primary Meta Tags
    updateMetaTag('title', title);
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords.join(', '));
    updateMetaTag('author', 'MyGurukul');

    // Canonical URL
    updateLinkTag('canonical', url);

    // Open Graph / Facebook
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:url', url, true);
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', image, true);

    // Twitter
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:url', url);
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image);
    updateMetaTag('twitter:creator', twitterHandle);

    // Additional Meta Tags
    updateMetaTag('theme-color', '#F6D55C');
    updateMetaTag('language', 'English');
    updateMetaTag('og:locale', 'en_US', true);

    // Google Search Console verification
    let googleVerificationMeta = document.querySelector('meta[name="google-site-verification"]');
    if (!googleVerificationMeta) {
      googleVerificationMeta = document.createElement('meta');
      googleVerificationMeta.setAttribute('name', 'google-site-verification');
      document.head.appendChild(googleVerificationMeta);
    }
    googleVerificationMeta.setAttribute('content', 'O2_cqCi1Hsvodgl0uJuyz1ezFKVqEJlrf6ULF8rHIwc');

    // Bing Webmaster Tools verification  
    let bingVerificationMeta = document.querySelector('meta[name="msvalidate.01"]');
    if (!bingVerificationMeta) {
      bingVerificationMeta = document.createElement('meta');
      bingVerificationMeta.setAttribute('name', 'msvalidate.01');
      document.head.appendChild(bingVerificationMeta);
    }
    bingVerificationMeta.setAttribute('content', 'PLACEHOLDER_BING_VERIFICATION_CODE');
  }, [title, description, url, image, keywords, type, twitterHandle]);

  return null; // This component doesn't render anything
}
