/**
 * TEI XML Parser
 *
 * Parses SARIT TEI P5 XML files into structured documents using fast-xml-parser.
 * Handles three structural patterns:
 *   1. Verse: <lg n="X"><l>line</l></lg>
 *   2. Sutra+Commentary: <div type="sūtra_with_bhāṣya"><quote type="sutra"><p>text <label/></p></quote>
 *   3. Labeled Prose: <p><label>KAZ01.1.01</label>text</p>
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  TEIDocument,
  TEIDivision,
  TEIVerse,
  TEIParagraph,
  TEIBody,
} from './teiTypes';

// ─── Parser Configuration ────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  preserveOrder: false,
  trimValues: true,
  // Keep arrays for elements that can repeat
  isArray: (name) => ['l', 'lg', 'div', 'p', 'label', 'seg', 'quote'].includes(name),
});

// ─── Public API ──────────────────────────────────────────────────

/**
 * Parse a TEI XML string into a structured document.
 */
export function parseTEI(xmlContent: string): TEIDocument {
  const parsed = parser.parse(xmlContent);
  const tei = parsed.TEI;

  if (!tei) {
    throw new Error('Invalid TEI XML: no <TEI> root element');
  }

  const title = extractTitle(tei);
  const lang = detectScript(tei);
  const bodyNode = tei.text?.body;

  if (!bodyNode) {
    throw new Error('Invalid TEI XML: no <text><body> element');
  }

  const body = parseBody(bodyNode);

  return {
    id: tei['@_xml:id'] || '',
    title,
    lang,
    body,
  };
}

/**
 * Detect the script from the <text xml:lang="..."> attribute.
 */
export function detectScript(tei: any): 'sa-Latn' | 'sa-Deva' {
  // Check <text xml:lang="...">
  const textLang = tei.text?.['@_xml:lang'];
  if (textLang) {
    if (textLang.includes('Deva')) return 'sa-Deva';
    if (textLang.includes('Latn')) return 'sa-Latn';
  }

  // Check <body xml:lang="...">
  const bodyLang = tei.text?.body?.['@_xml:lang'];
  if (bodyLang) {
    if (bodyLang.includes('Deva')) return 'sa-Deva';
    if (bodyLang.includes('Latn')) return 'sa-Latn';
  }

  // Default to IAST (Latin) as most SARIT texts use this
  return 'sa-Latn';
}

/**
 * Extract the main title from <teiHeader><fileDesc><titleStmt><title type="main">.
 */
export function extractTitle(tei: any): string {
  const titleStmt = tei.teiHeader?.fileDesc?.titleStmt;
  if (!titleStmt) return 'Unknown Text';

  const titleNode = titleStmt.title;
  if (!titleNode) return 'Unknown Text';

  // title can be a single object or array
  const titles = Array.isArray(titleNode) ? titleNode : [titleNode];

  // Prefer type="main"
  for (const t of titles) {
    if (typeof t === 'string') return t;
    if (t['@_type'] === 'main') {
      return extractTextContent(t);
    }
  }

  // Fallback to first title
  return extractTextContent(titles[0]);
}

// ─── Internal Parsers ────────────────────────────────────────────

function parseBody(bodyNode: any): TEIBody {
  const divisions = parseDivisions(bodyNode);

  // Handle body-level <lg> and <p> elements that aren't inside a <div>.
  // Files like Katha Upanishad have <lg> directly under <body>.
  const bodyVerses = parseVerses(bodyNode);
  const bodyParagraphs = parseParagraphs(bodyNode);

  if (bodyVerses.length > 0 || bodyParagraphs.length > 0) {
    // Create a synthetic root division for loose body content
    const syntheticDiv: TEIDivision = {
      n: '1',
      type: undefined,
      head: undefined,
      verses: bodyVerses,
      paragraphs: bodyParagraphs,
      children: [],
    };
    // Prepend so body-level content comes first
    divisions.unshift(syntheticDiv);
  }

  return { divisions };
}

/**
 * Recursively parse <div> elements. Each div may contain child divs,
 * verses (<lg>), and paragraphs (<p>).
 */
function parseDivisions(node: any): TEIDivision[] {
  const divNodes = node.div;
  if (!divNodes) return [];

  const divArray = Array.isArray(divNodes) ? divNodes : [divNodes];
  return divArray.map(parseSingleDivision);
}

function parseSingleDivision(divNode: any): TEIDivision {
  const div: TEIDivision = {
    n: divNode['@_n'],
    type: divNode['@_type'],
    head: extractTextContent(divNode.head),
    verses: parseVerses(divNode),
    paragraphs: parseParagraphs(divNode),
    children: parseDivisions(divNode),
  };

  // Also parse sutra quotes within sūtra_with_bhāṣya divs
  if (divNode.quote) {
    const quotes = Array.isArray(divNode.quote) ? divNode.quote : [divNode.quote];
    for (const q of quotes) {
      if (q['@_type'] === 'sutra') {
        const sutraParagraphs = parseSutraParagraphs(q);
        div.paragraphs.push(...sutraParagraphs);
      }
    }
  }

  return div;
}

/**
 * Parse <lg> (line-group / verse) elements.
 */
function parseVerses(node: any): TEIVerse[] {
  const lgNodes = node.lg;
  if (!lgNodes) return [];

  const lgArray = Array.isArray(lgNodes) ? lgNodes : [lgNodes];
  return lgArray.map((lg: any) => {
    const lines = parseLinesFromLg(lg);
    return {
      id: lg['@_xml:id'] || lg['@_id'],
      n: lg['@_n'],
      lines,
    };
  });
}

/**
 * Extract text from <l> elements within an <lg>.
 * Handles nested <seg> elements in Mahabharata-style markup.
 */
function parseLinesFromLg(lg: any): string[] {
  const lNodes = lg.l;
  if (!lNodes) return [];

  const lArray = Array.isArray(lNodes) ? lNodes : [lNodes];
  return lArray.map((l: any) => extractTextContent(l)).filter((s: string) => s.length > 0);
}

/**
 * Parse <p> elements, extracting any <label> as the reference.
 */
function parseParagraphs(node: any): TEIParagraph[] {
  const pNodes = node.p;
  if (!pNodes) return [];

  const pArray = Array.isArray(pNodes) ? pNodes : [pNodes];
  return pArray.map((p: any) => {
    // Use <label> child first; fall back to xml:id attribute as reference
    const label = extractLabelText(p) || p['@_xml:id'] || undefined;
    const text = extractTextContent(p);
    return {
      label,
      text,
      isSutra: false,
    };
  }).filter((p: TEIParagraph) => p.text.length > 0);
}

/**
 * Parse paragraphs inside a <quote type="sutra"> element.
 */
function parseSutraParagraphs(quoteNode: any): TEIParagraph[] {
  const pNodes = quoteNode.p;
  if (!pNodes) return [];

  const pArray = Array.isArray(pNodes) ? pNodes : [pNodes];
  return pArray.map((p: any) => {
    const label = extractLabelText(p);
    const text = extractTextContent(p);
    return {
      label: label || undefined,
      text,
      isSutra: true,
    };
  }).filter((p: TEIParagraph) => p.text.length > 0);
}

// ─── Text Extraction Helpers ─────────────────────────────────────

/**
 * Recursively extract all text content from a node,
 * stripping XML tags but preserving text.
 */
function extractTextContent(node: any): string {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);

  let text = '';

  if (node['#text'] !== undefined) {
    text += String(node['#text']);
  }

  // Recurse into known child elements
  const childElements = ['l', 'seg', 'hi', 'ref', 'persName', 'title', 'label',
    'addName', 'quote', 'note', 'lb', 'emph', 'foreign', 'name', 'term'];

  for (const tag of childElements) {
    if (node[tag] !== undefined) {
      const children = Array.isArray(node[tag]) ? node[tag] : [node[tag]];
      for (const child of children) {
        const childText = extractTextContent(child);
        if (childText) {
          text += ' ' + childText;
        }
      }
    }
  }

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract label text from a <p> element that contains a <label>.
 */
function extractLabelText(pNode: any): string | null {
  if (!pNode.label) return null;

  const labels = Array.isArray(pNode.label) ? pNode.label : [pNode.label];
  const firstLabel = labels[0];
  if (!firstLabel) return null;

  return extractTextContent(firstLabel) || null;
}
