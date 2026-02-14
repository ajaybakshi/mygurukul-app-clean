import React from "react";
import * as path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Circle,
  Path,
  renderToFile,
} from "@react-pdf/renderer";

// ─── Font Registration ──────────────────────────────────────────
// Noto Serif supports IAST diacritics (ā, ī, ṃ, ṇ, ṭ, ṣ, ś, ṛ, etc.)
// The built-in Times-Roman only covers basic ASCII + Western European.

const fontsDir = path.resolve(__dirname, "fonts");

Font.register({
  family: "Noto Serif",
  fonts: [
    { src: path.join(fontsDir, "NotoSerif-Regular.ttf"), fontWeight: "normal", fontStyle: "normal" },
    { src: path.join(fontsDir, "NotoSerif-Italic.ttf"), fontWeight: "normal", fontStyle: "italic" },
    { src: path.join(fontsDir, "NotoSerif-Bold.ttf"), fontWeight: "bold", fontStyle: "normal" },
  ],
});

// Disable hyphenation so Sanskrit words don't get split mid-diacritic
Font.registerHyphenationCallback((word) => [word]);

// ─── Props Interface ─────────────────────────────────────────────

export interface WisdomCardProps {
  sanskritText: string;        // IAST verse text
  sourceReference: string;     // e.g., "Astavakra Gita, Chapter 1, Verses 1-2"
  guruInterpretation: string;  // Full interpretation (split into paragraphs on \n\n)
  reflectionPrompt: string;    // Daily reflection question
  date?: string;               // Optional date label
}

// ─── Design Tokens ───────────────────────────────────────────────

const colors = {
  saffron: "#E8913A",
  saffronLight: "#FFF3E6",
  deepPurple: "#2D1B4E",
  gold: "#C9A84C",
  warmGray: "#F5F0EB",
  cream: "#FFFDF7",
  text: "#3B2E2A",
  textLight: "#7A6B63",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.cream,
    padding: 0,
    paddingBottom: 40,
    fontFamily: "Noto Serif",
  },
  topBar: {
    height: 6,
    backgroundColor: colors.saffron,
  },
  header: {
    backgroundColor: colors.deepPurple,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 26,
    color: colors.gold,
    fontFamily: "Noto Serif",
    letterSpacing: 3,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 9,
    color: "#B8A9D4",
    letterSpacing: 5,
    textTransform: "uppercase",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
    paddingHorizontal: 50,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.4,
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.saffron,
    marginHorizontal: 10,
  },
  verseCard: {
    marginHorizontal: 30,
    marginTop: 4,
    marginBottom: 0,
    padding: 16,
    backgroundColor: colors.warmGray,
    borderRadius: 6,
    borderLeft: `3px solid ${colors.saffron}`,
  },
  verseLabel: {
    fontSize: 8,
    color: colors.saffron,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  verseSanskrit: {
    fontSize: 12,
    fontFamily: "Noto Serif",
    fontStyle: "italic",
    color: colors.deepPurple,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  verseSource: {
    fontSize: 9,
    color: colors.textLight,
    textAlign: "right",
    fontStyle: "italic",
  },
  interpretationSection: {
    paddingHorizontal: 30,
    paddingTop: 12,
    marginBottom: 6,
  },
  interpretationLabel: {
    fontSize: 8,
    color: colors.saffron,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  interpretationText: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: colors.text,
    fontFamily: "Noto Serif",
  },
  reflectionBox: {
    marginHorizontal: 30,
    marginTop: 4,
    padding: 14,
    backgroundColor: colors.saffronLight,
    borderRadius: 6,
  },
  reflectionLabel: {
    fontSize: 8,
    color: colors.saffron,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  reflectionText: {
    fontSize: 9.5,
    fontStyle: "italic",
    color: colors.text,
    lineHeight: 1.5,
    fontFamily: "Noto Serif",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerBar: {
    height: 3,
    backgroundColor: colors.saffron,
    opacity: 0.6,
  },
  footerContent: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: colors.textLight,
    letterSpacing: 1,
  },
  footerUrl: {
    fontSize: 7,
    color: colors.saffron,
  },
});

// ─── Decorative Components ───────────────────────────────────────

const OmSymbol = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Circle cx="50" cy="50" r="48" fill="none" stroke={colors.gold} strokeWidth="1.5" opacity="0.5" />
    <Circle cx="50" cy="50" r="42" fill="none" stroke={colors.gold} strokeWidth="0.5" opacity="0.3" />
    <Path
      d="M35 62c0-8 6-14 14-14s14 6 14 14c0 6-4 11-10 13M49 48c-2-8 2-16 10-18s16 4 16 12c0 10-8 16-16 18M63 42c6-4 8-12 4-18M52 36c0-4 2-8 6-8s6 2 6 4"
      stroke={colors.gold}
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
    <Circle cx="62" cy="26" r="2.5" fill={colors.gold} />
  </Svg>
);

const Divider = () => (
  <View style={styles.dividerRow}>
    <View style={styles.dividerLine} />
    <View style={styles.dividerDot} />
    <OmSymbol size={22} />
    <View style={styles.dividerDot} />
    <View style={styles.dividerLine} />
  </View>
);

// ─── Document Component ──────────────────────────────────────────

export const WisdomDocument = ({
  sanskritText,
  sourceReference,
  guruInterpretation,
  reflectionPrompt,
  date,
}: WisdomCardProps) => {
  // Split interpretation into paragraphs
  const paragraphs = guruInterpretation
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return (
    <Document
      title="MyGurukul - Daily Wisdom"
      author="MyGurukul"
      subject="Sacred Sanskrit Wisdom"
      language="en-US"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />

        <View style={styles.header}>
          <OmSymbol size={36} />
          <Text style={styles.headerTitle}>MyGurukul</Text>
          <Text style={styles.headerSubtitle}>
            {date ? `Sacred Wisdom — ${date}` : "Sacred Wisdom"}
          </Text>
        </View>

        <Divider />

        <View style={styles.verseCard} wrap={false}>
          <Text style={styles.verseLabel}>Sacred Text</Text>
          <Text style={styles.verseSanskrit}>{sanskritText}</Text>
          <Text style={styles.verseSource}>— {sourceReference}</Text>
        </View>

        <View style={styles.interpretationSection}>
          <Text style={styles.interpretationLabel}>{"Guru's Interpretation"}</Text>
          {paragraphs.map((para, i) => (
            <Text
              key={i}
              style={[styles.interpretationText, i > 0 ? { marginTop: 5 } : {}]}
            >
              {para}
            </Text>
          ))}
        </View>

        <View style={styles.reflectionBox} wrap={false}>
          <Text style={styles.reflectionLabel}>Reflection for Today</Text>
          <Text style={styles.reflectionText}>{reflectionPrompt}</Text>
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerBar} />
          <View style={styles.footerContent}>
            <Text style={styles.footerText}>MYGURUKUL — ANCIENT WISDOM FOR MODERN SEEKERS</Text>
            <Text style={styles.footerUrl}>www.mygurukul.org</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// ─── Render Function (for batch script) ──────────────────────────

export async function renderWisdomPdf(
  props: WisdomCardProps,
  outputPath: string
): Promise<void> {
  await renderToFile(<WisdomDocument {...props} />, outputPath);
}

// ─── Standalone Execution (test mode) ────────────────────────────

const isDirectRun = require.main === module ||
  process.argv[1]?.includes('wisdom-card');

if (isDirectRun) {
  (async () => {
    try {
      await renderWisdomPdf(
        {
          sanskritText:
            "yogasthah kuru karmāṇi saṅgaṃ tyaktvā dhanañjaya\n" +
            "siddhy-asiddhyoḥ samo bhūtvā samatvaṃ yoga ucyate",
          sourceReference: "Bhagavad Gītā, Chapter 2, Verse 48",
          guruInterpretation:
            "This profound verse from the Bhagavad Gītā reveals one of the deepest teachings of Yoga — the art of balanced action. Lord Kṛṣṇa instructs Arjuna to perform his duties while established in the state of Yoga, letting go of attachment to outcomes.\n\n" +
            "The beauty of this teaching lies in its practical wisdom: we are not asked to renounce action, but to transform our relationship with it. When we act without clinging to success or recoiling from failure, we discover an inner equanimity that itself is Yoga. This evenness of mind — samatvaṃ — is not indifference, but a profound engagement with life freed from the tyranny of expectation.\n\n" +
            "In our daily lives, this verse invites us to bring our full presence and skill to every task, while gently releasing our grip on how things must turn out. It is in this surrender that we find true freedom and peace.",
          reflectionPrompt:
            '"What is one action I can take today with full presence, releasing my attachment to the outcome? How might my experience change if I focus on the quality of my effort rather than the result?"',
        },
        "./sample-wisdom.pdf"
      );
      console.log("PDF saved to sample-wisdom.pdf");
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  })();
}
