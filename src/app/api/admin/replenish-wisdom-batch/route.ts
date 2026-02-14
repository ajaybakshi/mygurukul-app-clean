/**
 * Admin Replenish Wisdom Batch
 *
 * POST /api/admin/replenish-wisdom-batch
 * Headers: { Authorization: Bearer <ADMIN_SECRET_TOKEN> }
 * Body: { count?: number }  // Default: 30 new cards
 *
 * Generates new wisdom cards (Gemini + PDF) and appends them to the batch.
 * Can be called manually or by a Vercel Cron Job.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import type {
  WisdomIndex,
  WisdomBatch,
  WisdomCandidate,
  WisdomTextMeta,
  PreparedWisdomCard,
} from '@/lib/tei/teiTypes';
import * as wisdomBatchService from '@/lib/tei/wisdomBatchService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for batch generation

// ─── Auth ────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  if (!adminToken) return false;

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === adminToken;
  }

  // Also accept query param for cron jobs
  const url = new URL(request.url);
  return url.searchParams.get('token') === adminToken;
}

// ─── POST Handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.min(body.count || 30, 100); // Cap at 100

    console.log(`[Replenish] Generating ${count} new wisdom cards...`);

    // Load index and batch
    const indexPath = path.resolve(process.cwd(), 'public/wisdom-index.json');
    const batchPath = path.resolve(process.cwd(), 'public/wisdom-batch.json');
    const pdfDir = path.resolve(process.cwd(), 'public/wisdom-pdfs');

    if (!fs.existsSync(indexPath)) {
      return NextResponse.json(
        { error: 'wisdom-index.json not found. Run build:wisdom-index first.' },
        { status: 500 }
      );
    }

    const index: WisdomIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    let batch: WisdomBatch;

    if (fs.existsSync(batchPath)) {
      batch = JSON.parse(fs.readFileSync(batchPath, 'utf-8'));
    } else {
      batch = { version: '1.0.0', generatedAt: new Date().toISOString(), cards: [], usedCardIds: [] };
    }

    // Get used IDs from both batch file and runtime
    const usedIds = new Set([
      ...batch.usedCardIds,
      ...wisdomBatchService.getUsedCardIds(),
      ...batch.cards.map(c => c.id),
    ]);

    // Select new candidates
    const available = index.candidates.filter(c => !usedIds.has(c.id));
    if (available.length === 0) {
      return NextResponse.json({
        success: true,
        cardsGenerated: 0,
        batchStatus: await wisdomBatchService.getBatchStatus(),
        message: 'No more candidates available in the index.',
      });
    }

    // Quality-weighted selection
    const weighted = available
      .map(c => ({ candidate: c, sortKey: Math.random() * c.qualityScore }))
      .sort((a, b) => b.sortKey - a.sortKey)
      .slice(0, count)
      .map(w => w.candidate);

    // Initialize Gemini
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_GENAI_API_KEY not configured' },
        { status: 500 }
      );
    }
    const ai = new GoogleGenAI({ apiKey });

    fs.mkdirSync(pdfDir, { recursive: true });

    const newCards: PreparedWisdomCard[] = [];
    const errors: string[] = [];

    for (const candidate of weighted) {
      const textMeta = index.texts.find(t => t.id === candidate.textId);
      if (!textMeta) continue;

      try {
        // Generate interpretation
        const { interpretation, reflectionPrompt } = await generateInterpretation(
          ai, candidate, textMeta
        );

        const pdfFileName = `${candidate.id}.pdf`;
        const card: PreparedWisdomCard = {
          ...candidate,
          guruInterpretation: interpretation,
          reflectionPrompt,
          pdfFileName,
          preparedAt: new Date().toISOString(),
        };

        // Note: PDF generation requires @react-pdf/renderer which may not
        // work in Vercel serverless. PDFs are best generated in the build script.
        // For runtime replenish, we skip PDF generation.

        newCards.push(card);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${candidate.id}: ${msg}`);
      }
    }

    // Append new cards to batch
    batch.cards.push(...newCards);
    batch.generatedAt = new Date().toISOString();
    fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2), 'utf-8');

    // Invalidate cache
    wisdomBatchService.invalidateCache();

    const status = await wisdomBatchService.getBatchStatus();

    return NextResponse.json({
      success: true,
      cardsGenerated: newCards.length,
      batchStatus: status,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[Replenish] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ─── Gemini Interpretation (reused from batch script) ────────────

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

Begin now:`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2000,
    },
  });

  let text = response.text || '';

  // Strip preamble patterns
  text = text.replace(/^(Welcome|Let us|Let's|Today|In this|Here|Greetings)[^.]*\.\s*/i, '');

  let interpretation = text.trim();
  let reflectionPrompt = `What aspect of this teaching from ${textMeta.displayName} resonates most deeply with your life today?`;

  const reflectionMatch = interpretation.match(/REFLECTION:\s*([\s\S]+)/i);
  if (reflectionMatch) {
    interpretation = interpretation.slice(0, reflectionMatch.index).trim();
    reflectionPrompt = reflectionMatch[1].trim();
  }

  return { interpretation, reflectionPrompt };
}
