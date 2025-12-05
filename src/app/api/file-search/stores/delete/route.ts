/**
 * Delete File Search Store Endpoint
 * Safely deletes a File Search store with safety checks
 * Verifies store is empty before deletion to prevent accidental data loss
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFileSearchConfig } from '../../../../../lib/fileSearchConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Ensures full Node.js env for heavy ops

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_GENAI_API_KEY not configured'
      }, { status: 500 });
    }

    // Get store name from request body
    const body = await request.json();
    const { storeName, force } = body;

    if (!storeName) {
      return NextResponse.json({
        success: false,
        error: 'storeName is required in request body'
      }, { status: 400 });
    }

    // Validate store name format
    if (!storeName.startsWith('fileSearchStores/')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid store name format. Must start with "fileSearchStores/"'
      }, { status: 400 });
    }

    console.log(`🗑️  Attempting to delete store: ${storeName}`);
    console.log(`   Force mode: ${force || false}`);

    // SAFETY CHECK: Verify store is empty before deletion (unless force=true)
    if (!force) {
      try {
        console.log(`   🔍 Safety check: Verifying store is empty...`);
        const docsResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${storeName}/documents?key=${config.apiKey}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (docsResponse.ok) {
          const docsData = await docsResponse.json();
          const documentCount = (docsData.documents || []).length;
          
          console.log(`   📊 Store has ${documentCount} document(s)`);
          
          if (documentCount > 0) {
            return NextResponse.json({
              success: false,
              error: `Store contains ${documentCount} document(s). Cannot delete non-empty store.`,
              documentCount,
              safetyCheck: 'failed',
              help: 'If you really want to delete this store, use force=true in the request body. This will delete all documents in the store.'
            }, { status: 400 });
          }
          
          console.log(`   ✅ Safety check passed: Store is empty`);
        } else {
          console.warn(`   ⚠️  Could not verify document count (HTTP ${docsResponse.status}), proceeding with deletion`);
        }
      } catch (safetyError) {
        console.warn(`   ⚠️  Safety check failed: ${safetyError instanceof Error ? safetyError.message : 'Unknown'}`);
        console.warn(`   Proceeding with deletion anyway...`);
      }
    } else {
      console.log(`   ⚠️  Force mode enabled - skipping safety check`);
    }

    // Initialize Google GenAI client
    const client = new GoogleGenAI({ apiKey: config.apiKey });

    // Try SDK delete method first
    try {
      console.log(`   🔧 Attempting deletion via SDK...`);
      await client.fileSearchStores.delete({ name: storeName });
      console.log(`   ✅ Successfully deleted store via SDK: ${storeName}`);
      
      const totalTime = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        deletedStore: storeName,
        method: 'sdk',
        deletionTime: totalTime,
        message: 'Store deleted successfully'
      });
    } catch (sdkError: any) {
      console.warn(`   ⚠️  SDK delete failed: ${sdkError.message || 'Unknown error'}`);
      console.log(`   🔄 Trying REST API delete method...`);
      
      // Fallback to REST API if SDK fails
      const restResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${storeName}?key=${config.apiKey}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!restResponse.ok) {
        const errorText = await restResponse.text();
        console.error(`   ❌ REST API delete also failed: HTTP ${restResponse.status}`);
        console.error(`   Error: ${errorText.substring(0, 300)}`);
        
        // Parse error for better message
        let errorMessage = `Delete failed: HTTP ${restResponse.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error.message || errorData.error.code || errorMessage;
          }
        } catch {
          errorMessage = errorText.substring(0, 200);
        }
        
        return NextResponse.json({
          success: false,
          error: errorMessage,
          method: 'rest-api',
          httpStatus: restResponse.status,
          sdkError: sdkError.message,
          details: errorText.substring(0, 200)
        }, { status: restResponse.status });
      }

      console.log(`   ✅ Successfully deleted store via REST API: ${storeName}`);
      
      const totalTime = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        deletedStore: storeName,
        method: 'rest-api',
        deletionTime: totalTime,
        message: 'Store deleted successfully via REST API'
      });
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Store deletion failed after ${totalTime}ms:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined,
      deletionTime: totalTime
    }, { status: 500 });
  }
}

