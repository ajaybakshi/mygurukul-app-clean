/**
 * File Search Chat History Service
 * Converts TabContext messages to Gemini API chat history format
 */

interface ConversationMessage {
  sender: 'user' | 'ai';
  text: string;
}

interface GeminiHistoryEntry {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * Build Gemini-compatible chat history from conversation messages
 * @param messages - Array of conversation messages from TabContext
 * @param maxMessages - Maximum number of recent messages to include (default: 4 for 2 Q&A pairs)
 * @returns Array of Gemini history entries
 */
export function buildChatHistory(
  messages?: ConversationMessage[],
  maxMessages: number = 4
): GeminiHistoryEntry[] {
  if (!messages || messages.length === 0) {
    return [];
  }
  
  // Take last N messages for context (avoid token bloat)
  const recentMessages = messages.slice(-maxMessages);
  
  // Convert to Gemini format
  return recentMessages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));
}

/**
 * Format conversation history for logging/debugging
 * @param history - Gemini history entries
 * @returns Formatted string for console logging
 */
export function formatHistoryForLogging(history: GeminiHistoryEntry[]): string {
  if (history.length === 0) return 'No history';
  
  return history.map((entry, idx) => 
    `${idx + 1}. ${entry.role}: ${entry.parts[0].text.substring(0, 50)}...`
  ).join('\n');
}



