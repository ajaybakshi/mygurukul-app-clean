/**
 * @fileoverview Search Quality Diagnostics
 * 
 * Tests semantic search with known queries and logs detailed results
 * to help debug and improve search quality.
 * 
 * @author MyGurukul AI Assistant
 * @version 1.0.0
 * @since 2025-01-27
 */

/**
 * Interface for search test cases
 */
export interface SearchTestCase {
  query: string;
  expectedTerms: string[]; // What we expect to find
  expectedChapters?: string[]; // Chapters that should match
  shouldNotMatch?: string[]; // Chapters that should NOT match
}

/**
 * Test cases for Ayurvedic semantic search
 */
export const ayurvedaTestCases: SearchTestCase[] = [
// TIER 1: Single Concept Queries (10)
{
query: "turmeric",
expectedTerms: ["turmeric", "haridra", "curcuma longa"],
expectedChapters: ["skin", "inflammation", "wound"],
shouldNotMatch: ["vital breath", "physician"]
},
{
query: "tulsi",
expectedTerms: ["tulsi", "holy basil", "ocimum"],
expectedChapters: ["fever", "respiratory", "immunity"],
shouldNotMatch: ["joint", "arthritis"]
},
{
query: "fever",
expectedTerms: ["fever", "jvara", "pyrexia"],
expectedChapters: ["fever treatment", "temperature"],
shouldNotMatch: []
},
{
query: "vata",
expectedTerms: ["vata", "air", "wind", "dosha"],
expectedChapters: ["vata dosha", "air element"],
shouldNotMatch: ["amavata", "arthritis"] // Should find dosha, NOT disease
},
{
query: "liver",
expectedTerms: ["liver", "yakrit", "hepatic"],
expectedChapters: ["liver health", "yakrit"],
shouldNotMatch: []
},
{
query: "digestion",
expectedTerms: ["digestion", "agni", "digestive fire", "pachana"],
expectedChapters: ["digestion", "agni"],
shouldNotMatch: []
},
{
query: "immunity",
expectedTerms: ["immunity", "immune", "defense", "ojas"],
expectedChapters: ["immunity", "immune support"],
shouldNotMatch: []
},
{
query: "cough",
expectedTerms: ["cough", "kasa", "respiratory"],
expectedChapters: ["cough remedy", "respiratory"],
shouldNotMatch: []
},
{
query: "skin",
expectedTerms: ["skin", "twak", "derma", "complexion"],
expectedChapters: ["skin disease", "dermatology"],
shouldNotMatch: []
},
{
query: "pain",
expectedTerms: ["pain", "shula", "ache"],
expectedChapters: ["pain management"],
shouldNotMatch: []
},

// TIER 2: Two-Word Clinical (10)
{
query: "joint pain",
expectedTerms: ["joint", "pain", "arthritis", "sandhivata"],
expectedChapters: ["arthritis", "joint"],
shouldNotMatch: ["fever", "skin"]
},
{
query: "skin disease",
expectedTerms: ["skin", "disease", "kushtha", "derma"],
expectedChapters: ["skin", "dermatology"],
shouldNotMatch: ["digestion", "liver"]
},
{
query: "liver health",
expectedTerms: ["liver", "health", "yakrit"],
expectedChapters: ["liver"],
shouldNotMatch: []
},
{
query: "digestive fire",
expectedTerms: ["digestive", "fire", "agni"],
expectedChapters: ["digestion", "agni"],
shouldNotMatch: []
},
{
query: "respiratory infection",
expectedTerms: ["respiratory", "infection", "lung", "breathing"],
expectedChapters: ["respiratory", "lung"],
shouldNotMatch: []
},
{
query: "blood purification",
expectedTerms: ["blood", "purification", "rakta", "detox"],
expectedChapters: ["blood", "purification"],
shouldNotMatch: []
},
{
query: "immune support",
expectedTerms: ["immune", "support", "immunity", "ojas"],
expectedChapters: ["immunity"],
shouldNotMatch: []
},
{
query: "stress relief",
expectedTerms: ["stress", "relief", "mental", "anxiety"],
expectedChapters: ["mental health", "stress"],
shouldNotMatch: []
},
{
query: "wound healing",
expectedTerms: ["wound", "healing", "vrana"],
expectedChapters: ["wound", "healing"],
shouldNotMatch: []
},
{
query: "fever treatment",
expectedTerms: ["fever", "treatment", "jvara", "chikitsa"],
expectedChapters: ["fever"],
shouldNotMatch: []
},

// TIER 3: Natural Language Questions (10)
{
query: "What herbs help with fever?",
expectedTerms: ["herbs", "fever", "jvara"],
expectedChapters: ["fever", "herbs"],
shouldNotMatch: []
},
{
query: "How to treat joint pain?",
expectedTerms: ["treat", "joint", "pain", "arthritis"],
expectedChapters: ["joint", "arthritis"],
shouldNotMatch: []
},
{
query: "Best remedy for digestion?",
expectedTerms: ["remedy", "digestion", "agni"],
expectedChapters: ["digestion"],
shouldNotMatch: []
},
{
query: "What is good for skin?",
expectedTerms: ["good", "skin", "complexion"],
expectedChapters: ["skin"],
shouldNotMatch: []
},
{
query: "Which herbs boost immunity?",
expectedTerms: ["herbs", "boost", "immunity"],
expectedChapters: ["immunity", "immune"],
shouldNotMatch: []
},
{
query: "How to reduce inflammation?",
expectedTerms: ["reduce", "inflammation", "anti-inflammatory"],
expectedChapters: ["inflammation"],
shouldNotMatch: []
},
{
query: "What helps with cough?",
expectedTerms: ["helps", "cough", "respiratory"],
expectedChapters: ["cough", "respiratory"],
shouldNotMatch: []
},
{
query: "How to cleanse blood?",
expectedTerms: ["cleanse", "blood", "purification"],
expectedChapters: ["blood"],
shouldNotMatch: []
},
{
query: "What treats respiratory issues?",
expectedTerms: ["treats", "respiratory", "issues"],
expectedChapters: ["respiratory"],
shouldNotMatch: []
},
{
query: "How to heal wounds?",
expectedTerms: ["heal", "wounds", "vrana"],
expectedChapters: ["wound", "healing"],
shouldNotMatch: []
}
];

/**
 * Test query expansion with detailed logging
 * 
 * @param query - The query to test
 * @returns The expansion result
 */
export function testQueryExpansion(query: string) {
  const { expandQuery } = require('./queryExpansion');
  
  console.log(`\n🔍 TESTING QUERY: "${query}"`);
  console.log('─'.repeat(60));
  
  const expansion = expandQuery(query);
  
  console.log('📊 Expansion Results:');
  console.log(` - Expanded Terms (${expansion.expandedTerms?.length || 0}):`, expansion.expandedTerms);
  console.log(` - Related Concepts (${expansion.relatedConcepts?.length || 0}):`, expansion.relatedConcepts);
  console.log(` - Matched Categories (${expansion.matchedCategories?.length || 0}):`, expansion.matchedCategories);
  console.log(` - Dosha Associations (${expansion.doshaAssociations?.length || 0}):`, expansion.doshaAssociations);
  
  return expansion;
}

/**
 * Run all test cases and validate results
 */
export function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 SEMANTIC SEARCH QUALITY TEST SUITE');
  console.log('='.repeat(60));
  
  ayurvedaTestCases.forEach((testCase, index) => {
    console.log(`\n📋 Test ${index + 1}/${ayurvedaTestCases.length}: "${testCase.query}"`);
    console.log('─'.repeat(40));
    
    const expansion = testQueryExpansion(testCase.query);
    
    // Validate expansion
    const foundExpectedTerms = testCase.expectedTerms.filter(term =>
      expansion.expandedTerms?.some((et: string) => et.toLowerCase().includes(term.toLowerCase()))
    );
    
    console.log(`\n✅ Found Expected Terms (${foundExpectedTerms.length}/${testCase.expectedTerms.length}):`, foundExpectedTerms);
    
    const missingTerms = testCase.expectedTerms.filter(term =>
      !expansion.expandedTerms?.some((et: string) => et.toLowerCase().includes(term.toLowerCase()))
    );
    
    if (missingTerms.length > 0) {
      console.log(`❌ Missing Expected Terms (${missingTerms.length}):`, missingTerms);
    }
    
    // Check related concepts
    if (expansion.relatedConcepts && expansion.relatedConcepts.length > 0) {
      console.log(`\n🔗 Related Concepts Found:`, expansion.relatedConcepts.slice(0, 5));
    }
    
    // Check categories
    if (expansion.matchedCategories && expansion.matchedCategories.length > 0) {
      console.log(`\n📂 Matched Categories:`, expansion.matchedCategories);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ TEST SUITE COMPLETE');
  console.log('='.repeat(60) + '\n');
}

/**
 * Quick test function for development
 */
export function quickTest() {
  console.log('🚀 Running Quick Semantic Search Test...\n');
  
  const testQueries = ['haldi', 'tulsi', 'fever', 'vata'];
  
  testQueries.forEach(query => {
    testQueryExpansion(query);
  });
  
  console.log('\n✅ Quick test complete!');
}
