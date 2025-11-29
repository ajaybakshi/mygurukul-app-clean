/**
 * File Search Configuration Test Endpoint
 * Verifies that File Search is properly configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFileSearchConfig, validateFileSearchConfig, getCategoryDisplayName } from '../../../../../lib/fileSearchConfig';

export async function GET(request: NextRequest) {
  try {
    const config = getFileSearchConfig();
    const validation = validateFileSearchConfig(config);

    if (!validation.valid) {
      return NextResponse.json({
        configured: false,
        enabled: false,
        errors: validation.errors,
        help: 'Please check FILE_SEARCH_SETUP_GUIDE.md for setup instructions'
      }, { status: 500 });
    }

    return NextResponse.json({
      configured: true,
      enabled: config.enabled,
      categories: Object.keys(config.categories).map(key => ({
        id: key,
        name: getCategoryDisplayName(key as any),
        storeId: config.categories[key as keyof typeof config.categories]
      })),
      maxFileSizeMB: config.maxFileSizeMB,
      supportedFileTypes: config.supportedFileTypes,
      message: '✅ File Search is properly configured!'
    });

  } catch (error) {
    console.error('Configuration test failed:', error);
    return NextResponse.json({
      configured: false,
      enabled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      help: 'Please check FILE_SEARCH_SETUP_GUIDE.md for setup instructions'
    }, { status: 500 });
  }
}



