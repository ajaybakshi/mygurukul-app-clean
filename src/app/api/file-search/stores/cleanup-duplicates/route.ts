/**
 * Cleanup Duplicate Stores Endpoint
 * Safely identifies and deletes empty duplicate stores
 * Only deletes stores with 0 documents to prevent data loss
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFileSearchConfig } from '../../../../../lib/fileSearchConfig';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_GENAI_API_KEY not configured'
      }, { status: 500 });
    }

    const body = await request.json();
    const { confirm } = body;

    if (confirm !== true) {
      return NextResponse.json({
        success: false,
        error: 'This operation requires explicit confirmation. Set confirm: true in request body.',
        help: 'This endpoint will identify empty duplicate stores. Review the analysis first, then confirm deletion.'
      }, { status: 400 });
    }

    console.log('🔍 Analyzing stores for duplicate cleanup...');

    // List all stores
    const client = new GoogleGenAI({ apiKey: config.apiKey });
    const storesPager = await client.fileSearchStores.list();
    const allStores = [];
    for await (const store of storesPager) {
      allStores.push(store);
    }

    console.log(`📚 Found ${allStores.length} total stores`);

    // Group stores by category
    const storesByCategory: Record<string, any[]> = {
      vedas: [],
      upanishads: [],
      darshanas: [],
      epics: [],
      yoga: [],
      sastras: [],
      other: []
    };

    for (const store of allStores) {
      const displayName = (store.displayName || '').toLowerCase();
      const storeName = (store.name || '').toLowerCase();
      
      // Check both displayName and store name for categorization
      if (displayName.includes('veda') || storeName.includes('veda')) {
        storesByCategory.vedas.push(store);
      } else if (displayName.includes('upanishad') || storeName.includes('upanishad')) {
        storesByCategory.upanishads.push(store);
      } else if (displayName.includes('darshana') || displayName.includes('philosophical') || storeName.includes('darshana')) {
        storesByCategory.darshanas.push(store);
      } else if (displayName.includes('epic') || storeName.includes('epic')) {
        storesByCategory.epics.push(store);
      } else if (displayName.includes('yoga') || storeName.includes('yoga')) {
        storesByCategory.yoga.push(store);
      } else if (displayName.includes('sastra') || storeName.includes('sastra')) {
        storesByCategory.sastras.push(store);
      } else {
        storesByCategory.other.push(store);
      }
    }
    
    console.log('📊 Categorized stores:', {
      vedas: storesByCategory.vedas.length,
      upanishads: storesByCategory.upanishads.length,
      darshanas: storesByCategory.darshanas.length,
      epics: storesByCategory.epics.length,
      yoga: storesByCategory.yoga.length,
      sastras: storesByCategory.sastras.length,
      other: storesByCategory.other.length
    });

    // Analyze each category for duplicates
    const analysis: any[] = [];
    const storesToDelete: any[] = [];

    for (const [category, stores] of Object.entries(storesByCategory)) {
      if (stores.length <= 1) continue; // No duplicates

      console.log(`\n📋 Analyzing ${category}: ${stores.length} store(s)`);

      // Check document count for each store
      const storesWithDocs = [];
      for (const store of stores) {
        try {
          const docsResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${store.name}/documents?key=${config.apiKey}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          let docCount = 0;
          if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            docCount = (docsData.documents || []).length;
          }

          storesWithDocs.push({
            name: store.name,
            displayName: store.displayName,
            documentCount: docCount,
            createTime: store.createTime
          });

          console.log(`   ${store.displayName}: ${docCount} documents`);

          // If store is empty, mark for deletion
          if (docCount === 0) {
            storesToDelete.push({
              name: store.name,
              displayName: store.displayName,
              category,
              reason: 'empty duplicate'
            });
          }
        } catch (error) {
          console.error(`   Error checking ${store.name}:`, error);
        }
      }

      if (stores.length > 1) {
        analysis.push({
          category,
          totalStores: stores.length,
          stores: storesWithDocs,
          emptyStores: storesWithDocs.filter(s => s.documentCount === 0).length
        });
      }
    }

    console.log(`\n🗑️  Identified ${storesToDelete.length} empty duplicate store(s) to delete`);

    // Delete empty duplicate stores
    const deletionResults = [];
    for (const store of storesToDelete) {
      try {
        console.log(`\n🗑️  Deleting: ${store.displayName} (${store.name})`);
        
        // Use REST API for deletion (more reliable)
        const deleteResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${store.name}?key=${config.apiKey}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (deleteResponse.ok) {
          console.log(`   ✅ Successfully deleted: ${store.name}`);
          deletionResults.push({
            store: store.name,
            displayName: store.displayName,
            success: true,
            method: 'rest-api'
          });
        } else {
          const errorText = await deleteResponse.text();
          console.error(`   ❌ Failed to delete: HTTP ${deleteResponse.status}`);
          console.error(`   Error: ${errorText.substring(0, 200)}`);
          
          deletionResults.push({
            store: store.name,
            displayName: store.displayName,
            success: false,
            error: `HTTP ${deleteResponse.status}: ${errorText.substring(0, 100)}`,
            httpStatus: deleteResponse.status
          });
        }
      } catch (error) {
        console.error(`   ❌ Exception deleting ${store.name}:`, error);
        deletionResults.push({
          store: store.name,
          displayName: store.displayName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = deletionResults.filter(r => r.success).length;
    const totalTime = Date.now() - startTime;

    console.log(`\n✅ Cleanup completed in ${totalTime}ms`);
    console.log(`   Deleted: ${successCount}/${storesToDelete.length} stores`);

    return NextResponse.json({
      success: successCount > 0,
      timestamp: new Date().toISOString(),
      analysis,
      storesToDelete: storesToDelete.length,
      deletionResults,
      summary: {
        totalStoresAnalyzed: allStores.length,
        duplicatesFound: analysis.length,
        emptyStoresDeleted: successCount,
        failedDeletions: deletionResults.filter(r => !r.success).length
      },
      message: `Deleted ${successCount} empty duplicate store(s)`
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Cleanup failed after ${totalTime}ms:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined,
      cleanupTime: totalTime
    }, { status: 500 });
  }
}

/**
 * GET endpoint to analyze duplicates without deleting
 */
export async function GET(request: NextRequest) {
  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_GENAI_API_KEY not configured'
      }, { status: 500 });
    }

    console.log('🔍 Analyzing stores for duplicates (dry run)...');

    // List all stores
    const client = new GoogleGenAI({ apiKey: config.apiKey });
    const storesPager = await client.fileSearchStores.list();
    const allStores = [];
    for await (const store of storesPager) {
      allStores.push(store);
    }

    // Group stores by category
    const storesByCategory: Record<string, any[]> = {
      vedas: [],
      upanishads: [],
      darshanas: [],
      epics: [],
      yoga: [],
      sastras: [],
      other: []
    };

    for (const store of allStores) {
      const displayName = (store.displayName || '').toLowerCase();
      const storeName = (store.name || '').toLowerCase();
      
      // Check both displayName and store name for categorization
      if (displayName.includes('veda') || storeName.includes('veda')) {
        storesByCategory.vedas.push(store);
      } else if (displayName.includes('upanishad') || storeName.includes('upanishad')) {
        storesByCategory.upanishads.push(store);
      } else if (displayName.includes('darshana') || displayName.includes('philosophical') || storeName.includes('darshana')) {
        storesByCategory.darshanas.push(store);
      } else if (displayName.includes('epic') || storeName.includes('epic')) {
        storesByCategory.epics.push(store);
      } else if (displayName.includes('yoga') || storeName.includes('yoga')) {
        storesByCategory.yoga.push(store);
      } else if (displayName.includes('sastra') || storeName.includes('sastra')) {
        storesByCategory.sastras.push(store);
      } else {
        storesByCategory.other.push(store);
      }
    }
    
    console.log('📊 Categorized stores:', {
      vedas: storesByCategory.vedas.length,
      upanishads: storesByCategory.upanishads.length,
      darshanas: storesByCategory.darshanas.length,
      epics: storesByCategory.epics.length,
      yoga: storesByCategory.yoga.length,
      sastras: storesByCategory.sastras.length,
      other: storesByCategory.other.length
    });

    // Analyze each category
    const analysis: any[] = [];
    const emptyStores: any[] = [];

    console.log('📊 Stores by category:', Object.entries(storesByCategory).map(([cat, stores]) => `${cat}: ${stores.length}`).join(', '));

    for (const [category, stores] of Object.entries(storesByCategory)) {
      if (stores.length <= 1) {
        console.log(`   Skipping ${category}: only ${stores.length} store(s)`);
        continue;
      }
      
      console.log(`\n📋 Analyzing ${category}: ${stores.length} store(s)`);

      const categoryAnalysis: any = {
        category,
        totalStores: stores.length,
        stores: []
      };

      for (const store of stores) {
        try {
          const docsResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${store.name}/documents?key=${config.apiKey}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          let docCount = 0;
          if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            docCount = (docsData.documents || []).length;
          }

          const storeInfo = {
            name: store.name,
            displayName: store.displayName,
            documentCount: docCount,
            createTime: store.createTime,
            isEmpty: docCount === 0
          };

          categoryAnalysis.stores.push(storeInfo);

          if (docCount === 0) {
            emptyStores.push({
              name: store.name,
              displayName: store.displayName,
              category
            });
          }
        } catch (error) {
          categoryAnalysis.stores.push({
            name: store.name,
            displayName: store.displayName,
            documentCount: 'error',
            error: error instanceof Error ? error.message : 'Unknown'
          });
        }
      }

      analysis.push(categoryAnalysis);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalStores: allStores.length,
      duplicatesFound: analysis.length,
      emptyStoresFound: emptyStores.length,
      analysis,
      emptyStores,
      recommendation: emptyStores.length > 0
        ? `Found ${emptyStores.length} empty duplicate store(s). Use POST with confirm:true to delete them.`
        : 'No empty duplicate stores found.',
      nextStep: emptyStores.length > 0
        ? 'POST to this endpoint with {"confirm": true} to delete empty duplicates'
        : 'No action needed'
    });

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

