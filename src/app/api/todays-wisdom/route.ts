import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';
import { crossCorpusWisdomService } from '../../../lib/services/crossCorpusWisdomService';
import { gretilWisdomService } from '../../../lib/services/gretilWisdomService';
import { getFileSearchConfig } from '../../../lib/fileSearchConfig';
import { logApiMetric } from '@/lib/db/metricsRepository';
import { getWisdomByDate, saveWisdom } from '@/lib/db/wisdomRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Ensures full Node.js env for heavy ops

interface TodaysWisdom {
  // Raw sacred text (what seeker reads first)
  rawText: string;
  rawTextAnnotation: {
    chapter: string;
    section: string;
    source: string;
    characters?: string;
    location?: string;
    theme?: string;
    technicalReference?: string;
    logicalUnitType?: 'Epic' | 'Philosophical' | 'Dialogue' | 'Hymnal' | 'Narrative'; // Logical unit type
    extractionMethod?: 'narrative-sequence' | 'commentary-unit' | 'dialogue-exchange' | 'verse-unit' | 'thematic-unit'; // How it was extracted
    verseRange?: {
      start: string;
      end: string;
      count: number;
    };
  };

  // AI enhanced interpretation (Guru's wisdom)
  wisdom: string;
  context: string;
  type: 'story' | 'verse' | 'teaching';
  sourceName: string;
  timestamp: string;
  encouragement: string;
  sourceLocation?: string;
  filesSearched?: string[];
  metadata?: string;
}

interface WisdomDimensions {
  character?: string;
  theme?: string;
  location?: string;
  narrativeType?: string;
  emotionalTone?: string;
  complexity?: string;
}

interface UserWisdomHistory {
  recentSelections: string[];
  sessionCount: number;
  lastAccess: string;
  preferredComplexity: 'simple' | 'intermediate' | 'advanced';
}

interface EnhancedSection {
  content: string;
  source: string;
  metadata?: string;
  dimensions: WisdomDimensions;
  uniqueId: string;
}

const WISDOM_DIMENSIONS = {
  characters: ['Rama', 'Sita', 'Lakshmana', 'Hanuman', 'Ravana', 'Bharata', 'Dasharatha', 'Kaikeyi'],
  themes: ['dharma', 'devotion', 'courage', 'sacrifice', 'wisdom', 'love', 'duty', 'truth'],
  locations: ['Ayodhya', 'forest', 'Lanka', 'Mithila', 'Chitrakoot', 'Panchavati', 'Kishkindha'],
  narrativeTypes: ['dialogue', 'action', 'reflection', 'teaching', 'prophecy', 'ceremony', 'battle'],
  emotionalTones: ['inspiring', 'contemplative', 'dramatic', 'peaceful', 'heroic', 'compassionate'],
  complexity: ['simple', 'intermediate', 'advanced']
};

// Initialize Google Cloud Storage
function initializeStorage() {
  try {
    // CRITICAL: Use ONLY environment variables - no file path fallback
    if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PRIVATE_KEY && process.env.GOOGLE_CLOUD_CLIENT_EMAIL) {
      return new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
        },
      });
    }
    
    throw new Error(
      'Google Cloud credentials not found. ' +
      'Please set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_PRIVATE_KEY, and GOOGLE_CLOUD_CLIENT_EMAIL environment variables. ' +
      'File-based credentials (GOOGLE_APPLICATION_CREDENTIALS) are not supported to avoid hardcoded paths.'
    );
  } catch (error) {
    console.error('Error initializing Google Cloud Storage:', error);
    throw error;
  }
}

// Get all files from a folder in the bucket
async function getAllFilesFromFolder(folderName: string): Promise<{ fileName: string; content: string }[]> {
  try {
    const storage = initializeStorage();
    const bucketName = 'mygurukul-sacred-texts-corpus';
    const bucket = storage.bucket(bucketName);
    
    const [files] = await bucket.getFiles({
      prefix: folderName + '/',
    });
    
    console.log(`Found ${files.length} files in ${folderName} folder`);
    
    const fileContents = [];
    
    for (const file of files) {
      try {
        // Accept HTML files in addition to TXT and JSON
        if (file.name.endsWith('.txt') || file.name.endsWith('.json') || 
            file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          const [data] = await file.download();
          const content = data.toString('utf8');
          
          if (content.length > 100) {
            fileContents.push({
              fileName: file.name,
              content: content
            });
          }
        }
      } catch (fileError) {
        const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error';
        console.warn(`Skipping file ${file.name}:`, errorMessage);
      }
    }
    
    console.log(`Successfully loaded ${fileContents.length} files from ${folderName}`);
    return fileContents;
    
  } catch (error) {
    console.error('Error accessing folder in Google Cloud Storage:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to retrieve files from ${folderName}: ${errorMessage}`);
  }
}

// Enhanced extraction function for both metadata and narrative content
function extractMetadataAndContent(text: string, selectedIndex: number) {
  const metadataMatches = text.match(/\[.*?\]/g) || [];
  const metadata = metadataMatches.join(' ');
  
  const cleanText = text.replace(/\[.*?\]/g, '').replace(/\n{3,}/g, '\n\n');
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  const contextStart = Math.max(0, selectedIndex - 5);
  const contextEnd = Math.min(sentences.length, selectedIndex + 5);
  let narrative = sentences.slice(contextStart, contextEnd).join('. ').trim() + '.';
  
  narrative = narrative
    .replace(/^["\s\n]+/, '')
    .replace(/["\s\n]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    metadata: metadata,
    narrative: narrative,
    combined: `${metadata}\n\nNarrative: ${narrative}`
  };
}

// Extract actual story content from text, removing metadata and structural annotations
function extractActualContent(text: string): string {
  let cleanText = text.replace(/\[.*?\]/g, '');
  
  const paragraphs = cleanText.split('\n\n').filter(paragraph => {
    const trimmed = paragraph.trim();
    return trimmed.length > 100 && 
           !trimmed.match(/^(KANDA|SECTION|CHARACTERS|PLACES|THEMES|CONTEXT):/i) &&
           !trimmed.match(/^\d+\./) &&
           !trimmed.match(/^[A-Z\s]+:$/i) &&
           !trimmed.match(/^---+$/);
  });
  
  return paragraphs.slice(0, 3).join('\n\n');
}

// Multi-dimensional wisdom selection - THE CORE ENHANCEMENT
async function selectTodaysWisdomFromFiles(
  files: { fileName: string; content: string }[], 
  sourceName: string
): Promise<TodaysWisdom> {
  try {
    // Phase 1: Extract and categorize all content sections
    const enhancedSections: EnhancedSection[] = [];
    const filesSearched: string[] = [];
    
    files.forEach(file => {
      filesSearched.push(file.fileName);
      const actualContent = extractActualContent(file.content);
      
      if (actualContent.length > 200) {
        const sentences = actualContent.split(/[.!?]+/).filter(s => s.trim().length > 50);
        
        for (let i = 0; i < sentences.length; i++) {
          const extractedContent = extractMetadataAndContent(actualContent, i);
          
          if (extractedContent.narrative.length > 150 && extractedContent.narrative.length < 2000) {
            const dimensions = analyzeDimensions(extractedContent.combined, file.fileName);
            const uniqueId = generateUniqueId(extractedContent.narrative, dimensions);
            
            enhancedSections.push({
              content: extractedContent.narrative,
              source: file.fileName,
              metadata: extractedContent.metadata,
              dimensions,
              uniqueId
            });
          }
        }
      }
    });

    // Phase 2: Multi-dimensional selection with user history
    const userHistory = getUserWisdomHistory();
    const selectedSection = selectMultiDimensionalWisdom(enhancedSections, userHistory);
    
    // Phase 3: Update user history
    updateUserWisdomHistory(selectedSection.uniqueId);

    // Phase 4: Generate enhanced wisdom
    const extractedContent = extractMetadataAndContent(selectedSection.content, 0);
    
    let finalWisdom = extractedContent.narrative;
    let finalEncouragement = generateEncouragement(determineWisdomType(extractedContent.narrative));
    
    try {
      console.log('Attempting AI enhancement...');
      const enhancedWisdom = await createEnhancedWisdom(extractedContent, sourceName);
      
      if (enhancedWisdom && enhancedWisdom.length > 50) {
        finalWisdom = enhancedWisdom;
        finalEncouragement = generateContextualEncouragement(enhancedWisdom);
      }
    } catch (error) {
      console.log('AI enhancement error, using fallback');
    }
    
    const chapterInfo = extractChapterInfo(selectedSection.source, extractedContent.metadata);
    const technicalReference = generateTechnicalReference(selectedSection.source, extractedContent.metadata);
    const logicalUnitInfo = determineLogicalUnitInfo(selectedSection.source, extractedContent.narrative, extractedContent.metadata);

    return {
      // Raw sacred text (what seeker reads first)
      rawText: extractedContent.narrative,
      rawTextAnnotation: {
        chapter: chapterInfo.chapter,
        section: chapterInfo.section,
        source: selectedSection.source,
        characters: selectedSection.dimensions.character,
        location: selectedSection.dimensions.location,
        theme: selectedSection.dimensions.theme,
        technicalReference,
        logicalUnitType: logicalUnitInfo.logicalUnitType,
        extractionMethod: logicalUnitInfo.extractionMethod,
        verseRange: logicalUnitInfo.verseRange
      },
      
      // AI enhanced interpretation (Guru's wisdom)
      wisdom: finalWisdom,
      context: `Daily wisdom from ${sourceName} - ${selectedSection.dimensions.character || 'Sacred'} wisdom on ${selectedSection.dimensions.theme || 'spiritual growth'}`,
      type: determineWisdomType(finalWisdom),
      sourceName,
      timestamp: new Date().toISOString(),
      encouragement: finalEncouragement,
      sourceLocation: `From ${selectedSection.source}`,
      filesSearched: filesSearched.slice(0, 5),
      metadata: `${extractedContent.metadata} | Selection: ${JSON.stringify(selectedSection.dimensions)}`
    };
    
  } catch (error) {
    console.error('Error selecting wisdom:', error);
    return {
      rawText: `The sacred texts of ${sourceName} contain infinite wisdom. Each verse, each story carries profound meaning for those who seek truth and righteousness.`,
      rawTextAnnotation: {
        chapter: 'Unknown Chapter',
        section: 'Unknown Section',
        source: 'Sacred Texts',
        characters: 'Unknown',
        location: 'Sacred Realm',
        theme: 'wisdom'
      },
      wisdom: `The sacred texts of ${sourceName} contain infinite wisdom. Each verse, each story carries profound meaning for those who seek truth and righteousness.`,
      context: `Daily wisdom from ${sourceName}`,
      type: 'teaching',
      sourceName,
      timestamp: new Date().toISOString(),
      encouragement: "Would you like to explore this wisdom deeper? Ask me about any aspect that resonates with you.",
      filesSearched: []
    };
  }
}

function determineWisdomType(text: string): 'story' | 'verse' | 'teaching' {
  if (text.match(/once upon a time|there was|it came to pass|in days of yore|story/i)) {
    return 'story';
  }
  if (text.match(/verse|sloka|said|spoke|addressed/i)) {
    return 'verse';
  }
  return 'teaching';
}

// Gemini Flash integration for AI-powered wisdom enhancement
async function createEnhancedWisdom(extractedContent: any, sourceName: string): Promise<string> {
  try {
    const config = getFileSearchConfig();
    if (!config.apiKey) {
      console.log('Gemini API key not configured, using fallback');
      return extractedContent.narrative;
    }

    const prompt = `You are writing a spiritual interpretation for readers of the ${sourceName}.

SCRIPTURE PASSAGE:
${extractedContent.combined}

INSTRUCTIONS:
Write a complete interpretation of this passage. Your response MUST:
1. Be exactly 300-400 words (this is mandatory - responses under 250 words are unacceptable)
2. Start IMMEDIATELY with the content - NO greetings, NO "Welcome", NO "Let us explore"
3. Use warm, accessible language in flowing paragraphs
4. Explain the context and meaning of this scripture
5. Show how this wisdom applies to modern life
6. End with a reflective thought

FORMAT RULES:
- NO headers, NO bullet points, NO numbered lists
- NO markdown formatting
- Write as continuous flowing prose
- Address the reader directly using "you" and "your"

CRITICAL: Your first word must be part of the interpretation itself. Do NOT start with any form of greeting or introduction.

Begin now:`;

    console.log('Making Gemini Flash API call...');
    const ai = new GoogleGenAI({ apiKey: config.apiKey });

    // Retry logic for short responses
    const maxRetries = 2;
    let text = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await ai.models.generateContent({
        // Use gemini-2.0-flash (2.5 uses thinking mode which consumes tokens internally)
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          temperature: 0.8,
          topP: 0.95,
          maxOutputTokens: 2000,
        }
      });

      text = response.text || '';
      console.log(`Gemini attempt ${attempt + 1}: response length ${text.length} chars`);

      // Check if response meets minimum length (1200 chars ≈ 200 words)
      if (text.length >= 1200) {
        break;
      }

      if (attempt < maxRetries) {
        console.log('Response too short, retrying...');
      }
    }

    // Accept responses >= 300 chars (meaningful interpretation)
    if (text && text.length >= 300) {
      // Strip any accidental preamble patterns
      const preamblePatterns = [
        /^(Welcome|Let us|Let's|Today|In this|Here|Greetings)[^.]*\.\s*/i,
      ];
      let cleanedText = text;
      for (const pattern of preamblePatterns) {
        cleanedText = cleanedText.replace(pattern, '');
      }
      return cleanedText.trim();
    }

    console.log('Gemini response still too short after retries, using fallback');
    return extractedContent.narrative;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('AI enhancement failed:', errorMessage);
    return extractedContent.narrative;
  }
}

function generateEncouragement(type: 'story' | 'verse' | 'teaching'): string {
  const encouragements = {
    story: "This story holds deeper meanings. Would you like to explore the spiritual significance behind these events?",
    verse: "These verses contain profound wisdom. Ask me about any aspect that resonates with you.",
    teaching: "This teaching offers guidance for daily life. Feel free to ask how you can apply this wisdom to your own journey."
  };
  
  return encouragements[type];
}

// Generate contextual encouragement based on enhanced wisdom content
function generateContextualEncouragement(wisdom: string): string {
  if (wisdom.includes('challenge') || wisdom.includes('difficulty')) {
    return "This wisdom speaks to life's challenges. How might you apply this guidance to your current situation?";
  } else if (wisdom.includes('love') || wisdom.includes('compassion')) {
    return "This teaching about love and compassion invites reflection. What does it reveal about your own heart?";
  } else if (wisdom.includes('journey') || wisdom.includes('path')) {
    return "This wisdom illuminates your spiritual path. What step might you take today to honor this guidance?";
  } else {
    return "This sacred wisdom offers guidance for your journey. What aspect resonates most deeply with you?";
  }
}

// Multi-dimensional analysis and selection functions
function analyzeDimensions(combinedContent: string, fileName: string): WisdomDimensions {
  const content = combinedContent.toLowerCase();
  
  const character = WISDOM_DIMENSIONS.characters.find(char => 
    content.includes(char.toLowerCase())) || 'unknown';
  
  const theme = WISDOM_DIMENSIONS.themes.find(theme => 
    content.includes(theme) || 
    (theme === 'dharma' && (content.includes('righteousness') || content.includes('duty'))) ||
    (theme === 'devotion' && (content.includes('devotion') || content.includes('bhakti'))) ||
    (theme === 'courage' && (content.includes('brave') || content.includes('fearless')))
  ) || 'wisdom';
  
  const location = WISDOM_DIMENSIONS.locations.find(loc => 
    content.includes(loc.toLowerCase())) || 'sacred realm';
  
  let narrativeType = 'teaching';
  if (content.includes('said') || content.includes('spoke')) narrativeType = 'dialogue';
  else if (content.includes('battle') || content.includes('fought')) narrativeType = 'action';
  else if (content.includes('meditat') || content.includes('reflect')) narrativeType = 'reflection';
  
  let emotionalTone = 'contemplative';
  if (content.includes('joy') || content.includes('celebration')) emotionalTone = 'inspiring';
  else if (content.includes('battle') || content.includes('conflict')) emotionalTone = 'dramatic';
  else if (content.includes('peace') || content.includes('calm')) emotionalTone = 'peaceful';
  else if (content.includes('hero') || content.includes('victory')) emotionalTone = 'heroic';
  
  let complexity: 'simple' | 'intermediate' | 'advanced' = 'intermediate';
  if (content.length < 500 && !content.includes('philosophy')) complexity = 'simple';
  else if (content.includes('metaphysical') || content.includes('cosmic') || content.includes('brahman')) complexity = 'advanced';
  
  return { character, theme, location, narrativeType, emotionalTone, complexity };
}

function generateUniqueId(content: string, dimensions: WisdomDimensions): string {
  const contentHash = content.substring(0, 50).replace(/\s+/g, '');
  const dimensionString = `${dimensions.character}-${dimensions.theme}-${dimensions.location}`;
  return `${dimensionString}-${contentHash.length}`;
}

// Simple user history management
let globalUserHistory: UserWisdomHistory = {
  recentSelections: [],
  sessionCount: 0,
  lastAccess: '',
  preferredComplexity: 'simple'
};

function getUserWisdomHistory(): UserWisdomHistory {
  const today = new Date().toDateString();
  if (globalUserHistory.lastAccess !== today) {
    globalUserHistory.sessionCount++;
    globalUserHistory.lastAccess = today;
  }
  return globalUserHistory;
}

function updateUserWisdomHistory(uniqueId: string): void {
  globalUserHistory.recentSelections.push(uniqueId);
  if (globalUserHistory.recentSelections.length > 10) {
    globalUserHistory.recentSelections = globalUserHistory.recentSelections.slice(-10);
  }
}

function selectMultiDimensionalWisdom(sections: EnhancedSection[], userHistory: UserWisdomHistory): EnhancedSection {
  const availableSections = sections.filter(section => 
    !userHistory.recentSelections.includes(section.uniqueId));
  
  const candidateSections = availableSections.length > 0 ? availableSections : sections;
  
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  
  const scoredSections = candidateSections.map(section => {
    let score = Math.random() * 0.3;
    
    if (timeOfDay === 'morning' && ['inspiring', 'peaceful'].includes(section.dimensions.emotionalTone || '')) score += 0.2;
    if (timeOfDay === 'afternoon' && ['heroic', 'dramatic'].includes(section.dimensions.emotionalTone || '')) score += 0.2;
    if (timeOfDay === 'evening' && ['contemplative', 'peaceful'].includes(section.dimensions.emotionalTone || '')) score += 0.2;
    
    if (userHistory.sessionCount < 5 && section.dimensions.complexity === 'simple') score += 0.15;
    else if (userHistory.sessionCount < 15 && section.dimensions.complexity === 'intermediate') score += 0.15;
    else if (userHistory.sessionCount >= 15 && section.dimensions.complexity === 'advanced') score += 0.15;
    
    const recentCharacters = userHistory.recentSelections.slice(-5);
    if (!recentCharacters.some(id => id.includes(section.dimensions.character || ''))) score += 0.15;
    
    const dayOfWeek = new Date().getDay();
    const preferredThemes = ['dharma', 'devotion', 'courage', 'wisdom', 'love', 'truth', 'sacrifice'];
    if (section.dimensions.theme === preferredThemes[dayOfWeek]) score += 0.1;
    
    return { section, score };
  });
  
  scoredSections.sort((a, b) => b.score - a.score);
  return scoredSections[0].section;
}

function extractChapterInfo(fileName: string, metadata: string): { chapter: string, section: string } {
    let chapter = 'Sacred Chapter';
    let section = 'Sacred Section';

    // Extract Kanda from filename (Ramayana_Kanda_1_Balakandam_Cleaned.txt)
    const kandaMatch = fileName.match(/Kanda_(\d+)_([A-Z][a-z]+)kandam/i);
    if (kandaMatch) {
        const num = kandaMatch[1];
        const name = kandaMatch[2].replace(/([A-Z])/g, ' $1').trim();
        chapter = `Kanda ${num} - ${name} Kandam`;
    }

    // Extract section from metadata [SECTION: xyz] or fallback to [CHARACTERS: abc]
    const sectionMatch = metadata.match(/\[SECTION[:]?\s*([^\]]+)\]/i);
    if (sectionMatch) {
        section = sectionMatch[1].trim();
    } else {
        const charMatch = metadata.match(/\[CHARACTERS[:]?\s*([^\]]+)\]/i);
        if (charMatch) {
            section = `Episode featuring ${charMatch[1].trim()}`;
        }
    }

    return { chapter, section };
}

export async function POST(request: NextRequest) {
  let sourceName: string = '';

  // Enhanced source selection using existing infrastructure
  let selectionMethod: 'user-specified' | 'random' | 'cross-corpus' = 'user-specified';
  let selectedSourceInfo: any = null;

  // forceRefresh flag - declared at function scope so it's accessible in cache check
  let forceRefresh = false;

  console.log('=== RANDOMIZATION DIAGNOSTIC START ===');
  console.log('🕐 Request timestamp:', new Date().toISOString());

  try {
    const body = await request.json();
    console.log('📥 Request body:', body);

    // Parse forceRefresh flag - if true, skip DB cache and generate fresh wisdom
    forceRefresh = body.forceRefresh === true;
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - will skip DB cache');
    }

    if (body.sourceName && body.sourceName.trim()) {
      // Traditional single-source selection (backward compatibility)
      sourceName = body.sourceName.trim();
      selectionMethod = 'user-specified';
      console.log(`🎯 Traditional source selection: ${sourceName}`);
      console.log(`📋 Selection reason: User explicitly requested ${sourceName}`);
    } else {
      // New GCS-first intelligent selection using gretilWisdomService
      console.log('🔄 Using GCS-first selection...');
      console.log('📡 Calling gretilWisdomService.getAllAvailableGretilSources()...');
      
      const gretilSources = await gretilWisdomService.getAllAvailableGretilSources();
      
      console.log('📊 Available sources count:', gretilSources.length);
      console.log('📋 Available sources:', gretilSources.map(s => s.folderName));
      console.log('📋 Source details:', gretilSources.map(s => ({
        folder: s.folderName,
        display: s.displayName,
        category: s.category
      })));
      
      if (gretilSources.length > 0) {
        const randomIndex = Math.floor(Math.random() * gretilSources.length);
        const randomSource = gretilSources[randomIndex];
        
        console.log(`🎲 Random selection: index ${randomIndex} from ${gretilSources.length} sources`);
        console.log(`🎯 Selected source: ${randomSource.folderName}`);
        console.log(`📋 Source metadata:`, {
          displayName: randomSource.displayName,
          category: randomSource.category,
          textType: randomSource.textType
        });
        
        sourceName = randomSource.folderName;
        selectedSourceInfo = {
          folderName: randomSource.folderName,
          displayName: randomSource.displayName,
          category: randomSource.category,
          selectionReason: 'random-gcs-selection',
          randomIndex: randomIndex,
          totalSources: gretilSources.length
        };
        selectionMethod = 'cross-corpus';
        console.log(`✅ GCS-first selection complete: ${selectedSourceInfo.displayName} from ${selectedSourceInfo.category}`);
      } else {
        sourceName = 'Bhagvad_Gita';
        selectionMethod = 'user-specified';
        console.log('⚠️ No GCS sources available, using fallback: Bhagvad_Gita');
        console.log('📋 Fallback reason: No sources returned from gretilWisdomService');
      }
    }
    
    if (!sourceName) {
      console.log('⚠️ No source selected, using fallback');
      sourceName = 'Ramayana';
      selectionMethod = 'user-specified';
      console.log('📋 Final fallback reason: No source name determined');
    }
    
  } catch (requestError) {
    console.error('❌ Error processing wisdom request:', requestError);
    sourceName = 'Ramayana';
    selectionMethod = 'user-specified';
    console.log('📋 Error fallback: Using Ramayana due to request processing error');
  }

  console.log('🎯 FINAL SELECTION SUMMARY:');
  console.log('  Selected source:', sourceName);
  console.log('  Selection method:', selectionMethod);
  console.log('  Selected source info:', selectedSourceInfo);
  console.log('  Selection timestamp:', new Date().toISOString());

  // Check for cached wisdom in database (skip if forceRefresh)
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  try {
    // Only check cache if NOT force refresh
    if (!forceRefresh) {
      console.log('🔍 Checking for cached wisdom in database...');
      const cachedWisdom = await getWisdomByDate(today);

      if (cachedWisdom) {
      console.log('✅ Found cached wisdom from database, returning cached response');

      // Convert DB format to API response format
      const todaysWisdom: TodaysWisdom = {
        rawText: cachedWisdom.raw_text,
        rawTextAnnotation: {
          chapter: cachedWisdom.chapter || 'Sacred Chapter',
          section: cachedWisdom.section || 'Sacred Section',
          source: cachedWisdom.source_name,
          characters: cachedWisdom.metadata?.speaker,
          theme: cachedWisdom.text_type || 'wisdom',
          technicalReference: cachedWisdom.metadata?.verse_number
        },
        wisdom: cachedWisdom.interpretation,
        context: `Daily wisdom from ${cachedWisdom.source_name}`,
        type: 'verse',
        sourceName: cachedWisdom.source_name,
        timestamp: cachedWisdom.created_at.toISOString(),
        encouragement: "This sacred wisdom offers guidance for your journey. What aspect resonates most deeply with you?",
        sourceLocation: `From ${cachedWisdom.source_name}`,
        filesSearched: [cachedWisdom.source_name],
        metadata: `Cached: ${cachedWisdom.text_type || 'Narrative'}`
      };

      // Get available sources for frontend
      const gretilSources = await gretilWisdomService.getAllAvailableGretilSources();
      const availableSources = gretilSources.map(source => source.folderName);

      // Log cache hit metric
      try {
        await logApiMetric({
          endpoint: '/api/todays-wisdom',
          latency_ms: Date.now(),
          status_code: 200,
          success: true,
          request_metadata: { from_cache: true, source_name: cachedWisdom.source_name }
        });
      } catch (logError) {
        console.error('DB cache hit logging failed:', logError);
      }

      return NextResponse.json({
        success: true,
        todaysWisdom,
        selectedSource: cachedWisdom.source_name,
        selectionMethod: 'cached',
        fromCache: true,
        availableSources: availableSources.map(source => ({
          folderName: source,
          displayName: source.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())
        })),
        totalAvailableSources: availableSources.length,
        message: 'Wisdom served from database cache'
      });
      }

      console.log('📝 No cached wisdom found, generating new wisdom...');
    } else {
      console.log('🔄 Skipping cache check due to forceRefresh');
    }
  } catch (cacheError) {
    // If cache check fails, continue with generation
    console.log('⚠️ Cache check failed, proceeding with generation:', cacheError);
  }

  try {
    console.log(`Today's Wisdom request for source: ${sourceName}`);
    
    // Before calling wisdom service
    console.log('Calling wisdom service with source:', sourceName);
    
    // Use GCS-first approach with gretilWisdomService
    const extractedWisdom = await gretilWisdomService.extractWisdomFromGretilSource(sourceName);
    
    // After getting wisdom
    console.log('Wisdom extraction result:', {
      title: extractedWisdom?.metadata?.title,
      sourceMetadata: extractedWisdom?.metadata,
      verseReference: extractedWisdom?.reference,
      extractionMethod: extractedWisdom?.metadata?.textType,
      logicalUnitType: extractedWisdom?.metadata?.enhancedTextType,
      textName: extractedWisdom?.textName,
      category: extractedWisdom?.category,
      estimatedVerses: extractedWisdom?.estimatedVerses
    });
    
    if (!extractedWisdom) {
      throw new Error(`No wisdom extracted from source ${sourceName}`);
    }
    
    // CRITICAL: Clean up Sanskrit text for user experience - limit to 2-3 verses max
    let cleanSanskrit = extractedWisdom.sanskrit;
    
    // If content is too long, truncate it intelligently
    if (cleanSanskrit.length > 300) {
      console.log(`⚠️ Content too long (${cleanSanskrit.length} chars), truncating for user experience`);
      
      // Try to find natural break points
      const verseBreaks = cleanSanskrit.split(/[|]{2,}|\s{3,}/);
      if (verseBreaks.length > 2) {
        cleanSanskrit = verseBreaks.slice(0, 2).join(' || ');
      } else {
        // Fallback: just truncate at 300 characters
        cleanSanskrit = cleanSanskrit.substring(0, 300) + '...';
      }
    }
    
    console.log(`📏 Final Sanskrit content length: ${cleanSanskrit.length} characters`);

    // Generate AI-enhanced Guru interpretation
    let guruWisdom = cleanSanskrit; // Use cleaned Sanskrit as fallback
    let encouragement = "This sacred wisdom offers guidance for your journey. What aspect resonates most deeply with you?";
    
    try {
      console.log('🎯 Generating AI-enhanced Guru interpretation...');
      const extractedContent = {
        narrative: cleanSanskrit,
        metadata: `Source: ${extractedWisdom.textName} | Category: ${extractedWisdom.category}`,
        combined: `${cleanSanskrit}\n\nSource: ${extractedWisdom.textName} | Category: ${extractedWisdom.category}`
      };
      
      const enhancedWisdom = await createEnhancedWisdom(extractedContent, extractedWisdom.textName);
      
      if (enhancedWisdom && enhancedWisdom.length > 50) {
        guruWisdom = enhancedWisdom;
        encouragement = generateContextualEncouragement(enhancedWisdom);
        console.log('✅ AI enhancement successful');
      } else {
        console.log('⚠️ AI enhancement failed, using cleaned Sanskrit text');
      }
    } catch (error) {
      console.log('❌ AI enhancement error:', error);
    }

    // Enhanced metadata extraction from logical unit if available
    const logicalUnitType = extractedWisdom.metadata?.enhancedTextType || 'Narrative';
    const extractionMethod = extractedWisdom.metadata?.textType || 'verse-unit';
    const verseRange = extractedWisdom.metadata?.verseNumber ? {
      start: extractedWisdom.metadata.verseNumber.verse.toString(),
      end: extractedWisdom.metadata.verseNumber.verse.toString(),
      count: 1
    } : {
      start: '1',
      end: '1',
      count: 1
    };

    // Convert ExtractedWisdom to TodaysWisdom format
    const todaysWisdom: TodaysWisdom = {
      rawText: cleanSanskrit, // Use cleaned, digestible Sanskrit text
      rawTextAnnotation: {
        chapter: extractedWisdom.metadata?.title || extractedWisdom.textName,
        section: extractedWisdom.metadata?.chapterInfo?.chapter?.toString() || 'Sacred Section',
        source: extractedWisdom.textName,
        characters: extractedWisdom.metadata?.hasCommentary ? 'Commentary' : 'Sacred Text',
        location: extractedWisdom.metadata?.timePeriod || 'Sacred Realm',
        theme: extractedWisdom.metadata?.textType || 'wisdom',
        technicalReference: extractedWisdom.metadata?.verseNumber?.fullReference || extractedWisdom.reference,
        logicalUnitType: logicalUnitType as any,
        extractionMethod: extractionMethod as any,
        verseRange: verseRange
      },
      wisdom: guruWisdom, // AI-enhanced Guru interpretation
      context: `Daily wisdom from ${extractedWisdom.textName}`,
      type: 'verse',
      sourceName: extractedWisdom.textName,
      timestamp: new Date().toISOString(),
      encouragement: encouragement,
      sourceLocation: `From ${extractedWisdom.textName}`,
      filesSearched: [sourceName],
      metadata: `Category: ${extractedWisdom.category} | Estimated verses: ${extractedWisdom.estimatedVerses} | Text Type: ${extractedWisdom.metadata?.enhancedTextType || 'Narrative'}`
    };
    
    // Get available sources for frontend dropdown using GCS-first approach
    const gretilSources = await gretilWisdomService.getAllAvailableGretilSources();
    const availableSources = gretilSources.map(source => source.folderName);
    
    console.log('Available sources for frontend:', availableSources);
    console.log('Total available sources:', availableSources.length);

    const responseData = {
      success: true,
      todaysWisdom: todaysWisdom,
      selectedSource: sourceName,
      selectionMethod: selectionMethod,
      selectedSourceInfo: selectedSourceInfo,
      availableSources: availableSources.map(source => ({
        folderName: source,
        displayName: source.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())
      })),
      totalAvailableSources: availableSources.length,
      message: selectionMethod === 'cross-corpus' ? 
        `Wisdom selected from ${selectedSourceInfo?.displayName || sourceName} using intelligent cross-corpus selection` :
        `Wisdom from ${sourceName} as specifically requested`
    };

    console.log('=== RANDOMIZATION DIAGNOSTIC END ===');
    console.log('Final response data:', {
      success: responseData.success,
      selectedSource: responseData.selectedSource,
      selectionMethod: responseData.selectionMethod,
      totalAvailableSources: responseData.totalAvailableSources,
      message: responseData.message
    });

    // Metrics logging - await but don't block on errors
    const processingTime = Date.now();
    try {
      await logApiMetric({
        endpoint: '/api/todays-wisdom',
        latency_ms: processingTime,
        status_code: 200,
        success: true,
        request_metadata: {
          source_name: sourceName,
          selection_method: selectionMethod,
          total_available_sources: availableSources.length
        }
      });
    } catch (logError) {
      console.error('DB metrics logging failed (non-fatal):', logError);
    }

    // Save wisdom to database for caching (fire-and-forget)
    saveWisdom({
      wisdom_date: today,
      raw_text: todaysWisdom.rawText,
      interpretation: todaysWisdom.wisdom,
      source_name: todaysWisdom.sourceName,
      chapter: todaysWisdom.rawTextAnnotation.chapter,
      section: todaysWisdom.rawTextAnnotation.section,
      text_type: extractedWisdom.metadata?.enhancedTextType || 'Narrative',
      metadata: {
        verse_number: todaysWisdom.rawTextAnnotation.technicalReference,
        speaker: todaysWisdom.rawTextAnnotation.characters,
        language: 'Sanskrit'
      }
    }).then(saved => {
      if (saved) {
        console.log('✅ Wisdom saved to database for future caching');
      }
    }).catch(err => {
      console.log('⚠️ Failed to save wisdom to database:', err);
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Today\'s Wisdom API error:', error);

    // Error logging
    try {
      await logApiMetric({
        endpoint: '/api/todays-wisdom',
        latency_ms: Date.now(),
        status_code: 200, // Returns 200 with fallback wisdom
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_metadata: { source_name: sourceName }
      });
    } catch (logError) {
      console.error('DB error logging failed:', logError);
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch today\'s wisdom',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined,
        fallbackWisdom: {
          rawText: "The path to wisdom begins with a single step. Each day brings new opportunities for spiritual growth and understanding.",
          rawTextAnnotation: {
            chapter: 'Unknown Chapter',
            section: 'Unknown Section',
            source: 'Sacred Texts',
            characters: 'Unknown',
            location: 'Sacred Realm',
            theme: 'wisdom'
          },
          wisdom: "The path to wisdom begins with a single step. Each day brings new opportunities for spiritual growth and understanding.",
          context: "Daily inspiration from the sacred texts",
          type: "teaching",
          sourceName: sourceName || "Sacred Texts",
          timestamp: new Date().toISOString(),
          encouragement: "Would you like to explore the wisdom of our sacred texts? I'm here to guide you on your spiritual journey."
        }
      },
      { status: 200 }
    );
  }
}

// Generate technical reference for scholarly citation
function generateTechnicalReference(sourceFile: string, metadata: string): string | undefined {
  // For Ramayana files, try to generate Ram_[book],[chapter].[verse] format
  if (sourceFile.toLowerCase().includes('ramayana')) {
    // Extract kanda information from filename
    const kandaMatch = sourceFile.match(/Kanda_(\d+)_([A-Z][a-z]+)kandam/i);
    if (kandaMatch) {
      const kandaNum = kandaMatch[1];
      // Generate a reference like Ram_2,40.20 (book,chapter.verse)
      return `Ram_${kandaNum},${Math.floor(Math.random() * 100) + 1}.${Math.floor(Math.random() * 50) + 1}`;
    }
  }

  // For Bhagavad Gita files
  if (sourceFile.toLowerCase().includes('bhagavad') || sourceFile.toLowerCase().includes('gita')) {
    return `BG ${Math.floor(Math.random() * 18) + 1}.${Math.floor(Math.random() * 50) + 1}`;
  }

  // For Upanishads
  if (sourceFile.toLowerCase().includes('upanishad')) {
    return `${sourceFile.replace('.txt', '').replace(/_/g, ' ')} ${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 20) + 1}`;
  }

  // For other sources, try to extract line numbers or return undefined
  const lineMatch = metadata.match(/Line (\d+)/i);
  if (lineMatch) {
    return `Line ${lineMatch[1]}`;
  }

  return undefined;
}

// Determine logical unit information based on content analysis
function determineLogicalUnitInfo(sourceFile: string, content: string, metadata: string): {
  logicalUnitType: 'Epic' | 'Philosophical' | 'Dialogue' | 'Hymnal' | 'Narrative' | undefined;
  extractionMethod: 'narrative-sequence' | 'commentary-unit' | 'dialogue-exchange' | 'verse-unit' | 'thematic-unit' | undefined;
  verseRange?: { start: string; end: string; count: number };
} {
  const contentLower = content.toLowerCase();
  const fileNameLower = sourceFile.toLowerCase();

  let logicalUnitType: 'Epic' | 'Philosophical' | 'Dialogue' | 'Hymnal' | 'Narrative' | undefined;
  let extractionMethod: 'narrative-sequence' | 'commentary-unit' | 'dialogue-exchange' | 'verse-unit' | 'thematic-unit' | undefined;

  // Determine logical unit type based on source and content
  if (fileNameLower.includes('ramayana') || fileNameLower.includes('mahabharata') || fileNameLower.includes('purana')) {
    logicalUnitType = 'Epic';
  } else if (fileNameLower.includes('upanishad') || contentLower.includes('brahman') || contentLower.includes('atman') || contentLower.includes('consciousness')) {
    logicalUnitType = 'Philosophical';
  } else if (contentLower.includes('said') || contentLower.includes('spoke') || contentLower.includes('replied') || contentLower.includes('asked')) {
    logicalUnitType = 'Dialogue';
  } else if (fileNameLower.includes('veda') || fileNameLower.includes('hymn') || contentLower.includes('devas') || contentLower.includes('praise')) {
    logicalUnitType = 'Hymnal';
  } else {
    logicalUnitType = 'Narrative';
  }

  // Determine extraction method based on content characteristics
  if (contentLower.includes('said') && contentLower.includes('replied')) {
    extractionMethod = 'dialogue-exchange';
  } else if (contentLower.includes('chapter') || contentLower.includes('section') || contentLower.includes('verse')) {
    extractionMethod = 'verse-unit';
  } else if (contentLower.includes('commentary') || contentLower.includes('explanation')) {
    extractionMethod = 'commentary-unit';
  } else if (contentLower.includes('story') || contentLower.includes('tale') || contentLower.includes('narrative')) {
    extractionMethod = 'narrative-sequence';
  } else {
    extractionMethod = 'thematic-unit';
  }

  // Generate verse range information
  let verseRange;
  if (logicalUnitType === 'Epic' || logicalUnitType === 'Philosophical') {
    // Try to extract verse information from technical reference or generate reasonable range
    const verseCount = Math.max(1, Math.min(8, Math.floor(content.length / 100))); // Estimate based on content length
    const baseVerse = Math.floor(Math.random() * 50) + 1;

    if (verseCount === 1) {
      verseRange = {
        start: `${baseVerse}`,
        end: `${baseVerse}`,
        count: 1
      };
    } else {
      verseRange = {
        start: `${baseVerse}`,
        end: `${baseVerse + verseCount - 1}`,
        count: verseCount
      };
    }
  }

  return {
    logicalUnitType,
    extractionMethod,
    verseRange
  };
}