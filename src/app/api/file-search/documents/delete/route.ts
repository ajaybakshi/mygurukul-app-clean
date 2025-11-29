/**
 * Document Deletion Endpoint
 * Deletes a specific document from a File Search store
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFileSearchConfig } from '../../../../../lib/fileSearchConfig';

export async function DELETE(request: NextRequest) {
  try {
    const config = getFileSearchConfig();
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_GENAI_API_KEY not configured'
      }, { status: 500 });
    }

    const body = await request.json();
    const { documentName } = body; // Full resource name, e.g., fileSearchStores/store_id/documents/document_id

    if (!documentName) {
      return NextResponse.json({
        success: false,
        error: 'documentName is required in request body'
      }, { status: 400 });
    }

    console.log(`Deleting document: ${documentName}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${documentName}?key=${config.apiKey}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to delete document:', errorText);
      throw new Error(`Delete failed: ${response.status} ${errorText}`);
    }

    console.log(`✅ Successfully deleted document: ${documentName}`);

    return NextResponse.json({
      success: true,
      deletedDocument: documentName,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Document deletion failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
