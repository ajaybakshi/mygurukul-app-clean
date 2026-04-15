# Session Handoff

**Date:** 2026-04-15

## Branch

`main` @ `cdf5c6b` — pushed to `origin/main`, deployed on Vercel.

## What Was Done This Session

Reclaimed 99 MB from the Neon free-tier database (`neon-pink-ocean`, project `withered-silence-08864899`). Full details in `STATUS.md`.

### Summary

| Before | After |
|---|---|
| 384 MB / 512 MB (75%) | 285 MB / 512 MB (56%) |

### Changes

- **Schema change on Neon `main` branch**: `scripture_chunks.embedding` migrated from `vector(1024)` → `halfvec(1024)`.
- **Code change in this repo**: `src/lib/db/scriptureRepository.ts` — two lines in `hybridSearch()`, query embedding now cast as `$1::halfvec(1024)`. Commit `cdf5c6b`.
- **Schema rebuild via dump-out/drop/restore** to actually shrink on-disk file (VACUUM FULL couldn't fit under free-tier cap).
- Safety branch `pre-halfvec-backup-2026-04-15` was created during migration and deleted afterward.

### Verification

- Top-10 semantic retrieval IDs identical pre/post migration (lossless recall for 1024-dim embeddings at halfvec precision on this corpus).
- All three hybrid-search paths (semantic, tsvector, key_terms) tested end-to-end.
- Row count unchanged: 36,406.
- Vercel build successful.

## Uncommitted Work

Repo has substantial pre-existing uncommitted state **not touched this session**:
- ~45 modified scripts under `scripts/` and root (Python metadata/chapter generators)
- Modified docs (`BACKEND_DATA_PREPARATION_README.md`, `SDK_FIX_COMPLETE.md`, `debug-log.md`)
- Deleted `__pycache__` entries (legitimate cleanup)
- Untracked: `STATUS.md` (updated this session — staged for wrap-up commit), `Issues Feb 28 2026.txt`, `ICLOUD_LEFTOVERS.md`, `Sanskrit_Mathematical_Texts_Sources.md`, `aryabhatiya-progress.json`, `caraka_daily_readings_backup/`, `fonts_local/`, `gen_*_mar15.py`, `math/`

**None of this was authored in this session.** Ajay should review and decide what to commit or discard separately.

## Failed Approaches

- **Single-shot `ALTER TABLE ... TYPE halfvec(1024)`** — fails because rewrite temporarily doubles table size, pushing past 512 MB cap. Mitigated by adding a second column and batching.
- **`VACUUM FULL scripture_chunks`** after swap — also blocked by 512 MB cap (needs 2× table size). Mitigated by dump-out → drop → pg_restore, which externalizes data during the 2× window.
- **Regular VACUUM after DROP COLUMN** doesn't reclaim the dropped column's TOAST chunks — Postgres keeps them referenced by existing tuples until rows are rewritten. Mitigated by a batched no-op UPDATE to break the references.

## How to Resume

If returning to Mygurukul next session:

1. `git pull origin main` — should be up to date (`cdf5c6b` HEAD).
2. Verify Vercel deployment is green: https://vercel.com/ajaybakshis-projects → mygurukul project.
3. Smoke-test search on the live site — query something and confirm results come back.
4. **Dashboard may still show ~0.4 GB / 80% for up to 24h** — this is WAL retention + GB-hours accrual, not live storage. Live size is 285 MB.

If there's search latency or errors:
- Connection string: via `neonctl connection-string --project-id withered-silence-08864899 --org-id org-autumn-shadow-84750786`
- Run `EXPLAIN ANALYZE` on a `hybridSearch` query — the semantic path is now a sequential scan on halfvec (same as before migration; no vector index was ever present).

## Still Outstanding

Nothing from this session's scope — migration is complete. Optional future levers if space ever tightens again:

- Reduce Voyage embedding dims 1024 → 512 (~70 MB additional savings, requires re-embed).
- Lower Neon history retention from 6h → 1h (Settings tab) to reduce the WAL component of dashboard storage.
- Upgrade to Neon Launch ($19/mo, 10 GB) when usage justifies it.

## Build Status

- Vercel: successful deploy of `cdf5c6b` (user confirmed).
- Local tests: not run this session. No tests were added or modified.
