/**
 * File Search Test Endpoint
 * Comprehensive testing for File Search functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFileSearchConfig, validateFileSearchConfig } from '../../../../lib/fileSearchConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Ensures full Node.js env for heavy ops

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
    overall: 'pending'
  };

  try {
    // Test 1: Configuration
    const configTest = {
      name: 'Configuration',
      status: 'running',
      details: {}
    };

    const config = getFileSearchConfig();
    const validation = validateFileSearchConfig(config);

    if (validation.valid) {
      configTest.status = 'passed';
      configTest.details = {
        apiKeyPresent: !!config.apiKey,
        enabled: config.enabled,
        maxFileSizeMB: config.maxFileSizeMB
      };
    } else {
      configTest.status = 'failed';
      configTest.details = { errors: validation.errors };
    }

    results.tests.push(configTest);

    // Test 2: API Connection
    const apiTest = {
      name: 'API Connection',
      status: 'running',
      details: {}
    };

    try {
      // Initialize client and list stores via SDK
      const client = new GoogleGenAI({ apiKey: config.apiKey });
      const storesPager = await client.fileSearchStores.list();
      
      // Convert pager to array
      const allStores = [];
      for await (const store of storesPager) {
        allStores.push(store);
      }

      const stores = allStores.map((store: any) => ({
        name: store.name,
        displayName: store.displayName
      }));

      apiTest.status = 'passed';
      apiTest.details = {
        connected: true,
        storesFound: stores.length,
        stores: stores
      };
    } catch (error) {
      apiTest.status = 'failed';
      apiTest.details = {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    results.tests.push(apiTest);

    // Test 3: Store Readiness
    const storeTest = {
      name: 'Store Readiness',
      status: 'running',
      details: {}
    };

    try {
      const client = new GoogleGenAI({ apiKey: config.apiKey });
      const storesPager = await client.fileSearchStores.list();
      
      // Convert pager to array
      const allStores = [];
      for await (const store of storesPager) {
        allStores.push(store);
      }

      const categories = {
        vedas: allStores.filter((s: any) => s.displayName?.toLowerCase().includes('veda')),
        upanishads: allStores.filter((s: any) => s.displayName?.toLowerCase().includes('upanishad')),
        darshanas: allStores.filter((s: any) => s.displayName?.toLowerCase().includes('darshana') || 
                                       s.displayName?.toLowerCase().includes('philosophical')),
        epics: allStores.filter((s: any) => s.displayName?.toLowerCase().includes('epic')),
        yoga: allStores.filter((s: any) => s.displayName?.toLowerCase().includes('yoga')),
        sastras: allStores.filter((s: any) => s.displayName?.toLowerCase().includes('sastra'))
      };

      const allCategoriesPresent = 
        categories.vedas.length > 0 &&
        categories.upanishads.length > 0 &&
        categories.darshanas.length > 0 &&
        categories.epics.length > 0 &&
        categories.yoga.length > 0 &&
        categories.sastras.length > 0;

      storeTest.status = allCategoriesPresent ? 'passed' : 'warning';
      storeTest.details = {
        totalStores: allStores.length,
        vedas: categories.vedas.length,
        upanishads: categories.upanishads.length,
        darshanas: categories.darshanas.length,
        epics: categories.epics.length,
        yoga: categories.yoga.length,
        sastras: categories.sastras.length,
        allCategoriesPresent,
        message: allCategoriesPresent ? 
          'All category stores present' : 
          'Some category stores missing. Please create them at /admin/file-search-upload'
      };
    } catch (error) {
      storeTest.status = 'failed';
      storeTest.details = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    results.tests.push(storeTest);

    // Test 4: Query Test (if stores available)
    const queryTest = {
      name: 'Sample Query',
      status: 'running',
      details: {}
    };

    try {
      const client = new GoogleGenAI({ apiKey: config.apiKey });
      const storesPager = await client.fileSearchStores.list();
      
      // Convert pager to array
      const stores = [];
      for await (const store of storesPager) {
        stores.push(store);
      }

      if (stores.length > 0) {
        // Google API limit: Max 5 corpora per request
        const MAX_STORES_PER_REQUEST = 5;
        const limitedStores = stores.slice(0, MAX_STORES_PER_REQUEST);
        const storeNames = limitedStores.map((s: any) => s.name);
        
        if (stores.length > MAX_STORES_PER_REQUEST) {
          console.log(`⚠️  Test: Limiting stores from ${stores.length} to ${MAX_STORES_PER_REQUEST} (Google API limit)`);
        }

        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const tools: any[] = [{
          fileSearch: {
            fileSearchStoreNames: storeNames
          }
        }];

        const generationConfig: any = {
          tools: tools
        };

        const startTime = Date.now();
        const result = await model.generateContent('What is dharma according to the sacred texts?', generationConfig);
        const response = result.response;

        const queryTime = Date.now() - startTime;

        queryTest.status = 'passed';
        queryTest.details = {
          queryTime: `${queryTime}ms`,
          responseLength: response.text().length || 0,
          citationsFound: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length || 0,
          message: 'Query successful'
        };
      } else {
        queryTest.status = 'skipped';
        queryTest.details = {
          message: 'No stores available for testing'
        };
      }
    } catch (error) {
      queryTest.status = 'failed';
      queryTest.details = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    results.tests.push(queryTest);

    // Determine overall status
    const passedTests = results.tests.filter((t: any) => t.status === 'passed').length;
    const failedTests = results.tests.filter((t: any) => t.status === 'failed').length;
    
    if (failedTests > 0) {
      results.overall = 'failed';
    } else if (passedTests === results.tests.length) {
      results.overall = 'passed';
    } else {
      results.overall = 'partial';
    }

    results.summary = {
      total: results.tests.length,
      passed: passedTests,
      failed: failedTests,
      warnings: results.tests.filter((t: any) => t.status === 'warning').length,
      skipped: results.tests.filter((t: any) => t.status === 'skipped').length
    };

    return NextResponse.json(results);

  } catch (error) {
    console.error('Test suite failed:', error);
    return NextResponse.json({
      ...results,
      overall: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

