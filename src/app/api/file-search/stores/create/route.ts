/**
 * File Search Store Creation Endpoint
 * Creates File Search stores for Vedas, Upanishads, Darshanas, Epics, Yoga, and Sastras
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFileSearchConfig, getCategoryDisplayName } from '../../../../../lib/fileSearchConfig';

export async function POST(request: NextRequest) {
  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_GENAI_API_KEY not configured',
        help: 'Please check FILE_SEARCH_SETUP_GUIDE.md'
      }, { status: 500 });
    }

    // Get category from request body
    const body = await request.json();
    const { category } = body;

    if (!category || !['vedas', 'upanishads', 'darshanas', 'epics', 'yoga', 'sastras'].includes(category)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid category. Must be one of: vedas, upanishads, darshanas, epics, yoga, sastras'
      }, { status: 400 });
    }

    // Initialize Google GenAI client
    const client = new GoogleGenAI({ apiKey: config.apiKey });

    // Create File Search store using SDK
    const displayName = getCategoryDisplayName(category as any);

    console.log(`Creating File Search store for ${category}...`);
    
    const fileSearchStore = await client.fileSearchStores.create({
      config: {
        displayName: `${displayName} - MyGurukul Sacred Library`,
      }
    });

    console.log(`✅ Successfully created store: ${fileSearchStore.name}`);

    return NextResponse.json({
      success: true,
      category,
      store: {
        name: fileSearchStore.name,
        displayName: fileSearchStore.displayName,
        createTime: fileSearchStore.createTime,
      },
      message: `Successfully created File Search store for ${displayName}`
    });

  } catch (error) {
    console.error('Store creation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Create all stores at once
 */
export async function PUT(request: NextRequest) {
  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_GENAI_API_KEY not configured'
      }, { status: 500 });
    }

    // Initialize Google GenAI client
    const client = new GoogleGenAI({ apiKey: config.apiKey });

    const results = [];
    const categories = ['vedas', 'upanishads', 'darshanas', 'epics', 'yoga', 'sastras'];

    for (const category of categories) {
      try {
        const displayName = getCategoryDisplayName(category as any);

        const fileSearchStore = await client.fileSearchStores.create({
          config: {
            displayName: `${displayName} - MyGurukul Sacred Library`,
          }
        });

        results.push({
          category,
          success: true,
          store: {
            name: fileSearchStore.name,
            displayName: fileSearchStore.displayName,
          }
        });

        console.log(`✅ Created store for ${category}: ${fileSearchStore.name}`);

      } catch (error) {
        results.push({
          category,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`❌ Failed to create store for ${category}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      created: successCount,
      total: categories.length,
      results,
      message: `Created ${successCount}/${categories.length} stores successfully`
    });

  } catch (error) {
    console.error('Batch store creation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

