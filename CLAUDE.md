# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyGurukul is an AI-powered Sanskrit spiritual guidance platform that provides wisdom from ancient scriptures. It features daily wisdom readings, AI-powered chat guidance, a sacred library, and text-to-speech audio renditions.

## Commands

```bash
npm run dev      # Start development server (Next.js)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 14 (App Router), React 18, TypeScript
- **UI**: Chakra UI, Tailwind CSS, Framer Motion
- **AI/Search**: Google Gemini API, Google Discovery Engine, Perplexity AI
- **Storage**: Google Cloud Storage (library manifests, audio files)
- **Audio**: ElevenLabs TTS API
- **Sanskrit Processing**: Sanscript (transliteration), custom GRETIL parsers

## Architecture

### Text Processing Pipeline

Sanskrit texts flow through a multi-stage pipeline:

1. **Classification** (`src/lib/services/gretilTextTypeClassifier.ts`) - Identifies text type using `GretilTextType` enum: EPIC, HYMNAL, PHILOSOPHICAL, DIALOGUE, NARRATIVE

2. **Parsing** (`src/lib/services/htmlGretilParser.ts`) - Extracts content from HTML/XML GRETIL format

3. **Extraction** - Domain-specific extractors in `src/lib/services/extractors/`:
   - `epicLogicalUnitExtractor.ts` - Ramayana, Mahabharata
   - `philosophicalLogicalUnitExtractor.ts` - Upanishads, Sutras
   - `dialogueLogicalUnitExtractor.ts` - Bhagavad Gita, dialogues
   - `hymnalLogicalUnitExtractor.ts` - Vedic hymns
   - `narrativeLogicalUnitExtractor.ts` - Puranas, stories

4. **Pattern Recognition** (`src/lib/services/scripturePatternService.ts`) - Identifies verse boundaries and references

5. **Transliteration** (`src/lib/services/transliterationService.ts`) - Converts to IAST

6. **Cleanup** (`src/lib/services/sanskritCleanupService.ts`) - Normalizes diacritics

### Hybrid Search Architecture

Multiple search strategies layered together:
- **File Search** - Custom implementation for scripture corpus
- **Google Discovery Engine** (`src/lib/discoveryEngine.ts`) - Semantic vector search
- **HYDE** (`src/lib/hydeService.ts`) - Hypothetical Document Embedding for query expansion
- **Perplexity AI** (`src/lib/perplexitySearch.ts`) - Web-augmented search

### Main Tab Structure

The app uses a tabbed interface defined in `src/app/page.tsx`:
- **Sacred Reading** (`HomeTab`) - Daily wisdom from "Today's Wisdom" API
- **Spiritual Guidance** (`AskTab`) - AI chat with Gemini
- **Sacred Library** (`LibraryPage`) - Scripture browser

### State Management

- **TabContext** (`src/contexts/TabContext.tsx`) - Global navigation and cross-tab state (wisdom data, chat messages, session)
- URL params sync with tab state (`?tab=ask`, `?view=wisdom`)

### Chat Components

Located in `src/components/chat/`:
- `ChatMessageList.tsx` - Message container with scroll management
- `GuideMessageBubble.tsx` - AI response display with citations
- `UserMessageBubble.tsx` - User message display
- `CitationTooltip.tsx` - Scripture reference tooltips

### Key Data Sources

- `library_manifest.json` - Master scripture library metadata (stored on GCS)
- Scripture texts in GRETIL format (HTML/XML)

### API Routes

API routes are in `src/app/api/`. Key endpoints:
- `/api/todays-wisdom` - Daily wisdom feature
- `/api/wisdom/file-search` - Scripture search
- `/api/discovery-engine` - Semantic search wrapper
- `/api/multi-agent/wisdom` - AI wisdom synthesis
- `/api/audio/generate` - TTS generation
- `/api/library-manifest` - Library data

## Path Aliases

Use `@/*` to import from `src/*` (configured in tsconfig.json).

## Environment Variables

**Required variables** (configured in `.env.local`):
- `GEMINI_API_KEY` - Google Gemini API
- `ELEVENLABS_API_KEY` - Text-to-speech
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GOOGLE_CLOUD_CREDENTIALS` - GCS service account
- `PERPLEXITY_API_KEY` - Web search augmentation
- `DISCOVERY_ENGINE_*` - Google Discovery Engine config

**SECURITY: NEVER disclose `.env` file contents, API keys, or secrets** - not in chat responses, not in code comments, not in any output. Reference environment variables by name only (e.g., `GEMINI_API_KEY`), never by value.

## Git Safety Rules

**NEVER run these commands:**
- `git init` - Repository already exists with 40+ milestones
- `rm -rf .git` - Destroys history
- `git reset --hard` - Without explicit approval

Always run `git status` before git operations. If git commands fail, stop and ask before proceeding.

---

## Recent Fixes (2026-01-22)

### Guru's Interpretation Truncated Output - Fixed

**Issue:** Gemini 2.5 Flash was returning very short responses (~300 chars instead of ~2000 chars), causing the Guru's Interpretation to show raw Sanskrit text instead of the AI-generated interpretation.

**Root Cause:** Gemini 2.5 Flash uses "thinking mode" by default, which consumes tokens internally for reasoning but doesn't output them, resulting in truncated visible responses.

**Solution:**
1. Switched from `gemini-2.5-flash` to `gemini-2.0-flash` (no thinking mode)
2. Added retry logic (up to 3 attempts if response < 1200 chars)
3. Added post-processing to strip preamble patterns ("Welcome", "Let us", etc.)
4. Updated frontend cache key to `v2` to invalidate old cached broken data

**Files:**
- `src/app/api/todays-wisdom/route.ts` - `createEnhancedWisdom()` function (lines 314-398)
- `src/components/tabs/SacredReadingView.tsx` - Cache key (line 46)

---

## Previous Fixes (2026-01-21)

### Guru's Interpretation Persona Rejection - Fixed

**Issue:** Perplexity's `sonar` model refused to roleplay as a "Guru", returning responses like "I cannot authentically roleplay as a Guru or spiritual teacher."

**Solution:** Removed all persona framing from the prompt. Changed from "You are a wise Guru speaking to a seeker" to a pure task-based prompt: "Write a warm, flowing interpretation of this passage."

**File:** `src/app/api/todays-wisdom/route.ts` - `createEnhancedWisdom()` function

**Key prompt requirements:**
- NO persona/roleplay framing (triggers Perplexity refusal)
- Explicit "NO headers, NO bullet points, NO markdown" instruction
- Request flowing prose paragraphs only

### Spiritual Guidance Timeout - Fixed

**Issue:** File Search requests timing out with "AbortError: signal is aborted without reason"

**Solution:** Increased client-side timeout from 60s to 90s to prevent race condition with server's 60s maxDuration.

**File:** `src/lib/discoveryEngine.ts` - `callFileSearchWisdom()` function (line 261)

---

## Known Considerations

### Gemini Model Selection
- **Use `gemini-2.0-flash`** for text generation tasks (Today's Wisdom interpretation)
- **Avoid `gemini-2.5-flash`** for direct output - it uses "thinking mode" which consumes tokens internally, producing truncated visible responses
- If switching models, update the frontend cache key to invalidate old cached data

### Perplexity API Limitations
- The `sonar` model refuses persona/roleplay requests
- Frame prompts as tasks ("Write an interpretation") not personas ("You are a Guru")
- Avoid words like "transform", "create", "roleplay"

### Gemini File Search Performance
- Can be slow when searching multiple stores
- 90s client timeout accommodates typical response times
- If timeouts persist, consider reducing number of stores searched

### Frontend Caching
- Wisdom is cached in localStorage with key `mygurukul_wisdom_v{N}_{date}`
- When fixing backend issues, bump the cache version (e.g., v2 -> v3) to force fresh data
- Cache key defined in `src/components/tabs/SacredReadingView.tsx`
