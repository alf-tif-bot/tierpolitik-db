# Next Steps v0 — Stallbrände Schweiz

## Current blocker
Raw seed crawl only fetches landing pages (portal/search pages), not article detail pages.
This yields almost no direct `stallbrand` keyword hits in text snippets.

### Validation run (2026-03-04 00:00 CET)
- `python3 scripts/crawler_v0.py` → 8 raw rows written
- `python3 scripts/extract_candidates_v0.py` → 0 candidates
- Result confirms blocker is structural (seed-level crawl), not transient fetch failure.

## Required next step
Build source-specific article extractors:
1. collect article links from each source/search page
2. fetch article detail pages
3. run keyword + date + location extraction on article text
4. write to `events.raw.v1.jsonl` + `events.candidates.v1.jsonl`

## Priority source order
1. SRF search results
2. police.be.ch media list
3. stadt-zuerich police media
4. luzern police media
5. aargau police media



### Progress update (2026-03-04 00:44 CET)
- Upgraded crawler v0 to persist HTML snapshots per source (`data/stallbraende/snapshots.v0/*.html`) and store `html_path` in `events.raw.v0.jsonl`.
- Added link extraction step (`scripts/extract_links_v0.py`) from snapshot hrefs with keyword hints.
- Validation run:
  - raw rows: 8 (with HTML snapshots: 4)
  - extracted links: 23
  - keyword candidates: 0

### Current blocker (new)
- Half of seed sources currently fail to return HTML content (likely anti-bot / dynamic rendering / transient blocks), so detail-link coverage is still incomplete.
- Candidate extractor still runs on seed-level snippets; next step is article-detail fetch over `links.raw.v0.jsonl`.


### Progress update (2026-03-04 01:13 CET)
- Implemented article-detail fetch stage:
  - `scripts/fetch_article_pages_v0.py`
  - `scripts/extract_article_candidates_v0.py`
- Pipeline run now:
  - seed rows: 8 (seed HTML snapshots: 4)
  - extracted links: 23
  - fetched article pages: 23 (HTML success: 23, errors: 0)
  - keyword candidates (v1): 2
- First concrete hits now detected (20 Minuten):
  - Ramsen SH: 17'000 Masthühner verenden bei Stallbrand
  - Düdingen FR: Stallbrand fordert das Leben von 15 Kälbern

### Next blocker
- Coverage is still narrow (currently candidates mainly from one source family). Need source-specific link filters/selectors for police/cantonal portals to increase recall.


### Progress update (2026-03-04 01:17 CET)
- Added fetch diagnostics script: `scripts/diagnose_seed_fetch_v0.py`
- Generated `data/stallbraende/seed-fetch-report.v0.md`.
- Root cause for low source coverage is now explicit: 4/8 seed URLs return HTTP 404 (not anti-bot).
  - ch-be-police-news
  - ch-zh-police-news
  - ch-lu-police-news
  - ch-ag-police-news

### Immediate next action
- Repair `sources.v0.json` with current valid police/cantonal media URLs before further parser work.


### Progress update (2026-03-04 01:47 CET)
- Repaired outdated source registry URLs in `data/stallbraende/sources.v0.json`:
  - BE: `https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html`
  - ZH: `https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen.html`
  - LU: `https://polizei.lu.ch/dienstleistungen/medienmitteilungen`
  - AG: `https://www.ag.ch/de/themen/sicherheit/kantonspolizei/medienmitteilungen`
- Re-ran full v0→v1 pipeline.
- Result: seed fetch health improved from 4/8 to 8/8 HTML snapshots.
- Current outputs remain: 23 links, 23 article fetches, 2 keyword candidates.

### Updated blocker
- Fetch reliability is fixed; now bottleneck is link-recall/selection quality (extractor still under-collects from several sources).


### Progress update (2026-03-04 01:50 CET)
- Improved link extraction with source-aware patterns (`extract_links_v0.py` v0.3).
- Rerun results:
  - links: 24 (previous 23)
  - article rows fetched: 24 (100% fetch success)
  - candidates: 2 (unchanged)
- Link source distribution now visible and reproducible:
  - ch-20min-search: 13
  - ch-swissfire: 8
  - ch-srf-search: 1
  - ch-lu-police-news: 1
  - ch-nzz-search: 1

### Updated blocker
- Major recall gap persists for BE/ZH/AG despite reachable seed pages; those pages are JS-heavy and current static href extraction misses most detail entries.
- Next concrete step: add browser-rendered link capture (Playwright snapshot per source) for BE/ZH/AG.


### Progress update (2026-03-04 01:53 CET)
- Added browser-rendered link augmentation step (`scripts/augment_browser_links_v0.py`) for JS-heavy BE/ZH pages.
- Injected + deduped links discovered from rendered DOM:
  - BE media detail URLs (`newsID=...`): +10
  - ZH media detail URLs (`/de/aktuell/medienmitteilungen/YYYY/MM/...`): +10
- Post-augmentation pipeline status:
  - links total: 44 (up from 24)
  - article fetch: 44 ok / 0 errors
  - source coverage in links now includes BE + ZH explicitly.

### Updated blocker
- Coverage improved, but candidate recall still low (2) because keyword model is stallbrand-specific and many police releases are non-livestock fires.
- Next step: add lightweight classification/ranking (stall/bezug to livestock) after fetch to raise precision/recall balance.


### Progress update (2026-03-04 01:58 CET)
- Added lightweight relevance ranking step: `scripts/rank_livestock_relevance_v0.py`.
- New output: `data/stallbraende/articles.scored.v0.jsonl` with fields:
  - `livestock_score`
  - `livestock_hits`
  - `livestock_relevance` (high/medium/low)
- Current scoring result on 44 fetched articles:
  - high: 1
  - medium: 1
  - low: 42
- This creates a usable shortlist layer above raw keyword matches.

### Remaining blocker
- Scoring needs calibration (false-low risk on some valid livestock-fire reports due to language variants/context weighting).


### Progress update (2026-03-04 02:29 CET)
- Calibrated relevance scoring (`rank_livestock_relevance_v0.py`):
  - HTML entity unescape before matching
  - plural/declension-tolerant livestock regex (`kälber*`, `kalb*`, `schwein*`, etc.)
  - combo boost when fire+livestock context co-occur
- Re-run on 44 articles:
  - high: 2
  - medium: 2
  - low: 40
- Previously under-ranked case now improved:
  - “Düdingen FR … 15 Kälbern” moved from low → medium.

### Remaining blocker
- Still no dedicated temporal/location normalization (year/canton extraction), limiting confident dedupe and trend stats.


### Progress update (2026-03-04 02:32 CET)
- Added temporal/location enrichment step: `scripts/enrich_time_location_v0.py`.
- New output: `data/stallbraende/articles.enriched.v0.jsonl` with:
  - `event_year`
  - `event_canton`
- Current coverage on 44 articles:
  - with year: 34
  - with canton: 43
- Shortlist now carries structured context, e.g.:
  - Ramsen SH … (SH, 2026)
  - Düdingen FR … (FR, 2026)

### New blocker
- Canton inference has false-positives on generic pages (e.g. swissfire) due simple token matching; needs source-aware fallback order and stricter signal weighting.


### Progress update (2026-03-04 02:54 CET)
- Tightened canton inference in `enrich_time_location_v0.py` with source-aware priority:
  - official source host mapping first (ZH/BE/AG/LU)
  - suppress weak canton guesses for generic sources (e.g. swissfire)
  - lexical fallback only when incident context is present
- Re-run effect:
  - swissfire false positives removed: canton-assigned `8 -> 0`
  - total canton coverage now `29/44` (down from 43/44, but materially cleaner signal)

### Remaining blocker
- Need a second-pass extractor for location entities from article body (not only title/snippet) to recover recall after stricter filtering.


### Progress update (2026-03-04 03:01 CET)
- Tested second-pass context expansion by increasing article snippet window in `fetch_article_pages_v0.py` (700 -> 3500 chars) to improve location extraction.
- Re-run impact on current 44-link set:
  - year coverage: 35 (was 34)
  - canton coverage: 34 (was 29)
  - scored high relevance: 6 (was 2)
- Side effect observed: precision dropped due page-noise contamination (related links/navigation text leaking into snippet), causing false canton/score boosts.

### Current blocker
- Need proper main-content extraction (article-body isolation) before longer-context scoring/enrichment is trustworthy.


### Progress update (2026-03-04 03:03 CET)
- Implemented lightweight boilerplate suppression in `fetch_article_pages_v0.py` before snippet scoring/enrichment.
- Also reduced snippet window from noisy 3500 to 2200 chars after cleaning.
- Re-run status:
  - article fetch: 44 ok / 0 errors
  - year coverage: 38 (improved)
  - canton coverage: 34 (unchanged)
  - high relevance: 6 (unchanged)

### Current blocker
- Scoring still has semantic false positives on non-livestock fire reports (e.g. generic "Brand in ..." police news).
- Need a stricter livestock-entity gate (animals/stall context required) in addition to fire keywords.


### Progress update (2026-03-04 03:06 CET)
- Added strict livestock gate in scorer (`rank_livestock_relevance_v0.py`) to cap fire-only stories.
- Re-run showed no effective precision gain (high still 6) because noisy snippets still carry incidental livestock tokens from surrounding page content.

### Active blocker
- Without reliable article-body isolation, token-based gates remain contaminated and cannot reliably separate true livestock-fire reports from generic fire news.


### Progress update (2026-03-04 03:08 CET)
- Implemented first article-body isolation pass in `fetch_article_pages_v0.py` (`article/main/content-like` block extraction before text scoring).
- Re-run result:
  - fetch: 44/44 ok
  - canton coverage: 28 (down from 34, less noisy)
  - year coverage: 36
  - high relevance: 6 (still unchanged)
- Signal got cleaner, but high-score false positives remain.

### Active blocker
- Need stronger semantic guardrail in scorer (e.g., require livestock+incident co-mention in close proximity) to reduce remaining false highs.


### Progress update (2026-03-04 03:10 CET)
- Added semantic proximity guard in scorer (`rank_livestock_relevance_v0.py`) to require livestock+incident co-mention for high-confidence cases.
- Despite this, high bucket stayed at 6 due residual contamination in extracted text (false livestock tokens still present in some non-livestock fire reports).

### Confirmed blocker
- Current regex/body heuristic still leaks cross-article context on some pages; robust extraction (Readability/DOM-specific selectors per source) is required before further scorer tuning has leverage.


### Progress update (2026-03-04 03:16 CET)
- Added host-aware main-content isolation in `fetch_article_pages_v0.py` (source-specific selector priority before generic fallback).
- Re-ran full fetch→score→enrich cycle.
- Outcome unchanged on key precision metric:
  - high: 6
  - canton: 28
- Conclusion: selector heuristics alone are insufficient on current source mix; contamination still present for some pages.

### Blocker status
- Still blocked on robust body extraction quality (needs stronger parser/readability-grade extraction or per-source hard selectors with validation tests).


### Progress update (2026-03-04 03:19 CET)
- Added precision audit artifact for scorer output: `data/stallbraende/precision-audit.v0.md`.
- Audit on current high bucket shows likely false positives: `2 / 6` high items.
- This gives a concrete acceptance metric for extractor/scorer iterations (target: reduce likely-fp in high bucket before expanding coverage).

### Blocker (unchanged)
- Root cause still extraction quality; scorer already has multiple guards but receives contaminated text for some pages.


### Progress update (2026-03-04 03:49 CET)
- Added extraction quality diagnostic: `scripts/evaluate_extraction_noise_v0.py`.
- Generated `data/stallbraende/extraction-noise-report.v0.md`.
- Current run flags `1/44` snippets as structurally noisy by heuristic (nav/related/repetition signals).

### Interpretation
- Remaining false-high issue likely comes less from gross boilerplate and more from subtle semantic leakage/token ambiguity in article snippets.
- Next step should target scorer logic with source-aware negative patterns for known false-high archetypes.


### Progress update (2026-03-04 03:59 CET)
- Added source-aware precision guard in scorer: **title livestock gate** (`rank_livestock_relevance_v0.py`).
- Rule: items cannot remain `high` when title lacks explicit livestock signal; capped to medium.
- Re-run impact (44 articles):
  - high: `6 -> 3`
  - medium: `0 -> 3`
  - likely false positives in high bucket: `2 -> 0`
- High bucket now contains only explicit livestock-fire cases.

### Progress update (2026-03-04 04:30 CET)
- Continued `task_stallbraende_002` with downstream aggregation/reporting:
  - `python3 scripts/build_events_table_v1.py` -> `data/stallbraende/events.table.v1.json` (6 rows)
  - `python3 scripts/render_events_report_v1.py` -> `docs/EVENTS-REPORT.v1.md`
- Result snapshot: current event table contains 6 candidates, all from 20min.

### Active blocker
- Recall/source-diversity gap remains: no event candidates from BE/ZH/LU/AG police sources despite link coverage.
- Structured field gap remains: canton extraction is missing (`UN`) in rendered report for all 6 current rows.

### Next concrete step
- Add source-specific content/metadata extractors for police domains (BE/ZH/LU/AG) and rerun pipeline to increase non-20min candidates and recover canton fields.

### Progress update (2026-03-04 04:37 CET)
- Continued `task_stallbraende_002` by fixing event-table extraction quality in `scripts/build_events_table_v1.py`:
  - title HTML entities are now decoded before parsing
  - canton regex accepts capitalized place names
  - canton fallback from URL slug added (`...-zh-...` -> `ZH`, etc.)
  - quantity parsing now handles encoded apostrophes (`17&#x27;000` -> `17000`)
- Rebuilt outputs:
  - `python3 scripts/build_events_table_v1.py`
  - `python3 scripts/render_events_report_v1.py`
- Result: report canton coverage improved from `UN(6)` -> `BE(1), FR(1), GR(1), SH(1), SZ(1), ZH(1)` and Ramsen count corrected to `17000`.

### Active blocker
- Source diversity remains narrow (current 6 events still only from 20min).

### Next concrete step
- Increase non-20min recall by adding police-domain detail selectors (BE/ZH/LU/AG) in link/article extraction stage, then rerun full v1 pipeline.

### Progress update (2026-03-04 05:05 CET)
- Continued `task_stallbraende_002` with v1 pipeline hardening:
  - Expanded incident keyword coverage in `extract_articles_v1.py` (added `Bauernhof/Landwirtschaftsbetrieb/Ökonomiegebäude/Scheune` fire variants).
  - Fixed orchestration gap in `scripts/run_v1_pipeline.sh` by adding missing `merge_candidates_v1.py` step before table/report generation.
  - Fixed regression in `filter_candidates_v1.py`: NEG filter now checks only `url+title` (not noisy snippet nav text), while POS still uses snippet context.
- Validation run:
  - full pipeline executed
  - extracted candidates: 10
  - filtered candidates: 6
  - merged candidates: 6
  - final report rebuilt with 6 events and corrected canton/count fields.

### Active blocker
- Source-diversity blocker persists: filtered/merged events are still exclusively from 20min; police sources produce mainly listing/navigation links, not incident detail pages.

### Next concrete step
- Tighten police link discovery with source-specific detail URL regexes + blocklist (readspeaker/linkedin/rss/archive/navigation) before fetch stage.

### Progress update (2026-03-04 05:10 CET)
- Continued `task_stallbraende_002` with police-link hygiene in `filter_links_allowlist_v1.py`:
  - added global noise blocks (`readspeaker`, `linkedin`, rss/search/archive/navigation fragments)
  - added source-specific police hard-blocks for listing/archive endpoints
  - tightened police allowlist to likely detail URL shapes (`?newsid=`, dated medienmitteilung paths)
- Validation (`bash scripts/run_v1_pipeline.sh`):
  - filtered links reduced `46 -> 29` (noise cut)
  - extracted candidates `8`
  - filtered candidates `6`
  - merged candidates `6`
  - report rebuilt successfully.

### Active blocker
- Recall blocker unchanged: police detail incidents are still not entering final candidate set; output remains 20min-only.

### Next concrete step
- Implement direct police detail-page discovery (pagination/API/rss/source-specific parsers) instead of relying on generic href crawl from listing pages.

### Progress update (2026-03-04 05:40 CET)
- Continued `task_stallbraende_002` by integrating dedicated police ingestion steps into orchestration:
  - `run_v1_pipeline.sh` now includes:
    - `extract_police_links_v1.py`
    - `extract_from_police_links_v1.py`
    - `extract_police_zh_rss_v1.py`
    - `extract_police_be_newsid_v1.py`
- Fixed pipeline execution reliability:
  - first run failed on `extract_police_be_newsid_v1.py` with `Permission denied` (script not executable).
  - mitigated by switching pipeline call to `python3 .../extract_police_be_newsid_v1.py`.
- Validation signals after run:
  - police-focused links discovered: `41` (BE 38, LU 1, ZH 2)
  - police candidates: `0`
  - ZH RSS items: `10`, candidates: `0`
  - BE newsID scanned: `52`, candidates: `0`
  - merged/final events remain `6` (unchanged).

### Active blocker
- Even with dedicated police extraction paths, current keyword/gating logic yields zero police candidates on scanned sets.
- This is now a **semantic recall blocker** (not discovery availability): links exist, but extraction/matching rejects all.

### Next concrete step
- Add an audit mode to dump top police titles/snippets that nearly match fire/farm terms, then tune keyword rules against real police wording (e.g., Ökonomiegebäude-/Scheunenbrand variants without explicit "Stall" token).

### Progress update (2026-03-04 06:00 CET)
- Continued `task_stallbraende_002` with police semantic-recall diagnostics.
- Added audit artifact: `data/stallbraende/police-keyword-audit.v1.md`.
- Audit result on current police link set (`links.police.v1.jsonl`, 41 URLs):
  - BE: fire+farm `0`, fire-only `1`, none `37`
  - LU: fire+farm `0`, fire-only `1`
  - ZH: fire+farm `0`, none `2`
- Interpretation: zero police candidates is currently not caused by regex parser crash; the sampled police URLs are mostly non-fire/non-farm incident categories.

### Active blocker
- Police candidate scarcity persists because current discovery retrieves mostly generic/current police bulletins with low prior probability for stall/farm fires.

### Next concrete step
- Shift discovery from generic latest police items to historical fire-focused slices:
  1) add year-iterated archive discovery (2020..now) for BE/ZH/LU/AG
  2) seed fire-taxonomy endpoints/filters where available
  3) rerun police extraction + merge.

### Progress update (2026-03-04 06:02 CET)
- Continued `task_stallbraende_002` with year-iterated police archive discovery in `extract_police_links_v1.py`.
- Added pass `year_seed` (2020..2026) for BE/ZH/LU/AG archive/listing endpoints and re-ran police extraction chain.
- Measured impact:
  - police-focused links: `41 -> 48`
  - ZH police link coverage: `2 -> 9`
  - BE coverage unchanged (`38`), LU unchanged (`1`).
- Downstream extraction rerun completed (police article extraction + rss + be newsid + merge + table + report).

### Active blocker
- Despite broader police link coverage, police candidates remain `0`; final merged events remain `6` (20min-only).
- This confirms blocker is now mainly matching strategy vs police wording/time-slice, not just missing links.

### Next concrete step
- Add `fire-only shortlist` output for police sources (candidate_tier=review) to avoid hard drop of potential leads, then manually/heuristically promote when farm/stall context appears in body.

### Progress update (2026-03-04 06:06 CET)
- Continued `task_stallbraende_002` by implementing a police **review-tier fallback** in `extract_from_police_links_v1.py`.
- New behavior:
  - strict police candidates (fire+farm/stall semantics) stay in `articles.police.v1.jsonl`
  - fire-only police incidents are now retained in `articles.police.review.v1.jsonl` with:
    - `candidate_reason=police_fire_only_review_v1`
    - `candidate_tier=review`
- Validation run:
  - strict police candidates: `0`
  - review-tier police items: `13`
  - merged final events unchanged: `6`

### Active blocker
- No strict police stall/farm matches yet; current police corpus mostly generic fire incidents without explicit farm/livestock context in headline/body snippet.

### Next concrete step
- Add secondary enrichment pass over `articles.police.review.v1.jsonl` (entity extraction for farm/stall terms in deeper body window) and auto-promote to strict candidates when confidence threshold is met.

### Progress update (2026-03-04 06:09 CET)
- Continued `task_stallbraende_002` with a second-pass promotion stage for police review-tier items.
- Added script: `scripts/promote_police_review_v1.py`
  - input: `articles.police.review.v1.jsonl`
  - fetches deeper body window per URL
  - promotes to `articles.police.promoted.v1.jsonl` when explicit farm/livestock terms are found
- Wired promoted output into merge stage (`merge_candidates_v1.py`).
- Validation run:
  - promoted police candidates: `0`
  - merged candidates remain `6`
  - report rebuilt successfully.

### Active blocker
- Even deeper-body second-pass finds no explicit farm/livestock signals in current police review pool.
- Blocker is now primarily **source corpus mismatch** (retrieved police incidents likely not stall/farm related), not pipeline mechanics.

### Next concrete step
- Expand source set with dedicated fire-service/insurance incident archives that classify by object type (farm/öconomie/stall), then merge those feeds before police semantic gating.

### Progress update (2026-03-04 10:10 CET)
- Continued `task_stallbraende_002` by operationalizing the new police review-tier output.
- Added script: `scripts/build_police_review_queue_v1.py`.
  - renders `articles.police.review.v1.jsonl` into `docs/POLICE-REVIEW-QUEUE.v1.md`
  - provides a deterministic queue for manual triage / future auto-promotion tests.
- Current queue snapshot: 13 items.

### Active blocker
- Review-tier queue quality is weak: several entries are non-fire incidents (traffic/collision), indicating residual page-noise contamination in fire-only detection.

### Next concrete step
- tighten `FIRE_ONLY` gate in `extract_from_police_links_v1.py` with phrase-level constraints (`brand in`, `feuerwehreinsatz`, `brennt`, `rauchentwicklung`) and exclude known non-fire templates (`kollision`, `unfall`, `zeugenaufruf`) unless fire phrase co-occurs.

### Progress update (2026-03-04 10:40 CET)
- Continued `task_stallbraende_002` with precision hardening of police review-tier gating in `extract_from_police_links_v1.py`.
- Implemented:
  - stronger fire phrase gate (`brand in`, `feuerwehreinsatz`, `brennt`, `rauchentwicklung`, `in flammen`, ...)
  - non-fire exclusion for accident/collision templates unless fire phrase co-occurs in title
  - archive hard-block (`archiv medienmitteilungen`, historical archive URLs/titles)
- Rebuilt review queue (`build_police_review_queue_v1.py`).
- Result:
  - review-tier items reduced `13 -> 1` (major noise cut)
  - remaining item: BE news entry "Brand in Mehrfamilienhaus" (valid fire but non-farm context)

### Active blocker
- Precision improved, but recall-to-target mismatch remains: surviving police fire item still not farm/stall-related; strict candidate count remains 0.

### Next concrete step
- Add object-type filter in review/promotion stage (require `stall|scheune|landwirtschaft|ökonomiegebäude` proximity) to auto-drop urban/residential fire reports and keep only agriculture-relevant fire leads.

### Progress update (2026-03-04 10:41 CET)
- Continued `task_stallbraende_002` by adding agriculture object-type gating to police review fallback (`extract_from_police_links_v1.py`).
- New review guard: keep fire-only police items only if farm-object context is present (`stall|scheune|landwirtschaft|bauernhof|ökonomiegebäude|tierstall`).
- Rebuilt police review queue.
- Result: review-tier queue reduced `1 -> 0` (remaining residential fire removed as non-target).

### Active blocker
- With precision gates now strict, police pipeline currently yields no agriculture-relevant candidates on the available corpus slice.

### Next concrete step
- Increase recall via new source families with explicit object taxonomy (fire-service operation logs, insurance/fire-statistics incident feeds), then run same strict gating.

### Progress update (2026-03-04 11:46 CET)
- Cockpit priority check unchanged: active top ALF task remains `task_stallbraende_002`.
- Reconfirmed current pipeline state: strict police candidates `0`, review-tier `0`, merged events unchanged.
- No further precision tweaks applied to avoid overfitting on empty police corpus.

### Active blocker
- Hard blocker remains source-corpus mismatch: current police feeds do not expose agriculture-object fire incidents in accessible slices.

### Next concrete step (requires source expansion)
- Add new source family with object-typed incident logs (fire brigade operation logs / cantonal fire-statistics pages) before next extraction iteration.

### Progress update (2026-03-04 12:24 CET)
- Cockpit priority check unchanged: `task_stallbraende_002` remains highest pending ALF task.
- No new extraction run started; blocker remains external to current pipeline logic.

### Active blocker
- Source-corpus mismatch persists (no agriculture/stall fire cases in currently integrated police feeds/time slices).

### Next concrete step
- Add at least one new object-classified fire source before next pipeline iteration.
