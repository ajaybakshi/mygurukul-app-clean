/**
 * File Search Upload Endpoint
 * Uploads documents to File Search stores using Google GenAI SDK
 * Documentation: https://ai.google.dev/gemini-api/docs/file-search
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFileSearchConfig } from '../../../../lib/fileSearchConfig';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export const runtime = 'nodejs'; // For file handling
export const maxDuration = 60; // Uploads can take time

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const config = getFileSearchConfig();

    if (!config.apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'GOOGLE_GENAI_API_KEY not configured',
          help: 'Please check FILE_SEARCH_SETUP_GUIDE.md',
        },
        { status: 500 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const storeName = formData.get('storeName') as string | null;
    const displayName = formData.get('displayName') as string | null;

    // Validation
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'File is required',
        },
        { status: 400 }
      );
    }

    if (!storeName || typeof storeName !== 'string' || storeName.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'storeName is required and must be a non-empty string',
        },
        { status: 400 }
      );
    }

    // Validate store name format (should be like "fileSearchStores/abc123")
    if (!storeName.startsWith('fileSearchStores/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid store name format. Must start with "fileSearchStores/"',
        },
        { status: 400 }
      );
    }

    // Validate file size (100MB limit per docs)
    const maxSizeBytes = config.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds limit of ${config.maxFileSizeMB}MB`,
          fileSize: file.size,
          maxSize: maxSizeBytes,
        },
        { status: 413 }
      );
    }

    // Validate file type
    const fileType = file.type || '';
    const isSupportedType =
      config.supportedFileTypes.includes(fileType) ||
      fileType.startsWith('text/') ||
      fileType.startsWith('application/');

    if (!isSupportedType && fileType !== '') {
      console.warn(
        `⚠️  File type "${fileType}" may not be fully supported. Proceeding anyway...`
      );
    }

    // Get file metadata
    const fileName = file.name;
    const fileSize = file.size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    const finalDisplayName = displayName || fileName.replace(/_/g, ' ').replace(/\.[^/.]+$/, '');

    console.log(`📤 Uploading file to File Search store:`);
    console.log(`   File: ${fileName} (${fileSizeMB}MB)`);
    console.log(`   Store: ${storeName}`);
    console.log(`   Display Name: ${finalDisplayName}`);

    // Initialize Google GenAI client
    const client = new GoogleGenAI({ apiKey: config.apiKey });

    // Convert File to Buffer for SDK
    // The SDK expects a file path in Node.js context
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to temporary file for SDK (SDK expects file path in Node.js)
    const tempDir = tmpdir();
    const tempFileName = `upload_${Date.now()}_${fileName}`;
    const tempFilePath = join(tempDir, tempFileName);

    try {
      // Write file to temp location
      await writeFile(tempFilePath, buffer);

      console.log(`📁 Saved file to temp location: ${tempFilePath}`);

      // Upload to File Search store using official SDK method
      const operation = await client.fileSearchStores.uploadToFileSearchStore({
        file: tempFilePath, // File path for Node.js
        fileSearchStoreName: storeName,
        config: {
          displayName: finalDisplayName,
        },
      });

      console.log(`✅ Upload operation started: ${operation.name}`);
      console.log(`   Operation done: ${operation.done}`);

      // Clean up temp file immediately (operation is async)
      try {
        await unlink(tempFilePath);
        console.log(`🗑️  Cleaned up temp file`);
      } catch (cleanupError) {
        console.warn(`⚠️  Failed to cleanup temp file: ${cleanupError}`);
      }

      // For MVP, return immediately and let processing happen async
      // The operation will complete in the background
      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        file: {
          name: fileName,
          displayName: finalDisplayName,
          size: fileSize,
          type: fileType || 'application/octet-stream',
          sizeMB: fileSizeMB,
        },
        store: storeName,
        operation: operation.name,
        operationDone: operation.done,
        message: operation.done
          ? 'File uploaded and indexed successfully'
          : 'File upload started. Indexing in progress...',
        metadata: {
          uploadTime: totalTime,
          operationStatus: operation.done ? 'completed' : 'processing',
        },
      });
    } catch (uploadError) {
      // Clean up temp file on error
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw uploadError;
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ File upload failed after ${totalTime}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
        uploadTime: totalTime,
      },
      { status: 500 }
    );
  }
}
