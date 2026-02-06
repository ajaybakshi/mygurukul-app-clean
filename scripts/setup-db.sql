-- MyGurukul Database Schema
-- Run this in Vercel Postgres console or via psql

-- Table 1: Daily Wisdom (for caching and analytics)
CREATE TABLE IF NOT EXISTS daily_wisdom (
    id SERIAL PRIMARY KEY,
    wisdom_date DATE NOT NULL UNIQUE,
    raw_text TEXT NOT NULL,
    interpretation TEXT NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    chapter VARCHAR(255),
    section VARCHAR(255),
    text_type VARCHAR(50),  -- 'Epic', 'Philosophical', etc.
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_daily_wisdom_date ON daily_wisdom(wisdom_date);

-- Table 2: Conversations (Q&A tracking)
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    response_narrative TEXT,
    citations JSONB,
    provider VARCHAR(50),  -- 'file-search', 'discovery-engine', 'multi-agent'
    response_time_ms INTEGER,
    grounded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_provider ON conversations(provider);

-- Table 3: API Metrics (performance monitoring)
CREATE TABLE IF NOT EXISTS api_metrics (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    latency_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    request_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for metrics analysis
CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_metrics_created ON api_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_api_metrics_success ON api_metrics(success);

-- Useful views for admin dashboard

-- Daily wisdom stats
CREATE OR REPLACE VIEW wisdom_stats AS
SELECT
    COUNT(*) as total_entries,
    COUNT(DISTINCT text_type) as unique_text_types,
    MIN(wisdom_date) as earliest_date,
    MAX(wisdom_date) as latest_date
FROM daily_wisdom;

-- Conversation stats by provider
CREATE OR REPLACE VIEW conversation_stats AS
SELECT
    provider,
    COUNT(*) as total_conversations,
    AVG(response_time_ms) as avg_response_time_ms,
    COUNT(CASE WHEN grounded THEN 1 END) as grounded_count,
    DATE(created_at) as date
FROM conversations
GROUP BY provider, DATE(created_at)
ORDER BY date DESC;

-- API health metrics (last 24 hours)
CREATE OR REPLACE VIEW api_health AS
SELECT
    endpoint,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN success THEN 1 END) as successful_requests,
    ROUND(100.0 * COUNT(CASE WHEN success THEN 1 END) / COUNT(*), 2) as success_rate,
    AVG(latency_ms) as avg_latency_ms,
    MAX(latency_ms) as max_latency_ms,
    MIN(latency_ms) as min_latency_ms
FROM api_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY total_requests DESC;
