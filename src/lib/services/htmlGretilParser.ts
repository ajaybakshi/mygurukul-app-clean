/**
 * HTML Gretil Parser Service
 * Parses HTML files from GRETIL corpus, extracting clean Sanskrit text
 * while excluding non-scripture content (introductions, metadata, TOC)
 */

import { GretilMetadata, ChapterReference, VerseReference } from './gretilWisdomService';

export interface ParsedHtmlContent {
  headerMetadata: GretilMetadata | null;
  scriptureText: string; // Clean IAST Sanskrit text (ONLY actual scripture content)
  scriptureReferences: ScriptureReference[];
  devanagariText?: string; // Devanagari text if available
}

export interface ScriptureReference {
  reference: string; // e.g., "AP_1.001ab"
  fullReference: string; // e.g., "/AP_1.001ab/"
  position: number; // Character position in text
}

export interface TextSection {
  text: string;
  references: ScriptureReference[];
  isScripture: boolean; // Whether this section contains actual scripture content
}

class HtmlGretilParser {
  // Sanskrit IAST diacritics pattern
  private readonly sanskritIASTPattern = /[āīūṛḷēōṃḥśṣṇṭḍṅñ]/;
  
  // Devanagari Unicode range
  private readonly devanagariPattern = /[\u0900-\u097F]/;
  
  // Non-scripture content indicators
  private readonly nonScriptureKeywords = [
    'introduction',
    'preface',
    'data entry',
    'contribution',
    'publisher',
    'licence',
    'license',
    'creative commons',
    'göttingen',
    'table of contents',
    'toc',
    'header',
    'notes:',
    'revisions:',
    'source:',
    'transformation'
  ];

  /**
   * Find where actual scripture text begins in HTML
   * Looks for markers like <h2>Text</h2> or <div xml:lang="sa-Latn">
   */
  findScriptureStartMarker(htmlContent: string): number {
    const lowerContent = htmlContent.toLowerCase();
    
    // Strategy 1: Look for <h2>Text</h2> marker
    const textHeaderMatch = lowerContent.match(/<h2[^>]*>text<\/h2>/i);
    if (textHeaderMatch && textHeaderMatch.index !== undefined) {
      const startIndex = textHeaderMatch.index + textHeaderMatch[0].length;
      console.log(`✅ Found scripture start marker: <h2>Text</h2> at position ${startIndex}`);
      return startIndex;
    }
    
    // Strategy 2: Look for first <div xml:lang="sa-Latn"> (IAST section)
    const iastDivMatch = htmlContent.match(/<div[^>]*xml:lang=["']sa-Latn["'][^>]*>/i);
    if (iastDivMatch && iastDivMatch.index !== undefined) {
      const startIndex = iastDivMatch.index + iastDivMatch[0].length;
      console.log(`✅ Found scripture start marker: <div xml:lang="sa-Latn"> at position ${startIndex}`);
      return startIndex;
    }
    
    // Strategy 3: Look for first Sanskrit content (IAST diacritics or Devanagari)
    // Skip header sections
    const headerEndMatch = lowerContent.match(/<\/h2>[^<]*<h2[^>]*>text/i);
    if (headerEndMatch && headerEndMatch.index !== undefined) {
      const startIndex = headerEndMatch.index + headerEndMatch[0].indexOf('<h2');
      console.log(`✅ Found scripture start after header at position ${startIndex}`);
      return startIndex;
    }
    
    // Fallback: Find first occurrence of Sanskrit characters after initial HTML structure
    const bodyStartMatch = lowerContent.match(/<body[^>]*>/i);
    if (bodyStartMatch && bodyStartMatch.index !== undefined) {
      const bodyStart = bodyStartMatch.index + bodyStartMatch[0].length;
      const contentAfterBody = htmlContent.substring(bodyStart);
      
      // Look for first Sanskrit content
      for (let i = 0; i < contentAfterBody.length - 100; i++) {
        const chunk = contentAfterBody.substring(i, i + 200);
        if (this.sanskritIASTPattern.test(chunk) || this.devanagariPattern.test(chunk)) {
          // Check if it's not in a header/metadata section
          const beforeChunk = contentAfterBody.substring(Math.max(0, i - 500), i).toLowerCase();
          const hasNonScriptureMarker = this.nonScriptureKeywords.some(keyword => 
            beforeChunk.includes(keyword)
          );
          
          if (!hasNonScriptureMarker) {
            const startIndex = bodyStart + i;
            console.log(`✅ Found scripture start by Sanskrit content detection at position ${startIndex}`);
            return startIndex;
          }
        }
      }
    }
    
    console.log(`⚠️ Could not find scripture start marker, using content from start`);
    return 0;
  }

  /**
   * Check if text contains non-scripture content (introductions, metadata, etc.)
   */
  isNonScriptureContent(text: string): boolean {
    const lowerText = text.toLowerCase().trim();
    
    // Check for non-scripture keywords
    if (this.nonScriptureKeywords.some(keyword => lowerText.includes(keyword))) {
      return true;
    }
    
    // Check if it's mostly English (no Sanskrit characters)
    const hasSanskrit = this.sanskritIASTPattern.test(text) || this.devanagariPattern.test(text);
    if (!hasSanskrit && text.length > 50) {
      // Likely English metadata/intro
      return true;
    }
    
    // Check for copyright/license patterns
    if (lowerText.includes('copyright') || lowerText.includes('all rights reserved')) {
      return true;
    }
    
    // Check for table of contents patterns (numbered lists without Sanskrit)
    if (lowerText.match(/^\d+\s+[a-z]/i) && !hasSanskrit) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract header metadata (for reference, not for wisdom quotes)
   */
  extractHeaderMetadata(htmlContent: string, fileName?: string): GretilMetadata | null {
    try {
      const metadata: Partial<GretilMetadata> = {};
      
      // Extract title from filename if available
      if (fileName) {
        const baseName = fileName.replace(/\.(html|htm)$/i, '').replace(/_/g, ' ');
        metadata.title = baseName;
      }
      
      // Extract metadata from HTML header section
      const headerMatch = htmlContent.match(/<h2[^>]*>header<\/h2>([\s\S]*?)<h2[^>]*>text<\/h2>/i);
      if (headerMatch && headerMatch[1]) {
        const headerContent = headerMatch[1];
        
        // Extract various metadata fields using regex
        const dataEntryMatch = headerContent.match(/data entry[:\s]*([^<\n]+)/i);
        if (dataEntryMatch) metadata.dataEntry = dataEntryMatch[1].trim();
        
        const contributionMatch = headerContent.match(/contribution[:\s]*([^<\n]+)/i);
        if (contributionMatch) metadata.contribution = contributionMatch[1].trim();
        
        const dateMatch = headerContent.match(/date[:\s]*([^<\n]+)/i);
        if (dateMatch) metadata.dateVersion = dateMatch[1].trim();
        
        const sourceMatch = headerContent.match(/source[:\s]*([^<\n]+)/i);
        if (sourceMatch) metadata.source = sourceMatch[1].trim();
        
        const publisherMatch = headerContent.match(/publisher[:\s]*([^<\n]+)/i);
        if (publisherMatch) metadata.publisher = publisherMatch[1].trim();
        
        const licenceMatch = headerContent.match(/licen[cs]e[:\s]*([^<\n]+)/i);
        if (licenceMatch) metadata.licence = licenceMatch[1].trim();
      }
      
      if (!metadata.title) {
        metadata.title = 'Sacred Text';
      }
      
      return metadata as GretilMetadata;
    } catch (error) {
      console.error('Error extracting header metadata:', error);
      return null;
    }
  }

  /**
   * Extract scripture references from text
   * Handles patterns like /AP_1.001ab/ or /AP_1.001/
   */
  extractScriptureReferences(text: string): ScriptureReference[] {
    const references: ScriptureReference[] = [];
    
    // Pattern for references like /AP_1.001ab/ or /AP_1.001/
    const referencePattern = /\/([A-Z][A-Za-z_]+[\d,\.]+[a-z]*)\//g;
    
    let match;
    while ((match = referencePattern.exec(text)) !== null) {
      references.push({
        reference: match[1], // e.g., "AP_1.001ab"
        fullReference: match[0], // e.g., "/AP_1.001ab/"
        position: match.index
      });
    }
    
    return references;
  }

  /**
   * Clean Sanskrit text by removing HTML tags and extracting references
   */
  cleanSanskritText(text: string, preserveReferences: boolean = false): { cleanText: string; references: ScriptureReference[] } {
    // Extract references first
    const references = this.extractScriptureReferences(text);
    
    // Remove HTML tags
    let cleanText = text
      .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Remove reference markers if not preserving
    if (!preserveReferences) {
      cleanText = cleanText.replace(/\/[A-Z][A-Za-z_]+[\d,\.]+[a-z]*\//g, '');
    }
    
    // Clean up whitespace
    cleanText = cleanText
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return { cleanText, references };
  }

  /**
   * Extract text sections from HTML, filtering out non-scripture content
   */
  extractScriptureTextSections(htmlContent: string, startIndex: number): TextSection[] {
    const sections: TextSection[] = [];
    
    // Get content starting from scripture start marker
    const scriptureContent = htmlContent.substring(startIndex);
    
    // Extract all <p> tags that might contain scripture
    const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    
    while ((match = paragraphPattern.exec(scriptureContent)) !== null) {
      const paragraphHtml = match[1];
      const { cleanText, references } = this.cleanSanskritText(paragraphHtml, true);
      
      // Validate that this is actual scripture content
      const hasSanskrit = this.sanskritIASTPattern.test(cleanText) || this.devanagariPattern.test(cleanText);
      const isNonScripture = this.isNonScriptureContent(cleanText);
      
      if (hasSanskrit && !isNonScripture && cleanText.trim().length > 10) {
        sections.push({
          text: cleanText,
          references,
          isScripture: true
        });
      }
    }
    
    // Also extract text from divs with xml:lang="sa-Latn"
    const iastDivPattern = /<div[^>]*xml:lang=["']sa-Latn["'][^>]*>([\s\S]*?)<\/div>/gi;
    while ((match = iastDivPattern.exec(scriptureContent)) !== null) {
      const divContent = match[1];
      const { cleanText, references } = this.cleanSanskritText(divContent, true);
      
      const hasSanskrit = this.sanskritIASTPattern.test(cleanText) || this.devanagariPattern.test(cleanText);
      const isNonScripture = this.isNonScriptureContent(cleanText);
      
      if (hasSanskrit && !isNonScripture && cleanText.trim().length > 10) {
        sections.push({
          text: cleanText,
          references,
          isScripture: true
        });
      }
    }
    
    return sections;
  }

  /**
   * Main parsing method - extracts clean scripture content from HTML
   */
  parseHtmlContent(htmlContent: string, fileName?: string): ParsedHtmlContent {
    console.log(`📖 Parsing HTML content (${htmlContent.length} chars) from ${fileName || 'unknown file'}`);
    
    // Step 1: Extract header metadata (for reference only)
    const headerMetadata = this.extractHeaderMetadata(htmlContent, fileName);
    
    // Step 2: Find where actual scripture begins
    const scriptureStartIndex = this.findScriptureStartMarker(htmlContent);
    
    // Step 3: Extract scripture text sections (ONLY actual scripture content)
    const textSections = this.extractScriptureTextSections(htmlContent, scriptureStartIndex);
    
    console.log(`✅ Found ${textSections.length} scripture text sections`);
    
    // Step 4: Combine all scripture sections into clean text
    const allScriptureText = textSections
      .map(section => section.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Step 5: Extract all references
    const allReferences: ScriptureReference[] = [];
    textSections.forEach(section => {
      allReferences.push(...section.references);
    });
    
    // Step 6: Remove duplicate references
    const uniqueReferences = Array.from(
      new Map(allReferences.map(ref => [ref.reference, ref])).values()
    );
    
    console.log(`✅ Extracted ${uniqueReferences.length} unique scripture references`);
    console.log(`✅ Clean scripture text length: ${allScriptureText.length} characters`);
    
    return {
      headerMetadata,
      scriptureText: allScriptureText,
      scriptureReferences: uniqueReferences
    };
  }
}

export const htmlGretilParser = new HtmlGretilParser();
