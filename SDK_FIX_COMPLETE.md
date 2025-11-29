# File Search SDK Fix - COMPLETE

**Date**: November 14, 2025  
**Status**: ✅ **READY TO TEST**

---

## Root Cause Identified

From systematic debugging of your console logs:

**Line 61 Error**: `Unknown name "config": Cannot find field`

### The Problem

We had **TWO different Google SDKs** installed in `package.json`:
1. **`@google/genai`** (v1.29.1) - **NEW SDK** - Supports File Search with `config` parameter
2. **`@google/generative-ai`** (v0.24.1) - **OLD SDK** - Does NOT support `config` parameter

We were:
- ❌ **Importing** from the OLD SDK (`@google/generative-ai`)
- ❌ **Using** the NEW SDK's API format (with `config` parameter)
- ❌ Result: API rejection with "Unknown name 'config'"

---

## The Fix

### Changed Import Statement

**Before**:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';  // OLD SDK
const genAI = new GoogleGenerativeAI(config.apiKey);
```

**After**:
```typescript
import { GoogleGenAI } from '@google/genai';  // NEW SDK
const genAI = new GoogleGenAI({ apiKey: config.apiKey });
```

### Changed API Call

**Before** (OLD SDK format):
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
const result = await model.generateContent(spiritualPrompt, generationConfig);
```

**After** (NEW SDK format per [official docs](https://ai.google.dev/gemini-api/docs/file-search)):
```typescript
const response = await genAI.models.generateContent({
  model: 'gemini-2.0-flash-exp',
  contents: spiritualPrompt,
  config: {
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 2048,
    tools: [{
      fileSearch: {
        fileSearchStoreNames
      }
    }]
  }
});
```

---

## Files Modified

1. **`src/app/api/wisdom/file-search/route.ts`**
   - Removed import of `@google/generative-ai` (OLD SDK)
   - Now exclusively uses `@google/genai` (NEW SDK)
   - Updated `generateContent()` call to match NEW SDK API
   - Updated response parsing for NEW SDK structure

---

## Why This Works

According to [Google's File Search documentation](https://ai.google.dev/gemini-api/docs/file-search):

1. The **JavaScript examples** use `@google/genai` (NEW SDK)
2. The NEW SDK supports the `config` parameter with `tools` array
3. File Search is properly integrated in the NEW SDK
4. The OLD SDK (`@google/generative-ai`) doesn't support File Search with the same API

---

## Testing Instructions

### 1. Restart Dev Server

```bash
cd /Users/AJ/Desktop/mygurukul-app
npm run dev
```

### 2. Run Test Query

```bash
curl -X POST http://localhost:3000/api/wisdom/file-search \
  -H "Content-Type: application/json" \
  -d '{"question": "Tell me about Rama in the Ramayana"}'
```

### 3. Expected Console Logs

#### ✅ SUCCESS Indicators:

```
🔧 Generating with File Search tools using NEW SDK (@google/genai)
📊 Raw Gemini Response Structure (NEW SDK):
  Response type: object
  Has text: true
  Has candidates: true
  Has groundingMetadata: true  ← SHOULD BE TRUE NOW
  GroundingChunks count: 3+    ← SHOULD BE > 0
📚 Citation Extraction:
  Raw citations array length: 3 ← SHOULD BE > 0
✨ Formatted Citations:
  Count: 3                      ← SHOULD BE > 0
```

#### Response Should Include:

```json
{
  "success": true,
  "data": {
    "narrative": "Namaste. Based on the Ramayana, Rama is...",
    "citations": [
      {
        "id": "citation-0",
        "text": "Actual text from your Ramayana document...",
        "source": "Ramayana.pdf",
        "uri": "fileSearchStores/epics-mygurukul-sacred-libr-wgzuh46tehax/documents/..."
      }
    ],
    "metadata": {
      "citationsCount": 3,
      "grounded": true
    }
  }
}
```

---

## Verification Checklist

- ✅ No more "Unknown name 'config'" error
- ✅ File Search tool properly invoked
- ✅ `groundingMetadata` exists in response
- ✅ Citations contain actual text from documents
- ✅ No hallucinations (fake file references)
- ✅ Grounded answers from uploaded scriptures

---

## Additional Test Queries

```bash
# Test Atman
curl -X POST http://localhost:3000/api/wisdom/file-search \
  -H "Content-Type: application/json" \
  -d '{"question": "What is Atman according to the Upanishads?"}'

# Test Dharma
curl -X POST http://localhost:3000/api/wisdom/file-search \
  -H "Content-Type: application/json" \
  -d '{"question": "What is dharma?"}'
```

---

## Technical Details

### SDK Comparison

| Feature | @google/generative-ai (OLD) | @google/genai (NEW) |
|---------|----------------------------|---------------------|
| File Search | ❌ Limited/No support | ✅ Full support |
| API Format | `model.generateContent(prompt, config)` | `genai.models.generateContent({ model, contents, config })` |
| Config Parameter | ❌ Not supported | ✅ Supported |
| Tools Array | ❌ Not in config | ✅ In config.tools |

### Why We Keep Both SDKs

- **`@google/genai`** (NEW) - Used for File Search queries (this endpoint)
- **`@google/generative-ai`** (OLD) - May be used elsewhere in the codebase

Both can coexist, we just need to use the right one for each purpose.

---

## Next Steps

1. **Test the fix** with the curl commands above
2. **Share console logs** if any issues remain
3. **If successful**: Test in browser UI at `http://localhost:3000`
4. **Clean up**: Remove verbose debug logging once confirmed working
5. **Document**: Update main documentation with SDK choice rationale

---

**Status**: Implementation complete, ready for testing  
**Confidence**: Very High - Using correct SDK per Google's official docs  
**Action Required**: Run test query and verify grounding works! 🎯
