#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT/scripts/crawler_v0.py"
"$ROOT/scripts/discover_links_v1.py"
"$ROOT/scripts/summarize_discovery_v1.py"
"$ROOT/scripts/prioritize_links_v1.py"
"$ROOT/scripts/filter_links_allowlist_v1.py"
"$ROOT/scripts/extract_articles_v1.py"
"$ROOT/scripts/extract_police_links_v1.py"
"$ROOT/scripts/extract_from_police_links_v1.py"
"$ROOT/scripts/extract_police_zh_rss_v1.py"
python3 "$ROOT/scripts/extract_police_be_newsid_v1.py"
"$ROOT/scripts/filter_candidates_v1.py"
"$ROOT/scripts/merge_candidates_v1.py"
"$ROOT/scripts/build_events_table_v1.py"
"$ROOT/scripts/render_events_report_v1.py"

echo "v1 pipeline completed"
