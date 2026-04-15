# MyGurukul — Status & Continuity Notes

## Last Updated: 2026-04-15 — halfvec migration + dump/restore reclaim

---

## Neon Database Optimization Round 2 (2026-04-15)

### Problem
Console showed 75% of 512 MB free-tier cap (384 MB). Growing toward the ceiling with no budget for a paid plan.

### Root Cause
`scripture_chunks.embedding` was `vector(1024)` (float32) — 142 MB of raw embedding data out of the 312 MB table. pgvector 0.8 supports `halfvec(1024)` (float16) which halves the storage with negligible recall loss.

### Actions Taken
1. **Added `embedding_half halfvec(1024)` column**, populated in 8 batches of 5,000 rows with VACUUM between (peak DB size stayed under 474 MB — Neon rejected a single-shot `ALTER TYPE` because it temporarily needed >512 MB).
2. **Atomic swap** — `DROP COLUMN embedding; RENAME embedding_half TO embedding;` in one transaction.
3. **Rewrote all 36,406 rows in 8 batches** via `UPDATE ... SET verse_refs = verse_refs` to orphan the dropped-column TOAST chunks, VACUUM between.
4. **Dump-out → DROP TABLE → pg_restore** to actually shrink the on-disk file (regular VACUUM marks pages reusable but doesn't truncate; VACUUM FULL won't fit under 512 MB cap because it needs 2× space). Dump externalized 202 MB to `/tmp`, drop freed 424 MB, restore brought table back at 235 MB. **87 seconds downtime.**
5. **App code updated** — `src/lib/db/scriptureRepository.ts:61,66` now casts query embedding as `$1::halfvec(1024)` instead of `$1::vector`. Committed `cdf5c6b`, pushed to `origin/main`, Vercel auto-deployed.

### Result
- **Database: 384 MB → 285 MB** (99 MB saved, 26% reduction)
- **Neon capacity: 75% → 56%** of the 512 MB free-tier cap
- **Headroom: 128 MB → 227 MB**
- **Retrieval recall: 10/10 top-k identical** between `vector` and `halfvec` on sample query — halfvec is effectively lossless for this corpus at 1024 dims.

### Verification
- Schema: `embedding halfvec(1024)`, all constraints/indexes/FK restored
- Hybrid search: all 3 paths (semantic `<=>`, tsvector `@@`, key_terms `&&`) tested working
- Row count: 36,406 (unchanged)
- Vercel build: successful post-deploy

### Notes on Dashboard Lag
Neon dashboard may continue to show ~0.4 GB / 80% monthly-allowance for several hours after this migration:
- **"Storage" bar** includes the 6-hour WAL/history retention window; all migration WAL rolls off ~6h after the restore completed (~9 PM IST on 2026-04-15).
- **"Monthly allowance %"** is a GB-hours accrual that pulls down over ~5-7 days as the new lower size re-averages.
- This is expected and self-corrects. Ground truth: `pg_database_size()` = 285 MB, `logical_size` via Neon API = 307 MB.

### Growth Budget
- Current: 285 MB live / 512 MB cap = 44% headroom
- At current growth rate (negligible — only 61 conversations ever), years of runway
- If headroom ever threatens again, next lever is reducing Voyage embedding dimensions 1024 → 512 (~70 MB more saved, requires re-embed)

---

## Neon Database Optimization (2026-04-07)

### Problem
Neon free tier (512 MB) hit 89% capacity (~455 MB).

### Root Cause
`scripture_chunks` table (36,346 rows with 1024-dim Voyage embeddings) consumed 408 MB alone (91% of DB). No bloat — data is genuinely dense. Conversations, api_metrics, and daily_wisdom tables are negligible (<1 MB combined).

### Actions Taken
1. **Dropped unused tables:** `playing_with_neon` (test data), `verse_index` (empty, 0 rows)
2. **Ran REINDEX + VACUUM FULL** on `scripture_chunks` and `amarakosha` — confirmed no bloat existed
3. **Dropped GIN tsvector index** `idx_chunks_search` (was 87 MB) — this was the full-text search index on `search_text` column

### Result
- DB reduced from **89% → 71%** capacity (455 MB → 362 MB)
- `scripture_chunks` went from 408 MB → 312 MB

### Impact & Trade-offs
- The **keyword search CTE** in `src/lib/db/scriptureRepository.ts` (`hybridSearch()`) now does a sequential scan instead of index lookup on the `search_text` column
- Hybrid search still works with all 3 signals (semantic + keyword + Amarakosha term matching), just keyword leg is slower
- With only 36K rows, performance impact should be minimal
- The `search_text` tsvector **data column is still intact** — only the index was removed

### How to Restore (if upgrading Neon plan later)
```sql
CREATE INDEX idx_chunks_search ON scripture_chunks USING GIN(search_text);
```

### If Search Latency Becomes an Issue
- Option 1: Remove the keyword CTE from `hybridSearch()` in `src/lib/db/scriptureRepository.ts` (lines ~69-79), keeping semantic + Amarakosha only
- Option 2: Recreate the GIN index (requires ~87 MB free space)

### DB Size Reference (2026-04-07)
| Table | Size | Rows |
|---|---|---|
| scripture_chunks | 312 MB | 36,346 |
| amarakosha | 41 MB | 11,497 |
| conversations | 696 KB | 61 |
| daily_wisdom | 184 KB | 15 |
| scripture_texts | 128 KB | 33 |
| api_metrics | 112 KB | 131 |

### Embedding Config
- Model: Voyage AI
- Dimensions: 1024
- ~4 KB per vector row

---

## Future Capacity Considerations
- At current usage (61 conversations total), growth is negligible — months/years of headroom at 71%
- If capacity becomes an issue again, next option is reducing embedding dimensions (1024 → 512) which would save ~70 MB but requires re-embedding all 36K chunks
- Neon Launch plan ($19/mo) gives 10 GB — 28x current usage
