/**
 * List Documents in File Search Store
 * Real-time endpoint to check documents in a specific store
 * Usage: GET /api/file-search/stores/documents?storeName=fileSearchStores/abc123
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFileSearchConfig } from '../../../../../lib/fileSearchConfig';

export async function GET(request: NextRequest) {
  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'GOOGLE_GENAI_API_KEY not configured',
        },
        { status: 500 }
      );
    }

    // Get store name from query parameter
    const searchParams = request.nextUrl.searchParams;
    const storeName = searchParams.get('storeName');

    if (!storeName) {
      return NextResponse.json(
        {
          success: false,
          error: 'storeName query parameter is required',
          example: '/api/file-search/stores/documents?storeName=fileSearchStores/abc123',
        },
        { status: 400 }
      );
    }

    // Validate store name format
    if (!storeName.startsWith('fileSearchStores/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid store name format. Must start with "fileSearchStores/"',
        },
        { status: 400 }
      );
    }

    console.log(`📋 Listing documents in store: ${storeName}`);

    // Query documents directly via REST API (per official docs)
    // Reference: https://ai.google.dev/gemini-api/docs/file-search
    // Handle pagination to get ALL documents
    let allDocuments: any[] = [];
    let pageToken: string | null = null;
    let pageCount = 0;

    do {
      pageCount++;
      const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${storeName}/documents`);
      url.searchParams.set('key', config.apiKey);
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      console.log(`   📄 Fetching page ${pageCount}${pageToken ? ` (token: ${pageToken.substring(0, 20)}...)` : ''}`);

      const docsResponse = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!docsResponse.ok) {
        const errorText = await docsResponse.text();
        console.error(`❌ Failed to list documents: ${docsResponse.status} - ${errorText}`);
        
        return NextResponse.json(
          {
            success: false,
            error: `Failed to list documents: HTTP ${docsResponse.status}`,
            details: errorText.substring(0, 200),
          },
          { status: docsResponse.status }
        );
      }

      const docsData = await docsResponse.json();
      const pageDocuments = docsData.documents || [];
      allDocuments = allDocuments.concat(pageDocuments);
      
      console.log(`   ✅ Page ${pageCount}: Found ${pageDocuments.length} document(s) (Total: ${allDocuments.length})`);
      
      // Check for next page token
      pageToken = docsData.nextPageToken || null;
      
      if (pageToken) {
        console.log(`   📄 More pages available, continuing...`);
      }
    } while (pageToken);

    const documents = allDocuments;
    console.log(`✅ Found ${documents.length} total document(s) in store (${pageCount} page(s))`);

    // Format documents for response
    const formattedDocuments = documents.map((doc: any) => ({
      name: doc.name,
      displayName: doc.displayName || doc.name.split('/').pop() || 'Unknown',
      mimeType: doc.mimeType || 'application/pdf',
      sizeBytes: parseInt(doc.sizeBytes || '0'),
      sizeKB: ((parseInt(doc.sizeBytes || '0')) / 1024).toFixed(1),
      createTime: doc.createTime,
      updateTime: doc.updateTime,
      state: doc.state || 'ACTIVE',
      error: doc.error,
    }));

    return NextResponse.json({
      success: true,
      storeName,
      timestamp: new Date().toISOString(),
      documentCount: documents.length,
      documents: formattedDocuments,
      message: documents.length > 0
        ? `Found ${documents.length} document(s) in store`
        : 'No documents found in store (may still be indexing)',
    });
  } catch (error) {
    console.error('❌ Error listing documents:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

