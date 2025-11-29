/**
 * Google File Search Configuration
 * Configuration helper for File Search MVP backend
 */

import { GoogleGenAI } from '@google/genai';

export interface FileSearchConfig {
  apiKey: string;
  enabled: boolean;
  maxFileSizeMB: number;
  supportedFileTypes: string[];
  categories: {
    vedas: string;
    upanishads: string;
    darshanas: string;
    epics: string;
    yoga: string;
    sastras: string;
  };
}

/**
 * Get File Search configuration from environment variables
 */
export function getFileSearchConfig(): FileSearchConfig {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || '';
  
  if (!apiKey) {
    console.warn('⚠️  GOOGLE_GENAI_API_KEY not set in environment');
  }

  return {
    apiKey,
    enabled: process.env.FILE_SEARCH_ENABLED === 'true',
    maxFileSizeMB: 100, // Google File Search limit
    supportedFileTypes: [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    categories: {
      vedas: 'gurukul-vedas',
      upanishads: 'gurukul-upanishads',
      darshanas: 'gurukul-darshanas',
      epics: 'gurukul-epics',
      yoga: 'gurukul-yoga',
      sastras: 'gurukul-sastras'
    }
  };
}

/**
 * Validate File Search configuration
 */
export function validateFileSearchConfig(config: FileSearchConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push('GOOGLE_GENAI_API_KEY is required');
  }

  if (!config.enabled) {
    errors.push('FILE_SEARCH_ENABLED must be set to "true"');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get category display names
 */
export function getCategoryDisplayName(category: keyof FileSearchConfig['categories']): string {
  const displayNames = {
    vedas: 'Vedas',
    upanishads: 'Upanishads',
    darshanas: 'Darshanas (Philosophical Systems)',
    epics: 'Epics',
    yoga: 'Yoga',
    sastras: 'Sastras'
  };
  return displayNames[category] || category;
}

/**
 * Get Google GenAI Client instance
 * Helper to initialize the client for File Search operations
 */
export function getGenAIClient(): GoogleGenAI {
  const config = getFileSearchConfig();
  
  if (!config.apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY is not configured. Please set it in your .env.local file.');
  }
  
  return new GoogleGenAI({ apiKey: config.apiKey });
}

