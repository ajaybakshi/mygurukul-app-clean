/**
 * Generate PDFs for all cards in wisdom-batch.json
 *
 * Usage: npx tsx scripts/generate-test-pdfs.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderWisdomPdf } from './pdf/wisdom-card';

const BATCH_PATH = path.resolve(__dirname, '../public/wisdom-batch.json');
const PDF_DIR = path.resolve(__dirname, '../public/wisdom-pdfs');

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }

  // Load batch
  const batchData = JSON.parse(fs.readFileSync(BATCH_PATH, 'utf-8'));
  const cards: any[] = batchData.cards;

  console.log(`Generating PDFs for ${cards.length} wisdom cards...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const card of cards) {
    const outputPath = path.join(PDF_DIR, card.pdfFileName);
    const ref = card.reference;

    // Build a human-readable source reference
    const chapterLabel = ref.chapterTitle
      ? `${ref.chapterTitle} (Chapter ${ref.chapter})`
      : `Chapter ${ref.chapter}`;
    const verseLabel = ref.verseStart === ref.verseEnd
      ? `Verse ${ref.verseStart}`
      : `Verses ${ref.verseStart}-${ref.verseEnd}`;
    const sourceReference = `${ref.textName}, ${chapterLabel}, ${verseLabel}`;

    try {
      await renderWisdomPdf(
        {
          sanskritText: card.iast,
          sourceReference,
          guruInterpretation: card.guruInterpretation,
          reflectionPrompt: card.reflectionPrompt,
          date: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        },
        outputPath
      );
      console.log(`  ✅ ${card.pdfFileName}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ ${card.pdfFileName}:`, err);
      errorCount++;
    }
  }

  console.log(`\nDone: ${successCount} generated, ${errorCount} errors`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
