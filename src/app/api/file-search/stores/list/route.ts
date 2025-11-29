/**
 * List File Search Stores Endpoint
 * Lists all File Search stores for the project
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFileSearchConfig } from '../../../../../lib/fileSearchConfig';

export async function GET(request: NextRequest) {
  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_GENAI_API_KEY not configured',
        help: 'Please check FILE_SEARCH_SETUP_GUIDE.md'
      }, { status: 500 });
    }

    console.log('Fetching File Search stores via SDK...');

    // Initialize Google GenAI client
    const client = new GoogleGenAI({ apiKey: config.apiKey });

    // List all stores using SDK (returns a Pager)
    const storesPager = await client.fileSearchStores.list();
    
    // Convert pager to array
    const stores = [];
    for await (const store of storesPager) {
      stores.push(store);
    }

    // Convert to simplified format
    const storeList = stores.map((store: any) => ({
      name: store.name,
      displayName: store.displayName || store.config?.displayName,
      createTime: store.createTime,
      updateTime: store.updateTime,
    }));

    console.log(`✅ Found ${storeList.length} File Search stores`);

    // Try to match stores to categories
    const categorizedStores = {
      vedas: storeList.find(s => s.displayName?.toLowerCase().includes('veda')),
      upanishads: storeList.find(s => s.displayName?.toLowerCase().includes('upanishad')),
      darshanas: storeList.find(s => s.displayName?.toLowerCase().includes('darshana') || s.displayName?.toLowerCase().includes('philosophical')),
      epics: storeList.find(s => s.displayName?.toLowerCase().includes('epic')),
      yoga: storeList.find(s => s.displayName?.toLowerCase().includes('yoga')),
      sastras: storeList.find(s => s.displayName?.toLowerCase().includes('sastra')),
      other: storeList.filter(s => 
        !s.displayName?.toLowerCase().includes('veda') &&
        !s.displayName?.toLowerCase().includes('upanishad') &&
        !s.displayName?.toLowerCase().includes('darshana') &&
        !s.displayName?.toLowerCase().includes('philosophical') &&
        !s.displayName?.toLowerCase().includes('epic') &&
        !s.displayName?.toLowerCase().includes('yoga') &&
        !s.displayName?.toLowerCase().includes('sastra')
      )
    };

    return NextResponse.json({
      success: true,
      total: storeList.length,
      stores: storeList,
      categorized: categorizedStores,
      message: `Found ${storeList.length} File Search stores`
    });

  } catch (error) {
    console.error('Failed to list stores:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

