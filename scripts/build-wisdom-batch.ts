#!/usr/bin/env tsx
/**
 * Build Wisdom Batch
 *
 * Takes the master wisdom-index.json and produces a fully pre-computed batch
 * of N wisdom cards with Guru's interpretation + PDFs.
 *
 * Usage:
 *   npm run build:wisdom-batch                   # Generate 365 cards (default)
 *   BATCH_SIZE=90 npm run build:wisdom-batch      # Generate 90 cards
 *   npm run build:wisdom-batch -- --dry-run       # Preview selection only
 *
 * Requires:
 *   - public/wisdom-index.json (from build:wisdom-index)
 *   - GOOGLE_GENAI_API_KEY env variable (for Gemini 2.0 Flash)
 *
 * Cost estimate: 365 cards × 1 Gemini call ≈ $0.36
 * Time estimate: ~20-30 minutes for 365 cards
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local (where Next.js stores env vars) then .env as fallback
dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import { renderWisdomPdf } from './pdf/wisdom-card';
import type {
  WisdomIndex,
  WisdomCandidate,
  PreparedWisdomCard,
  WisdomBatch,
  WisdomTextMeta,
} from '../src/lib/tei/teiTypes';

// ─── Configuration ───────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '365', 10);
const MAX_PER_TEXT = 50; // With 28 texts, ~13 avg per text for 365 cards
const INDEX_PATH = path.resolve(__dirname, '../public/wisdom-index.json');
const BATCH_PATH = path.resolve(__dirname, '../public/wisdom-batch.json');
const PDF_DIR = path.resolve(__dirname, '../public/wisdom-pdfs');

// ─── Gemini Client ───────────────────────────────────────────────

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY environment variable is required');
  }
  return new GoogleGenAI({ apiKey });
}

// ─── Candidate Selection ─────────────────────────────────────────

/**
 * Select candidates ensuring diversity:
 * - No more than MAX_PER_TEXT from any single text
 * - At least 1 from each category (if available)
 * - Quality-weighted random selection
 * - No adjacent days from the same text (post-selection shuffle)
 */
function selectCandidates(
  index: WisdomIndex,
  count: number,
  excludeIds: Set<string> = new Set()
): WisdomCandidate[] {
  // Group candidates by text and category
  const byText = new Map<string, WisdomCandidate[]>();
  const byCategory = new Map<string, WisdomCandidate[]>();

  for (const c of index.candidates) {
    if (excludeIds.has(c.id)) continue;

    if (!byText.has(c.textId)) byText.set(c.textId, []);
    byText.get(c.textId)!.push(c);

    const text = index.texts.find(t => t.id === c.textId);
    const cat = text?.category || 'Unknown';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(c);
  }

  const selected: WisdomCandidate[] = [];
  const textCounts = new Map<string, number>();

  // Phase 1: Ensure at least 1 from each category
  for (const [cat, candidates] of byCategory) {
    if (selected.length >= count) break;
    const best = weightedSelect(candidates, 1);
    if (best.length > 0) {
      selected.push(best[0]);
      textCounts.set(best[0].textId, 1);
    }
  }

  // Phase 2: Fill remaining with quality-weighted selection
  // Oversample to account for MAX_PER_TEXT skips, then iterate
  const remaining = index.candidates.filter(c =>
    !excludeIds.has(c.id) &&
    !selected.some(s => s.id === c.id)
  );

  const shuffled = weightedSelect(remaining, Math.min(remaining.length, count * 3));
  for (const c of shuffled) {
    if (selected.length >= count) break;
    const currentCount = textCounts.get(c.textId) || 0;
    if (currentCount >= MAX_PER_TEXT) continue;

    selected.push(c);
    textCounts.set(c.textId, currentCount + 1);
  }

  // Phase 3: Shuffle to avoid adjacent days from the same text
  return shuffleNoAdjacent(selected);
}

function weightedSelect(candidates: WisdomCandidate[], count: number): WisdomCandidate[] {
  // Quality-weighted shuffle: higher quality = more likely to appear first
  const weighted = candidates.map(c => ({
    candidate: c,
    sortKey: Math.random() * c.qualityScore,
  }));
  weighted.sort((a, b) => b.sortKey - a.sortKey);
  return weighted.slice(0, count).map(w => w.candidate);
}

function shuffleNoAdjacent(cards: WisdomCandidate[]): WisdomCandidate[] {
  // Simple approach: repeatedly shuffle until no adjacent same-text, with limit
  let result = [...cards];
  for (let attempt = 0; attempt < 50; attempt++) {
    // Fisher-Yates shuffle
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    // Check for adjacent same-text
    let hasAdjacent = false;
    for (let i = 1; i < result.length; i++) {
      if (result[i].textId === result[i - 1].textId) {
        hasAdjacent = true;
        break;
      }
    }
    if (!hasAdjacent) return result;
  }
  return result; // Best effort after 50 attempts
}

// ─── Gemini Interpretation ───────────────────────────────────────

async function generateInterpretation(
  ai: GoogleGenAI,
  candidate: WisdomCandidate,
  textMeta: WisdomTextMeta
): Promise<{ interpretation: string; reflectionPrompt: string }> {
  const ref = candidate.reference;
  const sourceDesc = `${textMeta.displayName}, ${ref.chapterTitle || `Chapter ${ref.chapter}`}, ` +
    (ref.verseCount > 1
      ? `Verses ${ref.verseStart}-${ref.verseEnd}`
      : `Verse ${ref.verseStart}`);

  const prompt = `You are writing a spiritual interpretation for readers of the ${textMeta.displayName}.

SCRIPTURE PASSAGE (${sourceDesc}):
${candidate.iast}

INSTRUCTIONS:
Write a complete interpretation of this passage. Your response MUST:
1. Be exactly 300-400 words (this is mandatory - responses under 250 words are unacceptable)
2. Start IMMEDIATELY with the content - NO greetings, NO "Welcome", NO "Let us explore"
3. Use warm, accessible language in flowing paragraphs
4. Explain the context and meaning of this scripture
5. Show how this wisdom applies to modern life
6. End with a reflective thought

FORMAT RULES:
- NO headers, NO bullet points, NO numbered lists
- NO markdown formatting
- Write as continuous flowing prose
- Address the reader directly using "you" and "your"

After the interpretation, on a new line write "REFLECTION:" followed by a single contemplative question (1-2 sentences) for the reader to sit with today.

CRITICAL: Your first word must be part of the interpretation itself. Do NOT start with any form of greeting or introduction.

Begin now:`;

  const maxRetries = 2;
  let text = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          temperature: 0.8,
          topP: 0.95,
          maxOutputTokens: 2000,
        },
      });

      text = response.text || '';

      if (text.length >= 1200) break;
      if (attempt < maxRetries) {
        console.log(`    Retry ${attempt + 1}: response too short (${text.length} chars)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    Gemini error (attempt ${attempt + 1}): ${msg}`);
      if (attempt === maxRetries) throw err;
    }
  }

  // Strip preamble patterns
  const preamblePatterns = [
    /^(Welcome|Let us|Let's|Today|In this|Here|Greetings)[^.]*\.\s*/i,
  ];
  let cleanedText = text;
  for (const pattern of preamblePatterns) {
    cleanedText = cleanedText.replace(pattern, '');
  }

  // Split interpretation from reflection prompt
  let interpretation = cleanedText.trim();
  let reflectionPrompt = `What aspect of this teaching from ${textMeta.displayName} resonates most deeply with your life today?`;

  const reflectionMatch = interpretation.match(/REFLECTION:\s*([\s\S]+)/i);
  if (reflectionMatch) {
    interpretation = interpretation.slice(0, reflectionMatch.index).trim();
    reflectionPrompt = reflectionMatch[1].trim();
  }

  return { interpretation, reflectionPrompt };
}

// ─── PDF Generation ──────────────────────────────────────────────

async function generatePdf(
  card: PreparedWisdomCard,
  textMeta: WisdomTextMeta
): Promise<void> {
  const ref = card.reference;
  const sourceRef = `${textMeta.displayName}, ${ref.chapterTitle || `Chapter ${ref.chapter}`}, ` +
    (ref.verseCount > 1
      ? `Verses ${ref.verseStart}-${ref.verseEnd}`
      : `Verse ${ref.verseStart}`);

  const outputPath = path.join(PDF_DIR, card.pdfFileName);

  await renderWisdomPdf({
    sanskritText: card.iast,
    sourceReference: sourceRef,
    guruInterpretation: card.guruInterpretation,
    reflectionPrompt: card.reflectionPrompt,
  }, outputPath);
}

// ─── Main Build Function ─────────────────────────────────────────

async function buildWisdomBatch(): Promise<void> {
  console.log(`=== Building Wisdom Batch (${BATCH_SIZE} cards${DRY_RUN ? ', DRY RUN' : ''}) ===\n`);

  // Load master index
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`wisdom-index.json not found at ${INDEX_PATH}. Run build:wisdom-index first.`);
  }

  const index: WisdomIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  console.log(`Loaded index: ${index.candidates.length} candidates from ${index.texts.length} texts\n`);

  // Load existing batch if any (to get used IDs)
  let existingUsedIds = new Set<string>();
  if (fs.existsSync(BATCH_PATH)) {
    const existing: WisdomBatch = JSON.parse(fs.readFileSync(BATCH_PATH, 'utf-8'));
    existingUsedIds = new Set(existing.usedCardIds);
    console.log(`Existing batch found: ${existing.cards.length} cards, ${existingUsedIds.size} used\n`);
  }

  // Select candidates
  const selected = selectCandidates(index, BATCH_SIZE, existingUsedIds);
  console.log(`Selected ${selected.length} candidates for batch\n`);

  // Show selection summary
  const catCounts: Record<string, number> = {};
  const textCounts: Record<string, number> = {};
  for (const c of selected) {
    const text = index.texts.find(t => t.id === c.textId);
    const cat = text?.category || 'Unknown';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    textCounts[c.textId] = (textCounts[c.textId] || 0) + 1;
  }

  console.log('Category distribution:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log('\nText distribution:');
  for (const [textId, count] of Object.entries(textCounts).sort((a, b) => b[1] - a[1])) {
    const text = index.texts.find(t => t.id === textId);
    console.log(`  ${text?.displayName || textId}: ${count}`);
  }

  if (DRY_RUN) {
    console.log('\n=== DRY RUN — no Gemini calls or PDFs generated ===');
    return;
  }

  // Initialize Gemini
  const ai = getGeminiClient();

  // Prepare output directory
  fs.mkdirSync(PDF_DIR, { recursive: true });

  // Process each candidate
  const cards: PreparedWisdomCard[] = [];
  const errors: string[] = [];
  const startTime = Date.now();
  const idCounts = new Map<string, number>(); // Track duplicate IDs

  for (let i = 0; i < selected.length; i++) {
    const candidate = selected[i];
    const textMeta = index.texts.find(t => t.id === candidate.textId);

    if (!textMeta) {
      errors.push(`No text metadata for ${candidate.textId}`);
      continue;
    }

    // Make IDs unique by appending a suffix for duplicates
    const baseId = candidate.id;
    const seenCount = idCounts.get(baseId) || 0;
    idCounts.set(baseId, seenCount + 1);
    const uniqueId = seenCount > 0 ? `${baseId}-v${seenCount + 1}` : baseId;

    const progress = `[${i + 1}/${selected.length}]`;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const avgPerCard = i > 0 ? elapsed / i : 5;
    const eta = Math.round(avgPerCard * (selected.length - i));
    const etaMin = Math.floor(eta / 60);
    const etaSec = eta % 60;

    console.log(`${progress} ${uniqueId} (${textMeta.displayName}) [ETA: ${etaMin}m${etaSec}s]`);

    try {
      // Generate interpretation
      const { interpretation, reflectionPrompt } = await generateInterpretation(
        ai, candidate, textMeta
      );
      console.log(`  Interpretation: ${interpretation.length} chars`);

      // Build PDF filename with unique ID
      const pdfFileName = `${uniqueId}.pdf`;

      const card: PreparedWisdomCard = {
        ...candidate,
        id: uniqueId,
        guruInterpretation: interpretation,
        reflectionPrompt,
        pdfFileName,
        preparedAt: new Date().toISOString(),
      };

      // Generate PDF
      await generatePdf(card, textMeta);

      cards.push(card);

      // Rate limiting: 500ms delay between Gemini calls
      if (i < selected.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${msg}`);
      errors.push(`${candidate.id}: ${msg}`);
    }
  }

  // Write batch file
  const batch: WisdomBatch = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    cards,
    usedCardIds: [...existingUsedIds],
  };

  fs.writeFileSync(BATCH_PATH, JSON.stringify(batch, null, 2), 'utf-8');

  // Report
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const totalMin = Math.floor(totalTime / 60);
  const totalSec = totalTime % 60;

  console.log('\n=== Batch Build Complete ===\n');
  console.log(`Cards generated: ${cards.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Total time: ${totalMin}m ${totalSec}s`);
  console.log(`Batch file: ${BATCH_PATH}`);
  console.log(`PDF directory: ${PDF_DIR}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
  }

  console.log(`\nNext step: Deploy with WISDOM_SOURCE=tei`);
}

// ─── Run ─────────────────────────────────────────────────────────

buildWisdomBatch().catch((err) => {
  console.error('Batch build failed:', err);
  process.exit(1);
});
