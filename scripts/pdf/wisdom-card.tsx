import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Circle,
  Path,
  renderToFile,
} from "@react-pdf/renderer";

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
  },
  // Top decorative bar
  topBar: {
    height: 8,
    backgroundColor: colors.saffron,
  },
  // Header section
  header: {
    backgroundColor: colors.deepPurple,
    padding: 30,
    paddingBottom: 22,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 32,
    color: colors.gold,
    fontFamily: "Times-Roman",
    letterSpacing: 3,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#B8A9D4",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  // Divider ornament
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    paddingHorizontal: 50,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.4,
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.saffron,
    marginHorizontal: 12,
  },
  // Sanskrit verse card
  verseCard: {
    margin: 40,
    marginTop: 10,
    padding: 24,
    backgroundColor: colors.warmGray,
    borderRadius: 8,
    borderLeft: `4px solid ${colors.saffron}`,
  },
  verseLabel: {
    fontSize: 9,
    color: colors.saffron,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  verseSanskrit: {
    fontSize: 15,
    fontFamily: "Times-Roman",
    fontStyle: "italic",
    color: colors.deepPurple,
    lineHeight: 1.7,
    marginBottom: 12,
  },
  verseSource: {
    fontSize: 10,
    color: colors.textLight,
    textAlign: "right",
    fontStyle: "italic",
  },
  // Interpretation section
  interpretationSection: {
    paddingHorizontal: 40,
    marginBottom: 12,
  },
  interpretationLabel: {
    fontSize: 9,
    color: colors.saffron,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  interpretationText: {
    fontSize: 11,
    lineHeight: 1.65,
    color: colors.text,
    fontFamily: "Times-Roman",
  },
  // Reflection box
  reflectionBox: {
    marginHorizontal: 40,
    marginTop: 6,
    padding: 20,
    backgroundColor: colors.saffronLight,
    borderRadius: 8,
  },
  reflectionLabel: {
    fontSize: 9,
    color: colors.saffron,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  reflectionText: {
    fontSize: 11,
    fontStyle: "italic",
    color: colors.text,
    lineHeight: 1.6,
    fontFamily: "Times-Roman",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerBar: {
    height: 4,
    backgroundColor: colors.saffron,
    opacity: 0.6,
  },
  footerContent: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: colors.textLight,
    letterSpacing: 1,
  },
  footerUrl: {
    fontSize: 8,
    color: colors.saffron,
  },
});

// Simple Om symbol using SVG
const OmSymbol = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Circle cx="50" cy="50" r="48" fill="none" stroke={colors.gold} strokeWidth="1.5" opacity="0.5" />
    <Circle cx="50" cy="50" r="42" fill="none" stroke={colors.gold} strokeWidth="0.5" opacity="0.3" />
    {/* Stylized Om path */}
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
    <OmSymbol size={30} />
    <View style={styles.dividerDot} />
    <View style={styles.dividerLine} />
  </View>
);

const WisdomDocument = () => (
  <Document
    title="MyGurukul - Daily Wisdom"
    author="MyGurukul"
    subject="Sacred Sanskrit Wisdom"
    language="en-US"
  >
    <Page size="A4" style={styles.page}>
      {/* Top accent bar */}
      <View style={styles.topBar} />

      {/* Header */}
      <View style={styles.header}>
        <OmSymbol size={50} />
        <Text style={styles.headerTitle}>MyGurukul</Text>
        <Text style={styles.headerSubtitle}>Sacred Wisdom</Text>
      </View>

      {/* Ornamental divider */}
      <Divider />

      {/* Sanskrit Verse */}
      <View style={styles.verseCard} wrap={false}>
        <Text style={styles.verseLabel}>Sacred Text</Text>
        <Text style={styles.verseSanskrit}>
          yogasthah kuru karmani sangam tyaktva dhananjaya{"\n"}
          siddhy-asiddhyoh samo bhutva samatvam yoga ucyate
        </Text>
        <Text style={styles.verseSource}>
          — Bhagavad Gita, Chapter 2, Verse 48
        </Text>
      </View>

      {/* Interpretation */}
      <View style={styles.interpretationSection}>
        <Text style={styles.interpretationLabel}>Guru's Interpretation</Text>
        <Text style={styles.interpretationText}>
          This profound verse from the Bhagavad Gita reveals one of the deepest teachings of Yoga — the art of balanced action. Lord Krishna instructs Arjuna to perform his duties while established in the state of Yoga, letting go of attachment to outcomes.
        </Text>
        <Text style={[styles.interpretationText, { marginTop: 8 }]}>
          The beauty of this teaching lies in its practical wisdom: we are not asked to renounce action, but to transform our relationship with it. When we act without clinging to success or recoiling from failure, we discover an inner equanimity that itself is Yoga. This evenness of mind — samatvam — is not indifference, but a profound engagement with life freed from the tyranny of expectation.
        </Text>
        <Text style={[styles.interpretationText, { marginTop: 8 }]}>
          In our daily lives, this verse invites us to bring our full presence and skill to every task, while gently releasing our grip on how things must turn out. It is in this surrender that we find true freedom and peace.
        </Text>
      </View>

      {/* Reflection */}
      <View style={styles.reflectionBox} wrap={false}>
        <Text style={styles.reflectionLabel}>Reflection for Today</Text>
        <Text style={styles.reflectionText}>
          "What is one action I can take today with full presence, releasing my attachment to the outcome? How might my experience change if I focus on the quality of my effort rather than the result?"
        </Text>
      </View>

      {/* Footer */}
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

(async () => {
  try {
    await renderToFile(<WisdomDocument />, "./sample-wisdom.pdf");
    console.log("PDF saved to sample-wisdom.pdf");
  } catch (err) {
    console.error("PDF generation failed:", err);
  }
})();
