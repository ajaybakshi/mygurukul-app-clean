/**
 * File Search Wisdom Query Endpoint
 * Main API for querying wisdom from File Search stores
 * Compatible with existing Spiritual Guidance frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFileSearchConfig } from '../../../../lib/fileSearchConfig';
import { buildChatHistory, formatHistoryForLogging } from '../../../../lib/services/fileSearchChatHistory';

interface WisdomRequest {
  question: string;
  sessionId?: string;
  category?: 'vedas' | 'upanishads' | 'darshanas' | 'epics' | 'yoga' | 'sastras' | 'all';
  conversationHistory?: Array<{sender: 'user' | 'ai', text: string}>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_GENAI_API_KEY not configured',
        help: 'Please check FILE_SEARCH_SETUP_GUIDE.md'
      }, { status: 500 });
    }

    // Parse request
    const body: WisdomRequest = await request.json();
    const { question, sessionId, category = 'all', conversationHistory } = body;

    if (!question || question.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Question is required'
      }, { status: 400 });
    }

    console.log(`🔍 File Search Query: "${question.substring(0, 100)}..."`);
    console.log(`📚 Category: ${category}`);
    console.log(`💬 Conversation History: ${conversationHistory ? conversationHistory.length + ' messages' : 'None (new conversation)'}`);

    // Initialize client to discover stores
    const client = new GoogleGenAI({ apiKey: config.apiKey });
    const storesPager = await client.fileSearchStores.list();
    
    // Convert pager to array
    const allStores = [];
    for await (const store of storesPager) {
      allStores.push(store);
    }

    if (allStores.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No File Search stores found. Please create stores and upload documents first.',
        help: 'Visit /admin/file-search-upload to set up stores'
      }, { status: 404 });
    }

    // Filter stores based on category
    let targetStores = allStores;
    if (category !== 'all') {
      targetStores = allStores.filter((store: any) => 
        store.displayName?.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (targetStores.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No stores found for category: ${category}`,
        availableStores: allStores.map((s: any) => ({
          name: s.name,
          displayName: s.displayName
        }))
      }, { status: 404 });
    }

    // Google API limit: Max 5 corpora per request
    // If category is 'all' and we have more than 5 stores, limit to first 5
    const MAX_STORES_PER_REQUEST = 5;
    if (targetStores.length > MAX_STORES_PER_REQUEST) {
      console.log(`⚠️  Limiting stores from ${targetStores.length} to ${MAX_STORES_PER_REQUEST} (Google API limit)`);
      targetStores = targetStores.slice(0, MAX_STORES_PER_REQUEST);
    }

    const fileSearchStoreNames = targetStores.map((store: any) => store.name);
    
    console.log(`📖 Searching ${fileSearchStoreNames.length} stores:`, fileSearchStoreNames);
    
    // Log store details for debugging
    for (const store of targetStores) {
      console.log(`  📚 Store: ${store.displayName}`);
      console.log(`     ID: ${store.name}`);
      console.log(`     Documents (metadata): ${(store as any).documentCount || 0}`);
      console.log(`     Updated: ${store.updateTime}`);
    }
      
    // IMPORTANT: Don't block on documentCount - it may not update immediately due to eventual consistency
    // Trust that if stores exist, documents can be queried
    const totalDocs = targetStores.reduce((sum: number, store: any) => sum + (store.documentCount || 0), 0);
    console.log(`📊 Total documents (from metadata): ${totalDocs}`);
    console.log(`⚠️  Note: documentCount may be stale due to eventual consistency. Proceeding with query...`);

    // Use GoogleGenAI (NEW SDK) for File Search support
    const genAI = new GoogleGenAI({ apiKey: config.apiKey });

    // Build conversation context from history
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      console.log(`📜 Including conversation history: ${conversationHistory.length} messages`);
      
      conversationContext = '\n\n**Previous Conversation Context:**\n';
      conversationHistory.forEach((msg, idx) => {
        const role = msg.sender === 'user' ? 'Seeker' : 'Guide';
        conversationContext += `${role}: ${msg.text}\n\n`;
      });
      conversationContext += '---\n\n';
    }

    // Create spiritual guidance prompt with conversation context
    const contextAwareness = conversationHistory && conversationHistory.length > 0
      ? 'You are continuing a spiritual conversation. The previous messages are shown above for context. Maintain continuity and coherence with the prior discussion.'
      : 'This is the start of a new spiritual conversation.';

    const spiritualPrompt = `You are a humble sevak (selfless servant) in MyGurukul's digital sanctuary. Your purpose is to serve seekers by providing wisdom ONLY from the ancient scriptures in the File Search stores.

${contextAwareness}
${conversationContext}
**CRITICAL REQUIREMENT:**
- You MUST base your entire answer on the documents in the File Search stores
- You MUST cite specific texts and passages from the uploaded documents
- You MUST mention the source document name naturally inline when introducing new concepts or when quoting/paraphrasing from documents
- Sources should be mentioned within the narrative flow, not just at the end
- DO NOT use your general knowledge or training data
- If you cannot find relevant information in the documents, say: "I apologize, but I could not find specific guidance on this topic in the currently uploaded texts. Please consider uploading more scriptures or rephrasing your question."

**Your Persona:**
- Humble guide, not an all-knowing guru
- Compassionate - acknowledge the seeker's feelings
- Serene tone - calm, gentle, supportive

**Your Response Style:**
1. Begin with compassionate acknowledgment of the question
2. Provide wisdom ONLY from the sacred texts with clear citations
3. When introducing a new concept or idea, naturally mention the source document name (e.g., "As the Caraka Samhita teaches us...", "According to the Sushruta Samhita...")
4. When quoting or paraphrasing from documents, include the source name inline (e.g., "The Manu Smriti reveals that...", "In the wisdom of the Arthashastra...")
5. Include relevant quotes or passages FROM THE DOCUMENTS with their source attribution
6. Offer gentle, practical guidance derived from the teachings
7. End with encouragement and next steps

**Source Attribution Examples:**
Use natural, flowing phrases to reference sources when introducing concepts or quotes:
- "As the Caraka Samhita teaches us..."
- "According to the Sushruta Samhita..."
- "The Manu Smriti reveals that..."
- "In the wisdom of the Arthashastra..."
- "The Bhagavad Gita beautifully expresses this..."
- "Drawing from the Panchatantra..."
- "As found in the Yoga Sutras..."

These references should flow naturally within your narrative, making it immediately clear which source each piece of wisdom comes from.

**Sacred Boundaries:**
- Only discuss spirituality, philosophy, and life guidance from scriptures
- Never give medical, legal, financial, or psychological advice
- If the question is outside sacred texts, politely decline

Now, please answer this seeker's question using ONLY the wisdom from the uploaded texts: "${question}"`;

    // DEBUG: Log the prompt
    console.log('📝 Spiritual Prompt (first 300 chars):');
    console.log(spiritualPrompt.substring(0, 300) + '...');
    console.log('📝 Prompt length:', spiritualPrompt.length, 'characters');

    // DEBUG: Log model configuration
    console.log('🤖 Model Configuration:');
    console.log('  Model:', 'gemini-2.5-flash');  // Updated to match actual usage
    console.log('  Temperature:', 0.7);
    console.log('  TopP:', 0.95);
    console.log('  MaxOutputTokens:', 2048);
    
    // DEBUG: Log tool configuration
    console.log('🔧 Tool Configuration:');
    console.log('  File Search Store Names:', fileSearchStoreNames);
    console.log('  Number of stores:', fileSearchStoreNames.length);

    console.log('🔧 Generating with File Search tools using NEW SDK (@google/genai)');
    console.log('📚 Following official Google docs: https://ai.google.dev/gemini-api/docs/file-search');

    // Use NEW SDK (@google/genai) per official Google documentation
    // https://ai.google.dev/gemini-api/docs/file-search
    // File Search is supported by gemini-2.5-pro and gemini-2.5-flash
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    
    // DEBUG: Log the exact request being sent
    const requestPayload = {
      model: 'gemini-2.5-flash',
      contents: spiritualPrompt.substring(0, 100) + '...',
      config: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames
            }
          }
        ]
      }
    };
    console.log('📤 Request payload (tools):', JSON.stringify(requestPayload.config.tools, null, 2));
    
    // Retry logic for transient 429 errors (rate limits, not quota exhaustion)
    const maxRetries = 2;
    let lastError: any = null;
    let response: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff: 1s, 2s, max 5s
          console.log(`⏳ Retry attempt ${attempt}/${maxRetries} after ${backoffDelay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: spiritualPrompt,
          config: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 2048,
            tools: [
              {
                fileSearch: {
                  fileSearchStoreNames
                }
              }
            ]
          }
        });
        
        // Success - break out of retry loop
        break;
      } catch (retryError: any) {
        lastError = retryError;
        const isRateLimit = retryError?.status === 429 || 
                           retryError?.code === 429 ||
                           retryError?.error?.code === 429;
        
        if (isRateLimit && attempt < maxRetries) {
          console.warn(`⚠️  Rate limit error on attempt ${attempt + 1}, will retry...`);
          continue; // Retry
        } else {
          // Not a retryable error, or max retries reached
          throw retryError;
        }
      }
    }
    
    // DEBUG: Comprehensive response structure logging
    console.log('📊 Raw Gemini Response Structure (NEW SDK @google/genai):');
    console.log('  Response type:', typeof response);
    console.log('  Response keys:', Object.keys(response));
    console.log('  Has text property:', typeof response.text !== 'undefined');
    console.log('  Has candidates:', !!response.candidates);
    console.log('  Full response structure:', JSON.stringify(Object.keys(response), null, 2));

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      console.log('  Candidate keys:', Object.keys(candidate));
      console.log('  Full candidate structure:', JSON.stringify(Object.keys(candidate), null, 2));
      console.log('  Has groundingMetadata:', !!candidate.groundingMetadata);
      console.log('  Candidate content keys:', candidate.content ? Object.keys(candidate.content) : 'no content');
      
      // Check for groundingMetadata in different possible locations
      if (candidate.groundingMetadata) {
        console.log('  ✅ FOUND groundingMetadata!');
        console.log('  GroundingMetadata keys:', Object.keys(candidate.groundingMetadata));
        console.log('  GroundingChunks count:', candidate.groundingMetadata.groundingChunks?.length || 0);
        console.log('  GroundingSupports:', candidate.groundingMetadata.groundingSupports?.length || 0);
      } else {
        console.log('  ❌ NO groundingMetadata found in candidate');
        console.log('  Checking if groundingMetadata exists at response level...');
        console.log('  Response has groundingMetadata:', !!(response as any).groundingMetadata);
      }
      
      console.log('  Has content:', !!candidate.content);
      console.log('  FinishReason:', candidate.finishReason);
    }

    // Log the full response for deep inspection (checking for groundingMetadata anywhere)
    const responseStr = JSON.stringify(response, null, 2);
    console.log('📄 Full Response (first 2000 chars):', responseStr.substring(0, 2000));
    if (responseStr.includes('grounding')) {
      console.log('  ✅ Found "grounding" in response!');
      const groundingMatch = responseStr.match(/"grounding[^"]*":\s*\{[^}]*\}/g);
      if (groundingMatch) {
        console.log('  Grounding matches:', groundingMatch);
      }
    } else {
      console.log('  ❌ No "grounding" found in response');
    }

    const totalTime = Date.now() - startTime;

    // Extract response text and citations from NEW SDK response
    // Per docs: response.text is a property (not a method)
    const narrative = response.text || '';
    const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // DEBUG: Log citation extraction
    console.log('📚 Citation Extraction:');
    console.log('  Raw citations array length:', citations.length);
    console.log('  Raw citations:', JSON.stringify(citations, null, 2));

    if (citations.length > 0) {
      console.log('  First citation structure:', JSON.stringify(citations[0], null, 2));
    } else {
      console.log('  ⚠️  NO CITATIONS FOUND - Investigating why...');
      
      // Check if response has text but no grounding
      if (narrative && narrative.length > 0) {
        console.log('  ❌ ISSUE: Response has text but no grounding chunks');
        console.log('  Text preview:', narrative.substring(0, 200));
      }
    }
    
    // Format citations for frontend compatibility
    const formattedCitations = citations.map((chunk: any, index: number) => {
      const retrievedContext = chunk.retrievedContext || {};
      
      // Enhanced title extraction - try multiple locations
      let title = retrievedContext.title || 
                  retrievedContext.documentMetadata?.title || 
                  retrievedContext.document?.title ||
                  retrievedContext.displayName ||
                  '';
      
      // If still no title, try to extract from URI or fileSearchStore
      if (!title || title === 'Unknown Source') {
        // Try extracting from URI (e.g., "fileSearchStores/epics-.../documents/upload1763018268726aitareya-...")
        const uri = retrievedContext.uri || retrievedContext.documentMetadata?.uri || '';
        if (uri) {
          // Extract document ID from URI and try to infer name
          const docMatch = uri.match(/documents\/([^/]+)/);
          if (docMatch) {
            const docId = docMatch[1];
            // Try to extract readable name from document ID
            if (docId.includes('upload')) {
              // Extract timestamp and name pattern
              const uploadMatch = docId.match(/upload(\d+)([a-z-]+)/i);
              if (uploadMatch) {
                title = `Document ${uploadMatch[2].replace(/-/g, ' ')}`;
              }
            }
          }
        }
        
        // Fallback to fileSearchStore name if available
        if ((!title || title === 'Unknown Source') && retrievedContext.fileSearchStore) {
          const storeMatch = retrievedContext.fileSearchStore.match(/fileSearchStores\/([^-]+)/);
          if (storeMatch) {
            title = `${storeMatch[1].charAt(0).toUpperCase() + storeMatch[1].slice(1)} Document`;
          }
        }
        
        // Final fallback
        if (!title || title === 'Unknown Source') {
          title = 'Sacred Text';
        }
      }
      
      // Log citation details for debugging
      if (index === 0) {
        console.log('📋 First Citation Structure:');
        console.log('  RetrievedContext keys:', Object.keys(retrievedContext));
        console.log('  Title found:', title);
        console.log('  URI:', retrievedContext.uri || retrievedContext.documentMetadata?.uri || 'none');
        console.log('  FileSearchStore:', retrievedContext.fileSearchStore || 'none');
      }
      
      return {
        id: `citation-${index}`,
        text: retrievedContext.text || '',
        source: title,
        uri: retrievedContext.uri || retrievedContext.documentMetadata?.uri || '',
        confidence: 1.0
      };
    });

    // DEBUG: Log formatted citations
    console.log('✨ Formatted Citations:');
    console.log('  Count:', formattedCitations.length);
    if (formattedCitations.length > 0) {
      console.log('  First formatted citation:', JSON.stringify(formattedCitations[0], null, 2));
      formattedCitations.forEach((citation, idx) => {
        console.log(`  Citation ${idx + 1}: source="${citation.source}", text length=${citation.text.length}`);
      });
    }

    console.log(`✅ File Search Query completed in ${totalTime}ms`);
    console.log(`📝 Response length: ${narrative.length} characters`);
    console.log(`📚 Citations: ${formattedCitations.length}`);
    
    // GROUNDING VERIFICATION: Log grounding statistics
    const citationsWithTitles = formattedCitations.filter(c => c.source && c.source !== 'Unknown Source' && c.source !== 'Sacred Text').length;
    const citationsWithText = formattedCitations.filter(c => c.text && c.text.length > 0).length;
    console.log(`🔍 Grounding Verification:`);
    console.log(`  Total citations: ${formattedCitations.length}`);
    console.log(`  Citations with identifiable sources: ${citationsWithTitles}`);
    console.log(`  Citations with text content: ${citationsWithText}`);
    console.log(`  Grounding confidence: ${citationsWithTitles > 0 && citationsWithText === formattedCitations.length ? 'HIGH' : citationsWithText > 0 ? 'MEDIUM' : 'LOW'}`);

    // HALLUCINATION PREVENTION: Reject responses with no grounding
    if (formattedCitations.length === 0) {
      console.log('⚠️  No citations found - returning scripture not found message');
      const groundedFailMessage =
        'Namaste, dear seeker. I apologize, but I could not find specific guidance on this topic in the currently uploaded sacred texts. ' +
        'This may mean the relevant scriptures have not yet been indexed, or the question may need to be rephrased. ' +
        'Please consider exploring related topics or consulting the library for available texts.';

      return NextResponse.json({
        success: true,
        data: {
          sessionId: sessionId || `fs-${Date.now()}`,
          narrative: groundedFailMessage,
          citations: [],
          sources: [],
          metadata: {
            provider: 'file-search',
            model: 'gemini-2.0-flash-exp',
            storesSearched: fileSearchStoreNames.length,
            category,
            responseTime: totalTime,
            citationsCount: 0,
            grounded: false
          }
        },
        timestamp: new Date().toISOString()
      });
    }

    // Return response in format compatible with existing frontend
    return NextResponse.json({
      success: true,
      data: {
        sessionId: sessionId || `fs-${Date.now()}`,
        narrative,
        citations: formattedCitations,
        sources: formattedCitations.map(c => ({
          title: c.source,
          uri: c.uri
        })),
        metadata: {
          provider: 'file-search',
          model: 'gemini-2.5-flash',
          storesSearched: fileSearchStoreNames.length,
          category,
          responseTime: totalTime,
          citationsCount: formattedCitations.length,
          grounded: formattedCitations.length > 0,
          citationsWithSources: formattedCitations.filter(c => c.source && c.source !== 'Unknown Source' && c.source !== 'Sacred Text').length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('❌ File Search query failed:', error);

    // Handle 429 Rate Limit / Quota Exhausted errors
    const isRateLimitError = (error as any)?.status === 429 || 
                             (error as any)?.code === 429 ||
                             (error as any)?.error?.code === 429 ||
                             (error as any)?.message?.includes('429') ||
                             (error as any)?.message?.includes('Resource has been exhausted') ||
                             (error as any)?.message?.includes('quota');

    if (isRateLimitError) {
      console.error('⚠️  Rate limit / Quota exhausted error detected');
      return NextResponse.json({
        success: false,
        error: 'API quota exhausted',
        message: 'The Google Gemini API quota has been exhausted. Please try again later or check your API quota limits in the Google Cloud Console.',
        help: 'This usually resets after some time. You can check your quota at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas',
        code: 'QUOTA_EXHAUSTED',
        responseTime: totalTime,
        retryAfter: 60 // Suggest retrying after 60 seconds
      }, { status: 429 });
    }

    // Handle other API errors
    const apiError = error as any;
    if (apiError?.status || apiError?.code) {
      const statusCode = apiError.status || apiError.code || 500;
      return NextResponse.json({
        success: false,
        error: apiError.message || 'API request failed',
        details: apiError.error?.message || apiError.message,
        code: apiError.error?.code || apiError.code,
        responseTime: totalTime
      }, { status: statusCode });
    }

    // Generic error handling
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined,
      responseTime: totalTime
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
