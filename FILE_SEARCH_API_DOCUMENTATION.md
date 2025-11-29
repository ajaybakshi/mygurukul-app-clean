# File Search API Documentation

## Overview

Complete API reference for the File Search MVP backend. All endpoints are ready for integration with the Spiritual Guidance frontend.

---

## Quick Start Checklist

- [ ] Add `GOOGLE_GENAI_API_KEY` to `.env.local` (see `FILE_SEARCH_SETUP_GUIDE.md`)
- [ ] Add `FILE_SEARCH_ENABLED=true` to `.env.local`
- [ ] Restart dev server (`npm run dev`)
- [ ] Visit `/api/file-search/config/test` to verify setup
- [ ] Visit `/admin/file-search-upload` to create stores and upload PDFs
- [ ] Visit `/admin/file-search-test` to test queries
- [ ] Integrate `/api/wisdom/file-search` endpoint in frontend

---

## API Endpoints

### 1. Configuration Test
**GET** `/api/file-search/config/test`

**Description**: Verify File Search configuration

**Response**:
```json
{
  "configured": true,
  "enabled": true,
  "categories": [
    {
      "id": "vedas",
      "name": "Vedas",
      "storeId": "gurukul-vedas"
    },
    {
      "id": "upanishads",
      "name": "Upanishads",
      "storeId": "gurukul-upanishads"
    },
    {
      "id": "darshanas",
      "name": "Darshanas (Philosophical Systems)",
      "storeId": "gurukul-darshanas"
    }
  ],
  "maxFileSizeMB": 100,
  "supportedFileTypes": ["application/pdf", "text/plain", "..."],
  "message": "✅ File Search is properly configured!"
}
```

---

### 2. Create File Search Stores
**POST** `/api/file-search/stores/create`

**Description**: Create a single store for a category

**Request Body**:
```json
{
  "category": "vedas" // or "upanishads" or "darshanas"
}
```

**Response**:
```json
{
  "success": true,
  "category": "vedas",
  "store": {
    "name": "fileSearchStores/abc123",
    "displayName": "Vedas - MyGurukul Sacred Library",
    "createTime": "2025-11-13T..."
  },
  "message": "Successfully created File Search store for Vedas"
}
```

**PUT** `/api/file-search/stores/create`

**Description**: Create all three stores at once

**Request Body**: None

**Response**:
```json
{
  "success": true,
  "created": 3,
  "total": 3,
  "results": [
    {
      "category": "vedas",
      "success": true,
      "store": { "name": "...", "displayName": "..." }
    },
    // ... upanishads, darshanas
  ],
  "message": "Created 3/3 stores successfully"
}
```

---

### 3. List File Search Stores
**GET** `/api/file-search/stores/list`

**Description**: List all existing stores

**Response**:
```json
{
  "success": true,
  "total": 3,
  "stores": [
    {
      "name": "fileSearchStores/abc123",
      "displayName": "Vedas - MyGurukul Sacred Library",
      "createTime": "2025-11-13T...",
      "updateTime": "2025-11-13T..."
    },
    // ... more stores
  ],
  "categorized": {
    "vedas": { "name": "...", "displayName": "..." },
    "upanishads": { "name": "...", "displayName": "..." },
    "darshanas": { "name": "...", "displayName": "..." },
    "other": []
  },
  "message": "Found 3 File Search stores"
}
```

---

### 4. Delete Store
**DELETE** `/api/file-search/stores/delete`

**Description**: Delete a specific store

**Request Body**:
```json
{
  "storeName": "fileSearchStores/abc123"
}
```

**Response**:
```json
{
  "success": true,
  "deletedStore": "fileSearchStores/abc123",
  "message": "Store deleted successfully"
}
```

---

### 5. Upload Document
**POST** `/api/file-search/upload`

**Description**: Upload a PDF/document to a store

**Request**: Multipart form data
- `file`: The file to upload (File)
- `storeName`: Target store name (string)
- `displayName`: Optional display name for citations (string)

**Response**:
```json
{
  "success": true,
  "file": {
    "name": "Bhagavad_Gita.pdf",
    "displayName": "Bhagavad Gita - English Translation",
    "size": 2457600,
    "type": "application/pdf",
    "sizeMB": "2.34"
  },
  "store": "fileSearchStores/abc123",
  "operation": "operations/xyz789",
  "message": "File uploaded and indexed successfully"
}
```

**Error Response** (timeout):
```json
{
  "success": false,
  "error": "Upload timed out after 60 seconds",
  "operation": "operations/xyz789",
  "message": "The upload is still processing. Please check the operation status later."
}
```

---

### 6. Wisdom Query (Main API) ⭐
**POST** `/api/wisdom/file-search`

**Description**: Query wisdom from File Search stores

**Request Body**:
```json
{
  "question": "What is dharma according to the Vedas?",
  "sessionId": "optional-session-id",
  "category": "all" // or "vedas" or "upanishads" or "darshanas"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "fs-1699876543210",
    "narrative": "The sacred texts speak of dharma as the cosmic order...",
    "citations": [
      {
        "id": "citation-0",
        "text": "Excerpt from the text that was referenced...",
        "source": "Bhagavad Gita - English Translation",
        "uri": "fileSearchStores/.../documents/...",
        "confidence": 1.0
      }
    ],
    "sources": [
      {
        "title": "Bhagavad Gita - English Translation",
        "uri": "fileSearchStores/.../documents/..."
      }
    ],
    "metadata": {
      "provider": "file-search",
      "model": "gemini-2.0-flash-exp",
      "storesSearched": 3,
      "category": "all",
      "responseTime": 2456,
      "citationsCount": 4
    }
  },
  "timestamp": "2025-11-13T12:34:56.789Z"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Question is required",
  "responseTime": 45
}
```

---

### 7. System Test
**GET** `/api/file-search/test`

**Description**: Run comprehensive system tests

**Response**:
```json
{
  "timestamp": "2025-11-13T12:34:56.789Z",
  "tests": [
    {
      "name": "Configuration",
      "status": "passed",
      "details": {
        "apiKeyPresent": true,
        "enabled": true,
        "maxFileSizeMB": 100
      }
    },
    {
      "name": "API Connection",
      "status": "passed",
      "details": {
        "connected": true,
        "storesFound": 3,
        "stores": [...]
      }
    },
    {
      "name": "Store Readiness",
      "status": "passed",
      "details": {
        "totalStores": 3,
        "vedas": 1,
        "upanishads": 1,
        "darshanas": 1,
        "allCategoriesPresent": true
      }
    },
    {
      "name": "Sample Query",
      "status": "passed",
      "details": {
        "queryTime": "2134ms",
        "responseLength": 543,
        "citationsFound": 3
      }
    }
  ],
  "overall": "passed",
  "summary": {
    "total": 4,
    "passed": 4,
    "failed": 0,
    "warnings": 0,
    "skipped": 0
  }
}
```

---

## Frontend Integration Guide

### Integration with Spiritual Guidance Tab

The `/api/wisdom/file-search` endpoint is **100% compatible** with your existing frontend that uses `/api/multi-agent/wisdom`.

#### Option 1: Direct Replacement (Recommended for Testing)

```typescript
// In your wisdom query component
const response = await fetch('/api/wisdom/file-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: userQuestion,
    category: 'all' // or specific category
  })
});

const data = await response.json();

if (data.success) {
  // Use data.data.narrative for the wisdom text
  // Use data.data.citations for references
  // Use data.data.sources for source documents
}
```

#### Option 2: Feature Flag (Recommended for Production)

Add environment variable:
```bash
WISDOM_PROVIDER=file-search # or "multi-agent"
```

Then in your API route:
```typescript
const provider = process.env.WISDOM_PROVIDER || 'multi-agent';
const endpoint = provider === 'file-search' 
  ? '/api/wisdom/file-search'
  : '/api/multi-agent/wisdom';
```

---

## Admin UI Pages

### Upload Interface
**URL**: `/admin/file-search-upload`

**Features**:
- Create all three stores with one click
- Select store (Vedas/Upanishads/Darshanas)
- Upload PDFs with drag-and-drop (future enhancement)
- Set custom display names for citations
- Real-time upload progress

### Test Interface
**URL**: `/admin/file-search-test`

**Features**:
- Run system health checks
- Test sample queries
- View live query results with citations
- Verify configuration
- Debug issues

---

## Response Format Compatibility

### File Search Response vs Multi-Agent Response

Both APIs return the same structure:

```typescript
interface WisdomResponse {
  success: boolean;
  data: {
    sessionId: string;
    narrative: string;
    citations: Array<{
      id: string;
      text: string;
      source: string;
      uri: string;
      confidence: number;
    }>;
    sources: Array<{
      title: string;
      uri: string;
    }>;
    metadata: {
      provider: string;
      model: string;
      responseTime: number;
      citationsCount: number;
      // Additional provider-specific fields
    };
  };
  timestamp: string;
}
```

**Migration Path**: Simply swap the endpoint URL. Your frontend code remains unchanged!

---

## Cost Estimates

### Setup Phase (One-Time)
- **Indexing 10-15 PDFs**: $5-10
- **Create 3 stores**: Free
- **Testing queries**: <$1

### Monthly Operations (1000 queries)
- **Storage (1GB)**: Free
- **Query embeddings**: Free
- **Gemini 2.0 Flash calls**: $5-10
- **Total**: **$5-15/month**

### Comparison with Current System
- **Current (Discovery Engine + Python)**: $200-400/month
- **File Search**: $5-15/month
- **Savings**: ~95% ($185-385/month)

---

## Troubleshooting

### "API Key not found"
1. Check `.env.local` has `GOOGLE_GENAI_API_KEY=your-key`
2. Restart dev server
3. Visit `/api/file-search/config/test` to verify

### "No stores found"
1. Visit `/admin/file-search-upload`
2. Click "Create Stores" button
3. Wait for confirmation
4. Visit `/api/file-search/stores/list` to verify

### "Upload timeout"
1. Check file size (<100MB)
2. Check file format (PDF recommended)
3. Try smaller file first
4. Operation continues in background

### "Query returns empty results"
1. Verify stores have documents: `/api/file-search/stores/list`
2. Upload documents via `/admin/file-search-upload`
3. Test specific categories: `category: "vedas"`
4. Try simpler questions first

---

## Next Steps

1. **Setup Environment** (5 minutes)
   - Follow `FILE_SEARCH_SETUP_GUIDE.md`
   - Add API key to `.env.local`

2. **Create Stores** (2 minutes)
   - Visit `/admin/file-search-upload`
   - Click "Create Stores"

3. **Upload Documents** (10-30 minutes)
   - Prepare 5-10 English PDFs
   - Upload via admin interface

4. **Test System** (5 minutes)
   - Visit `/admin/file-search-test`
   - Run all tests
   - Try sample queries

5. **Integrate Frontend** (10 minutes)
   - Update wisdom query endpoint
   - Test in Spiritual Guidance tab
   - Add category selector (optional)

**Total Time to Launch**: 30-50 minutes (excluding document preparation)

---

## Support

For issues or questions:
1. Check system tests: `/api/file-search/test`
2. Review configuration: `/api/file-search/config/test`
3. Check browser console for errors
4. Review server logs for backend errors

---

**Implementation Complete!** 🎉

All backend code is ready. Follow the setup guide to configure your environment and start uploading documents.



