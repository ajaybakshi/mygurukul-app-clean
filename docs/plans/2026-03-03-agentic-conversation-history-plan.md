# Agentic Search: Conversation History — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Thread conversation history through the agentic search pipeline so the Guru maintains context across multi-turn conversations.

**Architecture:** Add an optional `conversationHistory` parameter to the intent classifier and synthesizer. The API route extracts it from the request body and passes it through. Both stages convert the history into native Claude multi-turn `messages` arrays. No changes to the orchestrator or frontend.

**Tech Stack:** Anthropic Claude API (multi-turn messages), Next.js API routes, TypeScript

---

### Task 1: Add ConversationEntry type and thread history through the API route

**Files:**
- Modify: `src/app/api/agentic-wisdom/route.ts:32-35` (extract from body)
- Modify: `src/app/api/agentic-wisdom/route.ts:50` (pass to classifyIntent)
- Modify: `src/app/api/agentic-wisdom/route.ts:111` (pass to synthesizeStream)
- Modify: `src/app/api/agentic-wisdom/route.ts:163` (pass to synthesize)

**Step 1: Define the type and extract from body**

At line 15, after imports, add the shared type:

```typescript
export type ConversationEntry = { sender: 'user' | 'ai'; text: string };
```

At lines 32-35, add `conversationHistory` extraction:

```typescript
    const body = await req.json();
    question = body.question;
    sessionId = body.sessionId;
    const useStreaming = body.stream ?? true;
    const conversationHistory: ConversationEntry[] | undefined = body.conversationHistory;
```

**Step 2: Pass history to classifyIntent (line 50)**

Change:
```typescript
    const intent = await classifyIntent(question);
```
To:
```typescript
    const intent = await classifyIntent(question, conversationHistory);
```

**Step 3: Pass history to synthesizeStream (line 111)**

Change:
```typescript
          const synthesisStream = synthesizeStream(question, intent, searchResult);
```
To:
```typescript
          const synthesisStream = synthesizeStream(question, intent, searchResult, conversationHistory);
```

**Step 4: Pass history to synthesize (line 163)**

Change:
```typescript
      const responseText = await synthesize(question, intent, searchResult);
```
To:
```typescript
      const responseText = await synthesize(question, intent, searchResult, conversationHistory);
```

**Step 5: Add history message count to log metadata**

In the `request_metadata` objects (lines 140-145 and 185-190), add:
```typescript
conversation_history_length: conversationHistory?.length ?? 0,
```

**Step 6: Verify TypeScript compiles (will fail until Tasks 2 & 3 update signatures)**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors about classifyIntent/synthesize signatures (fixed in next tasks)

---

### Task 2: Add conversation history to Intent Classifier

**Files:**
- Modify: `src/lib/anthropic/intentClassifier.ts:93-101` (function signature + messages)

**Step 1: Import the type**

At line 13, add:
```typescript
import type { ConversationEntry } from '@/app/api/agentic-wisdom/route';
```

**Step 2: Update function signature (line 93)**

Change:
```typescript
export async function classifyIntent(question: string): Promise<QueryIntent> {
```
To:
```typescript
export async function classifyIntent(question: string, conversationHistory?: ConversationEntry[]): Promise<QueryIntent> {
```

**Step 3: Build multi-turn messages (lines 96-101)**

Replace:
```typescript
  const response = await client.messages.create({
    model: MODELS.CLASSIFIER,
    max_tokens: 512,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: question }],
  });
```

With:
```typescript
  // Build messages array with conversation history for context
  const messages: Anthropic.MessageParam[] = [];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      });
    }
    // Ensure messages start with 'user' (Claude API requirement)
    if (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift();
    }
  }
  messages.push({ role: 'user', content: question });

  const response = await client.messages.create({
    model: MODELS.CLASSIFIER,
    max_tokens: 512,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages,
  });
```

**Step 4: Add Anthropic import for the type**

At line 13 area, ensure `Anthropic` is imported:
```typescript
import Anthropic from '@anthropic-ai/sdk';
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Only errors from synthesizer (fixed in Task 3)

---

### Task 3: Add conversation history to Synthesizer

**Files:**
- Modify: `src/lib/anthropic/synthesizer.ts:15-41` (system prompt)
- Modify: `src/lib/anthropic/synthesizer.ts:75-95` (synthesizeStream signature + messages)
- Modify: `src/lib/anthropic/synthesizer.ts:135-150` (synthesize signature + messages)

**Step 1: Import the type and Anthropic**

At line 13, add:
```typescript
import type { ConversationEntry } from '@/app/api/agentic-wisdom/route';
import Anthropic from '@anthropic-ai/sdk';
```

**Step 2: Add context-awareness to system prompt (line 15)**

Change `buildSynthesisSystemPrompt` signature and add a `hasHistory` parameter:

```typescript
function buildSynthesisSystemPrompt(detectedLanguage: string, hasHistory: boolean): string {
  const continuityInstruction = hasHistory
    ? `\n\nCONVERSATION CONTINUITY:\nYou are continuing an ongoing spiritual conversation. The seeker's earlier messages and your prior responses are included in the message history. Maintain continuity — reference prior discussion naturally. If the seeker says "this", "that story", "tell me more", etc., it refers to something from the previous messages.`
    : '';

  return `You are a humble sevak (selfless servant) at MyGurukul. A seeker has asked a question,
and the search agent has found relevant passages from the sacred Sanskrit texts.

The seeker's language: ${detectedLanguage}
${continuityInstruction}

Your task: Synthesize these findings into a warm, grounded response IN THE SEEKER'S LANGUAGE.
...rest stays the same...`;
}
```

Note: Only the first part of the template string changes. Everything from `FORMAT:` onwards stays identical.

**Step 3: Build a helper to convert history to messages**

After the imports, add:

```typescript
function buildHistoryMessages(conversationHistory?: ConversationEntry[]): Anthropic.MessageParam[] {
  if (!conversationHistory || conversationHistory.length === 0) return [];
  const messages: Anthropic.MessageParam[] = [];
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    });
  }
  // Claude API requires first message to be 'user'
  if (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }
  return messages;
}
```

**Step 4: Update synthesizeStream (line 75)**

Change signature:
```typescript
export function synthesizeStream(
  question: string,
  intent: QueryIntent,
  orchestratorResult: OrchestratorResult,
  conversationHistory?: ConversationEntry[]
): ReadableStream<Uint8Array> {
```

Update lines 87-94 inside `start(controller)`:
```typescript
        const systemPrompt = buildSynthesisSystemPrompt(
          intent.detected_language,
          !!conversationHistory?.length
        );
        const userMessage = buildSynthesisMessage(question, orchestratorResult);
        const historyMessages = buildHistoryMessages(conversationHistory);

        const stream = client.messages.stream({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [...historyMessages, { role: 'user', content: userMessage }],
        });
```

**Step 5: Update synthesize (line 135)**

Change signature:
```typescript
export async function synthesize(
  question: string,
  intent: QueryIntent,
  orchestratorResult: OrchestratorResult,
  conversationHistory?: ConversationEntry[]
): Promise<string> {
```

Update lines 142-150:
```typescript
  const systemPrompt = buildSynthesisSystemPrompt(
    intent.detected_language,
    !!conversationHistory?.length
  );
  const userMessage = buildSynthesisMessage(question, orchestratorResult);
  const historyMessages = buildHistoryMessages(conversationHistory);

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [...historyMessages, { role: 'user', content: userMessage }],
  });
```

**Step 6: Verify full TypeScript compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compile, no errors

---

### Task 4: Build verification and commit

**Step 1: Run linter**

Run: `npm run lint`
Expected: No new errors

**Step 2: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Successful build

**Step 3: Manual smoke test (optional)**

Run: `npm run dev`
- Open http://localhost:3000
- Go to Spiritual Guidance tab
- Ask "Tell me about Hanuman"
- Follow up with "tell me more about this story"
- Verify the Guru continues the conversation with context

**Step 4: Commit**

```bash
git add src/app/api/agentic-wisdom/route.ts src/lib/anthropic/intentClassifier.ts src/lib/anthropic/synthesizer.ts
git commit -m "Fix: thread conversation history through agentic search pipeline

The agentic-wisdom API route was receiving conversationHistory from the
client but never extracting or using it. This caused the Guru to lose
context mid-conversation ('I don't know what story you mean').

- Extract conversationHistory in /api/agentic-wisdom route
- Pass to intentClassifier as multi-turn messages (Haiku resolves references)
- Pass to synthesizer as multi-turn messages (Sonnet maintains continuity)
- Add continuity instruction to synthesizer system prompt when history present

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
