/**
 * Database Schema Types
 *
 * TypeScript interfaces matching the PostgreSQL schema.
 */

// ============================================================================
// Daily Wisdom Types
// ============================================================================

export interface DailyWisdom {
  id: number;
  wisdom_date: Date;
  raw_text: string;
  interpretation: string;
  source_name: string;
  chapter: string | null;
  section: string | null;
  text_type: string | null;
  metadata: WisdomMetadata | null;
  created_at: Date;
}

export interface WisdomMetadata {
  verse_number?: string;
  speaker?: string;
  language?: string;
  transliteration?: string;
  audio_url?: string;
  [key: string]: unknown;
}

export interface CreateWisdomInput {
  wisdom_date: Date;
  raw_text: string;
  interpretation: string;
  source_name: string;
  chapter?: string;
  section?: string;
  text_type?: string;
  metadata?: WisdomMetadata;
}

// ============================================================================
// Conversation Types
// ============================================================================

export interface Conversation {
  id: number;
  session_id: string;
  question: string;
  response_narrative: string | null;
  citations: Citation[] | null;
  provider: string | null;
  response_time_ms: number | null;
  grounded: boolean;
  created_at: Date;
}

export interface Citation {
  source: string;
  text: string;
  chapter?: string;
  verse?: string;
  relevance_score?: number;
  [key: string]: unknown;
}

export interface CreateConversationInput {
  session_id: string;
  question: string;
  response_narrative?: string;
  citations?: Citation[];
  provider?: string;
  response_time_ms?: number;
  grounded?: boolean;
}

// ============================================================================
// API Metrics Types
// ============================================================================

export interface ApiMetric {
  id: number;
  endpoint: string;
  session_id: string | null;
  latency_ms: number;
  status_code: number;
  success: boolean;
  error_message: string | null;
  request_metadata: RequestMetadata | null;
  created_at: Date;
}

export interface RequestMetadata {
  method?: string;
  user_agent?: string;
  query_length?: number;
  provider_used?: string;
  cache_hit?: boolean;
  [key: string]: unknown;
}

export interface CreateMetricInput {
  endpoint: string;
  session_id?: string;
  latency_ms: number;
  status_code: number;
  success: boolean;
  error_message?: string;
  request_metadata?: RequestMetadata;
}

// ============================================================================
// Admin Dashboard Types
// ============================================================================

export interface WisdomStats {
  total_entries: number;
  unique_text_types: number;
  earliest_date: Date | null;
  latest_date: Date | null;
}

export interface ConversationStats {
  provider: string;
  total_conversations: number;
  avg_response_time_ms: number;
  grounded_count: number;
  date: Date;
}

export interface ApiHealthStats {
  endpoint: string;
  total_requests: number;
  successful_requests: number;
  success_rate: number;
  avg_latency_ms: number;
  max_latency_ms: number;
  min_latency_ms: number;
}

// ============================================================================
// Query Options
// ============================================================================

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface DateRangeOptions {
  start_date?: Date;
  end_date?: Date;
}

export interface ConversationQueryOptions extends PaginationOptions, DateRangeOptions {
  session_id?: string;
  provider?: string;
}

export interface MetricsQueryOptions extends PaginationOptions, DateRangeOptions {
  endpoint?: string;
  success?: boolean;
}
