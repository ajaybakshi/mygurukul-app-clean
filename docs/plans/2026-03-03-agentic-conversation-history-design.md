# Agentic Search: Conversation History Fix

**Date:** 2026-03-03
**Status:** Approved
**Problem:** Agentic search pipeline drops conversation history, causing the Guru to lose context mid-conversation.

## Root Cause

The client (`discoveryEngine.ts`) sends `conversationHistory` in the POST body to `/api/agentic-wisdom`, but the API route never extracts it. None of the 4 pipeline stages (intent classifier, Amarakosha, orchestrator, synthesizer) accept or use conversation history. The file-search path handles this correctly — the agentic path was built stateless.

## Approach: Native Multi-Turn Messages

Thread `conversationHistory` as proper Claude API multi-turn `messages` array (not text blobs) into two stages:

1. **Intent Classifier** — So Haiku resolves pronoun references ("this story") to correct concepts
2. **Synthesizer** — So the Guru maintains conversational continuity in its response

## Files Changed

### 1. `src/app/api/agentic-wisdom/route.ts`
- Extract `conversationHistory` from `body`
- Define shared `ConversationEntry` type
- Pass to `classifyIntent()` and `synthesize()`/`synthesizeStream()`

### 2. `src/lib/anthropic/intentClassifier.ts`
- Add optional `conversationHistory` parameter to `classifyIntent()`
- Convert history to multi-turn messages before current question
- Haiku sees full conversation context for accurate concept extraction

### 3. `src/lib/anthropic/synthesizer.ts`
- Add optional `conversationHistory` parameter to `synthesize()` and `synthesizeStream()`
- Prepend history as multi-turn messages before the synthesis prompt
- Add context-awareness instruction to system prompt when history present

### 4. No changes to:
- `orchestrator.ts` — gets correct search terms from context-aware intent classifier
- `discoveryEngine.ts` — already sends conversationHistory correctly
- `AskTab.tsx` — already passes history (capped at 4 messages via `slice(-4)`)

## Edge Cases
- Empty history (first message): single-message behavior, no regression
- History cap: 4 messages (~2K extra tokens), negligible cost
- Message ordering: filter if history doesn't start with user role (Claude API requirement)
