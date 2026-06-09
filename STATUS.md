# MyGurukul — Status & Continuity Notes

## Last Updated: 2026-06-09 — Social card fix: Om glyph now renders in OG/Twitter images (was 0-byte broken card); committed + pushed (mygurukul 5095032), verified live

---

## MyGurukul — Social card (OG/Twitter) fix (2026-06-09)

### Context
X/Twitter card showed a broken-image placeholder. The `og:image`/`twitter:image` endpoints returned **HTTP 200 with content-length 0** — a 0-byte PNG that Vercel had cached for a year (`max-age=31536000`).

### Root cause
`src/app/opengraph-image.tsx` + `twitter-image.tsx` render the Devanagari **ॐ** (U+0950). `next/og`'s default font has no Devanagari coverage, so Satori threw mid-render and emitted an empty body. The Latin text alone would have rendered — only the single `ॐ` glyph killed it.

### Shipped (mygurukul-final main, pushed `5095032`)
- Bundled a Devanagari font co-located with the routes (`src/app/NotoSansDevanagari.ttf`), loaded via `import.meta.url` so Next traces it into the edge bundle.
- **Key gotcha:** Google's Noto Sans Devanagari is now a *variable* font, and `@vercel/og` can't parse a variable font's `fvar` table (`Cannot read properties of undefined (reading '256')`). Instantiated a **static** Regular weight with `fonttools` (647KB variable → 223KB static).
- Wrapped font load in try/catch + conditional Om render, so any future font failure degrades to a card-without-Om instead of another 0-byte image.

### Verified live
`og:image` content hash changed (`a88947…` → `7cd9e00e…`, bypassing the stale Vercel cache). OG endpoint = 119,531 B / 1200×630, Twitter = 95,424 B / 1200×600, both valid PNGs with the gold Om rendering. `npm run build` exit 0; both routes build as edge functions.

### Note
Existing tweets may keep showing the old broken card until X re-scrapes (X's own cache, independent of ours). Any **new** share fetches the fresh image (changed hash forces it).

---

## PramaKosha — Gītā realigned to proper order + Chapter 1 processed (2026-06-08, session 5)

### Context
Caught pipeline drift: the Gītā Stage 6.5 merge (v3) from session 4's tail had run *ahead* of its prerequisites (deterministic emit + Stage 4.5 extraction), so it was snippet-only. Per Ajay's directive — **run the full pipeline in proper order; no jumping stages unless explicitly asked** — backed it out and re-ran the Gītā in order. All work in the **pramakosha repo**, pushed through `d93b5f2`.

### Shipped (pramakosha main, pushed)
- **Backed out** the out-of-order v3 (oṃkāra/ātman/vaiśvānara restored to v2 from `b10787b`).
- **`boundaries` segmenter capability** (general): block-start delimiters that close a unit without becoming a locus (commentary author headwords). Not Gītā-specific.
- **`gretil-gita` adapter** (mūla-only): BhG c.v leading marker + Śrīdhara/Viśvanātha/Baladeva boundaries.
- **Step 1 — deterministic ingest** → `record.json` (637 mūla units, locus-resolve 1.0, **droppedUnits 0**). Required a general `countBodyMarkers` fix: leading markers counted only block-anchored (so commentary cross-refs/endnotes don't inflate the count). Māṇḍūkya/Āryabhaṭīya unchanged.
- **Step 3 — Stage 4.5 miner** (`gita-mine`, cumulative `index.json`): Chapter 1 = 32 units, **197 concepts**, grounded mūla-only.
- **Step 4 — Stage 8c drafter** (`gita-draft`): **12 v1 Gītā nodes** (dharmic-crisis cluster + sukha). Selector = archetype∈{concept,normative-rule} ∧ loci≥2, with phrase + epithet guards (pruned 4 non-concepts the heuristic admitted). Store 19 → 31 nodes.
- **Triage interface** (`triage.ts`) + **`rejectSense`**: review/promote/reject proposed senses + self-contained `triage.html`; surfaced a **34-item** backlog.
- **`hub:sync`** (`sync-hub.ts`): all 31 nodes now listed on `index.html` (surgical insert, GOLD cards untouched). Resolves the manual-hub drift.
- Tests **21/21**, typecheck clean.

### Architecture / process note
Per-chapter Gītā cycle = **mine → draft new nodes → Stage 6.5 merge shared concepts**. Chapter 1's concepts are all *new*, so the merge was correctly a no-op; real cross-text accretion (oṃkāra/ātman/vaiśvānara growing with Gītā evidence) only fires at **Ch 2** (ātman/brahman), **7–8** (oṃkāra/praṇava), **15** (vaiśvānara).

### Next up
**Chapter 2 full cycle** — mine (~72 units) → draft new v1 nodes → run the now gloss-grounded Stage 6.5 merge (the first real cross-text accretion). Then iterate further chapters; eventually work the 34-item triage backlog.

### Known / flags
- 34 proposed senses await human triage (`npm run triage`).
- Stray untracked `STATUS.md`/`SESSION_HANDOFF.md` copies sit in the pramakosha repo (canonical ones live here in mygurukul-final) — almost got committed once; worth `rm`-ing.

---

## PramaKosha — Concept Layer: Extraction + Concept-Node Store + Stage 6.5 + Hub UI (2026-06-08, session 4)

### Context
Second code session. Built the encyclopedia layer on top of the deterministic spine: concept extraction, durable concept nodes, and the cross-text merge that answers "how does the oṃkāra entry stay coherent as new texts arrive." All in the **pramakosha repo** (`/Users/AJ/Developer/ML_Workspace/pramakosha/`), committed to `main` as `07ab7c2` — **not pushed** (user said commit, not push).

### Shipped (committed `07ab7c2`, pramakosha repo)
- **Hub UI** (`index.html`) — self-contained, manifest-driven; entry cards (5 GOLD + 6 concept nodes); GOLD-vs-Generated provenance filter; `browse concept nodes →` + `concepts.html` in docs. Opens offline (manifest inlined, not fetched, deliberately).
- **Concept pipeline** (Māṇḍūkya, supplied witnesses only — no parametric memory): **Stage 4.5** extraction (`stages/llm_concepts.ts`, per verse: mantra + deterministically-aligned Śaṅkara bhāṣya as the only evidence) → **118 concepts / 12 verses**; **Stage 8c** entry draft (`stages/llm_concept_entry.ts`). Runner `mandukya-concepts.ts` (`npm run mandukya`), report `pramakosha-mandukya-concepts.html`. Zero hallucinated loci; 4 genuine contested cruxes detected; the drafter refused to count Śaṅkara's embedded quotations as independent attestations.
- **Durable concept-node store + Stage 6.5** (the cross-text answer): `concept-store.ts` — URN-addressed nodes (`urn:pramakosha:concept:<slug>`); append-only attestations (dedup by locus); senses as the reading surface (settled vs proposed); pure `applyMerge`/`promoteSense` (no LLM, 5 unit tests). **Stage 6.5** (`stages/llm_merge.ts`) routes new attestations to existing senses or proposes new ones over the **delta only**, never rewriting settled prose. Demo `concepts-ingest.ts` (`npm run concepts`) treats Māṇḍūkya's 3 witnesses as 2 ingestions: mūla+kārikā → v1, Śaṅkara bhāṣya → v2 merge. Result: every concept **routed the bulk to existing senses** (oṃkāra 11, taijasa 12…) and **proposed a few genuinely new** (oṃkāra 3, turīya 3, ātman 2…). Pages: `concept-<slug>.html` + `concepts.html` (`render-concept.ts`). 6 nodes: oṃkāra, ātman, turīya, vaiśvānara, taijasa, prājña.
- Design mockup `pramakosha-concept-omkara.html` (multi-witness target structure, Gītā rows illustrative).
- Tests **16/16** (11 spine + 5 store/merge); typecheck clean.

### Architecture decided this session
Concept is a **durable node that owns attestations across ingestions**; the page is a **projection**, never append-prose. Three layers: attestations (append-only) → senses/synset (slow-growing reading surface) → composed entry (per-sense prose cached, only new/changed re-written). Per-text reports demote to **provenance**; hub cards point at the concept node, not a run report. New cross-text senses arrive `proposed`, promote on human triage.

### Next up
Ingest **Bhagavad Gītā** (user downloading GRETIL now) — the real cross-text test of Stage 6.5; needs a Gītā adapter. Then: triage UI for proposed senses (`promoteSense` has no interface yet); scale extraction past 6 nodes; fix merge over-recall (see Blockers); push pramakosha repo; eventual Postgres index tier.

### Known limitation
Deterministic attestation gather (term-stem substring) **over-recalls** → a few Stage 6.5 proposals are off-concept (e.g. oṃkāra picked up ajātivāda/ātman loci that don't mention oṃkāra). The merge agent flags these honestly in its `rationale`, so human triage catches them — but the real fix is a "reject / not-this-concept" branch in the merge schema, or embedding-gated gather.

### Decisions still open
- Push the `pramakosha` repo (committed locally, not pushed)?
- Create a GitHub remote for `pramakosha-sources` (still local-only)?

---

## PramaKosha — Pipeline Built + Āryabhaṭīya Domain Pack + GOLD #5 (2026-06-08, session 3)

### Context
First **code** session (prior sessions were design-only). Built the general ingestion pipeline as a standalone TypeScript package and proved it on two texts. Decisions taken this session: runtime = **TypeScript** (`pramakosha/ingest/`); goal reframed by Ajay — build a **general** pipeline, GOLD entries are **calibration references, not targets** (don't overfit); domain pack = full pack **incl. LLM stages**; LLM provider = **Claude** (`claude-opus-4-8`); sources versioned in a **separate repo**.

### Shipped (all committed & pushed to ajaybakshi/pramakosha)
- **`b509fcf` — Māṇḍūkya general pipeline.** Deterministic spine (Stages 0–3 + consolidate + Stage-10 gates), zero LLM. 3 GRETIL TEI-XML → 438 loci (mūla 12 · kārikā 215 · bhāṣya 211), locus-resolve 0.986, 0 dropped, idempotent, 7/7 tests. Adapter model = "add an adapter, not stage code". Calibration: independently marked MU 2/7 core, GK 3.48 provisional (recurs 4.71) — matching the hand-authored Turīya entry it had no knowledge of. Briefs: `pramakosha-pilot-architecture.html`, `pramakosha-pilot-results.html`.
- **`0893be0` — Āryabhaṭīya domain pack + first LLM stages → GOLD #5.** Deterministic: 2nd adapter (attribute `xml:id` markers — the one named segmenter generalization), numeral parser (varga/avarga decode; khyughṛ=4,320,000, makhi=225, 97/97 Gītikā numerals confident), verify-tool (caught bhaki=124 source anomaly). 121 verses, 0 dropped, 11/11 tests (Māṇḍūkya's 7 still green). Agentic (Claude): thin client (forced-tool structured output, hard call cap, logging, prompt cache, key from gitignored `.env.local`), Stage 5 lexicography + Stage 8 draft (both with abstain branch). GOLD #5 = Āryabhaṭa numeral-system procedure entry, 2 Claude calls: abstained on `sthāna`, marked `bhaki` unverified per verify-tool (not fixed), every step cited. Briefs: `pramakosha-aryabhatiya-domain-pack.html`, `pramakosha-entry-aryabhata-numerals.html` (GOLD #5).
- **`pramakosha-sources` repo** (new, local-only — NO remote yet): Māṇḍūkya + Āryabhaṭīya GRETIL TEI-XML with `PROVENANCE.md` (sha256, license, legacy paths). Generated records gitignored.

### Thesis proven on depth (Māṇḍūkya) + breadth (Āryabhaṭīya)
General pipeline + declarable domain packs; claims checkable by tools; agents abstain; GOLD-quality output from grounded processing — not overfitting.

### Next up
Extend GOLD #5 past Gītikā-pāda; add the `-comm` file (Bhāskara I + Someśvara) as commentary witnesses; Postgres index tier; more verify-tools (`procedureExec`, rotation-constant consistency).

### Decisions still open
- Create a GitHub remote for `pramakosha-sources` (currently local-only)?
- Whether/when to fold PramaKosha into a mygurukul tab vs. keep standalone.

---

## PramaKosha — Data Layer + Ingestion Pipeline + GOLD #4 (2026-06-08, session 2)

### Context
Design session #2 (still no code). Settled *where* PramaKosha's data sits, *how* it gets there, and built the depth-stressor GOLD entry. Three new HTML briefs in the **pramakosha repo** (`/Users/AJ/Developer/ML_Workspace/pramakosha/`), all untracked.

### Decisions locked this session
- **Data layer: Postgres-first, NOT a graph DB.** First-principles: PramaKosha is graph-*shaped* but traversals are shallow (1–3 hops) and it needs vector search — so a dedicated graph engine pays for an unused strength while degrading vectors. More texts *widen* the graph (fan-out), don't *deepen* it → scale strengthens the Postgres case. Architecture = **files as source of truth (git) → Postgres as derived/rebuildable index (relational + recursive-CTE + pgvector + tsvector) → static-render tier-1 pages to CDN** so read cost decouples from corpus size. Dedicated PramaKosha Postgres instance (honours "separate data store", dodges mygurukul's 56%-full DB). Cost: $0 pilot → ~$19/mo at thousands of texts (storage-bound, scale-to-zero). Caveats to verify: Neon free-tier specifics; no Apache AGE on Neon; Turso/libSQL as cheaper alt.
- **Ingestion pipeline = the provenance agents made real.** 12 stages, 4 phases, typed I/O contracts per stage. Deterministic-first (8/12 stages pure fns; only 4 spend LLM tokens — and translate/gloss runs on Tier-1 curated loci only, so **token cost scales with curated landmarks, not corpus size**). Key mechanics: CTS-URN minting (stable-or-provisional), stratum alignment by **pratīka-matching**. **GOLD entry = the golden-file acceptance test.**
- **GROUNDING DISCIPLINE (Ajay):** source files to be **manually downloaded to a local repo first**, before any agent processing — human-visible provenance, agents must NOT rely on parametric/training knowledge of the texts. [[pramakosha-grounding-discipline]]
- **GOLD #4 — Dharma shipped** as the depth exemplar: 7 witnesses / 5 traditions / 3 languages / 5 corpora; tradition-relative senses + `parallel-in-tradition` (anti-syncretism); interactive chronology-framework lens switch (mainstream/archaeoastronomy-Oak/purāṇic, verdict-free); two-tier attestation (curated cards + facet-filterable concordance); contested-date. Accessibility pass after Gemini critique (sub-10px metadata bumped). Captured a schema note: relations need a **node-promotion lifecycle** (a translation-parallel like Tamil *aṟam* may graduate to its own root node).

### Shipped (artifacts, pramakosha repo — untracked)
- `pramakosha-data-architecture.html` · `pramakosha-entry-dharma.html` (GOLD #4) · `pramakosha-ingestion-pipeline.html`

### Next up
Build the **Māṇḍūkya pilot** — but FIRST manually download the 4 GRETIL source files (Māṇḍūkya mūla, Gauḍapāda kārikā, Śaṅkara bhāṣya, Ānandagiri ṭīkā) into a local source repo. Then stand up deterministic Stages 0–3 + audit gates (zero LLM) and assert the acceptance table's deterministic rows against the Turīya GOLD record. Then GOLD #5 (technical entry).

### Decisions still open
- Commit the 3 new pramakosha briefs (repo currently has only the initial commit).
- Verify Neon free-tier limits; confirm GRETIL Māṇḍūkya source paths/encoding before the build.
- Whether Tamil `aṟam` should be `parallel-in-tradition[tamiḻ]` rather than the weaker `translation-parallel`.

---

## PramaKosha — Design Hardening + Private Repo (2026-06-08)

### Context
Design-only session (no code). Pressure-tested whether the 3 GOLD entries' structure can scale to PramaKosha's full ambition, then created a dedicated private repo for the project.

### Decisions locked this session
- **Depth needs a new axis.** `stratum` (mūla→ṭīkā, vertical/intra-work) is wrong for cross-text spread. Add **Witness** as a first-class entity `{work, tradition, language, school, date, corpus_source, edition, license}` on every attestation — the keystone for cross-tradition depth, the timeline, and multi-corpus.
- **Temporal organising principle.** Organise by the **agreed relative skeleton** (partial order: quotes/presupposes/commentary-on/linguistic-layer), default to NO calendar years. Absolute dates = attributed **chronology frameworks** (mainstream-indology / archaeoastronomy-Oak / puranic-traditional), verdict-free, applied equally. Resolves Ajay's point that the conventional timeline is contested and can't be ground truth.
- **Anti-syncretism is structural** — tradition-relative senses + `parallel-in-tradition` relation (Buddhist dhamma ≠ Brahmanical dharma; parallel, not contested).
- **Two-tier attestations** — curated landmark cards + exhaustive machine concordance. "Every reference" = tier 2.
- **Breadth via ~9 shared archetypes** (added: dravya, procedure, parameter, taxonomy-node, normative-rule, narrative-unit) — domains reuse them; new domain = a pack, not new core.
- **Domains organised by native vidyāsthāna taxonomy**; a corpus census maps all of GRETIL.
- **Domain packs, not persona "expert agents"** — expertise = lexicon + parser + verify-tools + grounded exemplars + human triage; agents' key skill is calibrated abstention. Make claims checkable by experts/tools, don't make agents experts.
- **GOLD set revised** — Dharma (depth-stressor) + an Āryabhaṭīya procedure (breadth-stressor, = first domain pack) replace Ātman + OM.

### Shipped (artifacts)
- New: `pramakosha-depth-breadth-analysis.html` (architecture review), `pramakosha-build-plan.html` (consolidated roadmap). Completed breadth section of the analysis brief.
- New **private repo `ajaybakshi/pramakosha`** (default branch `main`) — 6 pramakosha-*.html + README, committed & pushed. Lives at `/Users/AJ/Developer/ML_Workspace/pramakosha/` (standalone, NOT nested in mygurukul). Bharat-pedia old-name files excluded. Docs were COPIED — originals still untracked in `mygurukul-final/PramaKosha/`; new repo is canonical.

### Next up
Build **GOLD #4 — Dharma** in the pramakosha repo (exercise Witness axis + chronology frameworks + tradition-relative senses + two-tier). Then GOLD #5 (Āryabhaṭīya). Then Schema v0.1 + Editorial Guidelines v0.1.

### Decisions still open
- PramaKosha will launch as a **tab in mygurukul** (eventual code in `mygurukul-app-clean`), but design docs live in the separate private repo for now — decide when/how the two converge.
- Doc duplication: pick canonical home (recommend the new repo), clear `mygurukul-final/PramaKosha/` copies.
- Data separation / direct GRETIL TEI ingestion; Pali/Tamil corpus sources; storage migration; 10th archetype for Vyākaraṇa.

---

## PramaKosha — Project Kickoff (2026-06-07)

### Context
New sub-project of MyGurukul: turn the 79+ Sanskrit text library into a concept-indexed, citation-grounded, agent-built encyclopedia. Lives in-repo under `PramaKosha/` (design docs only so far — no code). Will launch as a mode at `mygurukul.org/pramakosha`, apex `pramakosha.org` later. Domains registered (`.org/.com/.in`). Earlier name "Bhārat-pedia" retired.

### Decisions locked this session
- **Name** PramaKosha (प्रमा = valid knowledge + कोश = treasury); wordmark camelCase, "Pramākośa" w/ diacritics on about page; pron cue PRA-maa KO-sha.
- **Namespaced from day one**, separate data store; corpus-sharing TBD (leaning: ingest GRETIL TEI-XML directly).
- **Build approach: spec-first.** Order = GOLD entries → Editorial Guidelines (Notability ⊂) → Schema (hinge) → agentic system. Entry is the *forcing function* for the guidelines.
- **Golden set (5):** Soma, Turīya, Gauḍapāda, Ātman (scoped to pilot texts + few), OM/Praṇava.
- **NO numeric stratum weights** — permission rules only (what a stratum may assert *about*).

### Shipped (artifacts in `PramaKosha/`, untracked)
1. `pramakosha-best-practices.html` — synthesis of 103-agent deep-research run (Amarakośa digitization = ready-made data model; SEP/Iranica/Brill governance; TEI Lex-0 + CTS-URN; Wikipedia excluded). Provenance-tagged ✓/◇/→.
2. `pramakosha-entry-soma.html` — GOLD, substance/deity (polysemy=3 synsets, CTS-URN loci, stratum permission, contested-empirical, canonical-record drawer).
3. `pramakosha-entry-turiya.html` — GOLD, pure concept (full 4-stratum stack mūla→ṭīkā, stratum permission rubric, contested-interpretation, corpus-seeded synsets).
4. `pramakosha-entry-gaudapada.html` — GOLD, person (name-set, floruit-as-range, self/external attestation types, 2 contested kinds: date + identity).

### Research provenance
deep-research workflow: 103 agents, 21 sources, 25 claims adversarially verified (24 confirmed, 1 killed). Keystone finding: the Amarakośa (UoH digitization) already does synset-as-unit + polysemy-as-multi-membership + machine-locus + ranked-commentary adjudication → the stratum model is *traditional method*. Two things the West has no template for (PK must design): differential commentary permissions + contested-claims-as-positions.

### Next up
Build remaining 2 GOLD entries: **Ātman** (horizontal axis — cross-text attestation at scale) then **OM/Praṇava** (symbol/practice). Then extract **Editorial Guidelines v0.1 + Schema v0.1** from the decisions the 5 entries forced.

---

## Admin Dashboard Hardening + Analytics (2026-06-02)

### Context
Ajay's admin token (`?token=…`) stopped working; investigation widened into auth, data-sync, and metrics work. All shipped to `main` and pushed; Vercel auto-deploys.

### What shipped (4 commits)
1. **`81ca781` — security: `/api/admin/*` was fully public.** Middleware matcher covered `/api/admin/:path*` but the guard only checked `pathname.startsWith('/admin')`, so every admin *API* (metrics, conversations, wisdom) served data with no token. Widened guard to `startsWith('/admin') || startsWith('/api/admin')`. Conversations (potential PII) were exposed for an unknown window — flagged to Ajay.
2. **Admin token rotated** in Vercel env (`ADMIN_SECRET_TOKEN`, Prod + Dev; Preview left unset — CLI "all-branches" mode needs `--value` which the secret-guard blocks). New value saved locally in gitignored `.admin-token.local`. Repo now linked to Vercel project `mygurukul-final`.
3. **`bd2b559` — conversation writes:** `agentic-wisdom` logged with an un-awaited `Promise.all` after the response; on Vercel the instance freezes once the stream closes, killing the in-flight INSERT. Newest DB row was 10 days stale despite traffic. Now awaited before `controller.close()` / `return`.
4. **`a15d133` + `664ce85` — metrics + analytics:** same drop bug fixed in `todays-wisdom` (also dropped the `saveWisdom` daily-card write!) and `agentic-wisdom` error path; added reusable `withApiMetrics()` wrapper applied to `/api/audio/generate` + `/api/library-manifest`; new **User Analytics tab** (sessions, retention, queries/session, daily volume, provider mix — all from `conversations`, sessions-only, no IP/geo) via `analyticsRepository.ts` + `GET /api/admin/analytics`; **24h/7d/30d/90d window selector** on the Metrics tab (defaults 7d).

### Key lesson (root cause of three separate "data not saving" symptoms)
**Un-awaited DB writes after the response are killed when Vercel freezes the serverless instance.** Always `await` logging/persistence before returning (or before `controller.close()` for streams). This silently dropped conversations, daily-wisdom cards, and API metrics for ~weeks.

### Verified
- `tsc --noEmit`: 0 errors. `npm run build`: exit 0 (wrapped route exports validated).
- Live DB checked via admin API: conversations newest row was 2026-05-23 pre-fix; `api_metrics` had 142 rows total but only 11 in last 30d.

### Optional follow-ups (not started)
- Raw per-call API log + response summaries (Ajay chose aggregated health view, not raw log).
- Add Preview-env `ADMIN_SECRET_TOKEN`; instrument more routes via `withApiMetrics`.
- Delete `.admin-token.local` once token is confirmed in use.

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
