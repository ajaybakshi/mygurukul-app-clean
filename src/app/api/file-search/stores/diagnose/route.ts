/**
 * File Search Diagnostic Endpoint
 * Real-time diagnostic for all File Search stores with accurate document counts
 * Uses the same reliable method as the documents endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFileSearchConfig } from '../../../../../lib/fileSearchConfig';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: any = {
    success: false,
    timestamp: new Date().toISOString(),
    stores: [],
    summary: {
      totalStores: 0,
      totalDocuments: 0,
      storesReady: 0,
      storesIndexing: 0,
      storesEmpty: 0,
      storesError: 0,
    },
    recommendation: ''
  };

  try {
    const config = getFileSearchConfig();
    if (!config.apiKey) {
      throw new Error('GOOGLE_GENAI_API_KEY not configured');
    }

    console.log('🔍 Running File Search diagnostics (real-time)...');

    // Step 1: List all stores
    const client = new GoogleGenAI({ apiKey: config.apiKey });
    const storesPager = await client.fileSearchStores.list();
    const allStores = [];
    for await (const store of storesPager) {
      allStores.push(store);
    }

    results.summary.totalStores = allStores.length;
    console.log(`✅ Found ${allStores.length} stores`);

    // Step 2: For each store, query documents using the reliable method
    for (const store of allStores) {
      const storeName = store.name;
      const storeData: any = {
        name: storeName,
        displayName: store.displayName || 'N/A',
        createTime: store.createTime,
        updateTime: store.updateTime,
        documentCount: 0,
        documents: [],
        status: 'unknown',
        pendingOperations: 0
      };

      console.log(`\n📚 Processing store: ${store.displayName}`);
      console.log(`   Store ID: ${storeName}`);

      // Query documents using the EXACT same method as the working documents endpoint
      // Handle pagination to get ALL documents
      let actualDocuments: any[] = [];
      let querySuccess = false;
      
      try {
        console.log(`   📋 Querying documents via REST API (with pagination)...`);
        
        let pageToken: string | null = null;
        let pageCount = 0;

        do {
          pageCount++;
          const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${storeName}/documents`);
          url.searchParams.set('key', config.apiKey);
          if (pageToken) {
            url.searchParams.set('pageToken', pageToken);
          }

          const docsResponse = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            const pageDocuments = docsData.documents || [];
            actualDocuments = actualDocuments.concat(pageDocuments);
            
            console.log(`   📄 Page ${pageCount}: ${pageDocuments.length} document(s) (Total: ${actualDocuments.length})`);
            
            pageToken = docsData.nextPageToken || null;
            querySuccess = true;
          } else {
            const errorText = await docsResponse.text();
            console.error(`   ❌ Query failed: HTTP ${docsResponse.status}`);
            console.error(`   Error: ${errorText.substring(0, 300)}`);
            storeData.queryError = `HTTP ${docsResponse.status}: ${errorText.substring(0, 100)}`;
            break;
          }
        } while (pageToken);

        if (querySuccess) {
          console.log(`   ✅ Successfully queried all documents: ${actualDocuments.length} found (${pageCount} page(s))`);
          
          if (actualDocuments.length > 0) {
            // Log first few documents for debugging
            actualDocuments.slice(0, 3).forEach((doc: any, idx: number) => {
              console.log(`     ${idx + 1}. ${doc.displayName || doc.name.split('/').pop()}`);
              console.log(`        State: ${doc.state || 'UNKNOWN'}, Size: ${doc.sizeBytes ? (parseInt(doc.sizeBytes) / 1024).toFixed(1) + ' KB' : 'N/A'}`);
            });
            if (actualDocuments.length > 3) {
              console.log(`     ... and ${actualDocuments.length - 3} more`);
            }
            
            // Format documents for frontend (same format as documents endpoint)
            storeData.documents = actualDocuments.map((doc: any) => ({
              name: doc.name,
              displayName: doc.displayName || doc.name.split('/').pop() || 'Unknown',
              mimeType: doc.mimeType || 'application/pdf',
              sizeBytes: parseInt(doc.sizeBytes || '0'),
              sizeKB: ((parseInt(doc.sizeBytes || '0')) / 1024).toFixed(1),
              createTime: doc.createTime,
              updateTime: doc.updateTime,
              state: doc.state || 'ACTIVE',
              error: doc.error
            }));
          }
        }
      } catch (docError) {
        console.error(`   ❌ Exception querying documents:`, docError);
        storeData.queryError = docError instanceof Error ? docError.message : 'Unknown error';
      }

      // Update document count from actual query results
      storeData.documentCount = actualDocuments.length;

      // Determine status based on actual document count
      if (querySuccess) {
        if (actualDocuments.length > 0) {
          // Check if any documents are still processing
          const processingDocs = actualDocuments.filter((doc: any) => 
            doc.state && !doc.state.includes('ACTIVE') && !doc.state.includes('INDEXED')
          );
          
          if (processingDocs.length > 0) {
            storeData.status = 'indexing';
            storeData.message = `Store has ${actualDocuments.length} document(s), ${processingDocs.length} still processing`;
            results.summary.storesIndexing++;
          } else {
            storeData.status = 'ready';
            storeData.message = `Store is ready with ${actualDocuments.length} indexed document(s)`;
            results.summary.storesReady++;
          }
          results.summary.totalDocuments += actualDocuments.length;
        } else {
          // No documents found - check if there are recent uploads
          storeData.status = 'empty';
          storeData.message = 'No documents found in store';
          results.summary.storesEmpty++;
        }
      } else {
        // Query failed
        storeData.status = 'error';
        storeData.message = `Failed to query documents: ${storeData.queryError || 'Unknown error'}`;
        results.summary.storesError++;
      }

      results.stores.push(storeData);
    }

    // Generate summary recommendation
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Diagnostic completed in ${totalTime}ms`);
    console.log(`   Total stores: ${results.summary.totalStores}`);
    console.log(`   Total documents: ${results.summary.totalDocuments}`);
    console.log(`   Ready: ${results.summary.storesReady}, Indexing: ${results.summary.storesIndexing}, Empty: ${results.summary.storesEmpty}, Error: ${results.summary.storesError}`);

    if (results.summary.totalDocuments > 0) {
      results.success = true;
      results.recommendation = `All stores checked. Found ${results.summary.totalDocuments} total document(s) across ${results.summary.storesReady} ready store(s).`;
    } else if (results.summary.storesIndexing > 0) {
      results.success = true;
      results.recommendation = 'Some stores are still indexing. Please wait a few minutes and refresh.';
    } else if (results.summary.storesEmpty > 0) {
      results.success = true;
      results.recommendation = 'Some stores are empty. Upload documents via /admin/file-search-upload.';
    } else {
      results.recommendation = 'No documents found in any store. Please upload documents via /admin/file-search-upload.';
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ File Search diagnostic failed after ${totalTime}ms:`, error);
    results.error = error instanceof Error ? error.message : 'Unknown error occurred';
    results.recommendation = 'Check API key and network connection.';
  }

  return NextResponse.json(results);
}
