#!/usr/bin/env python3
"""Stallbrände Schweiz – Crawler Pipeline v0 (seed + raw capture)

- loads source registry
- pulls basic metadata from source URLs
- writes raw snapshots for manual triage

This is intentionally conservative for v0: it builds a reproducible ingestion spine
without overfitting brittle parsers too early.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "stallbraende" / "sources.v0.json"
OUT_DIR = ROOT / "data" / "stallbraende"
OUT_JSONL = OUT_DIR / "events.raw.v0.jsonl"


@dataclass
class RawEvent:
    source_id: str
    source_name: str
    source_url: str
    fetched_at: str
    title: str | None
    snippet: str | None
    http_status: int | None


def fetch_html(url: str) -> tuple[int | None, str]:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 StallbraendeMonitor/0.1"})
    with urlopen(req, timeout=25) as r:
        status = getattr(r, "status", None)
        html = r.read().decode("utf-8", "ignore")
        return status, html


def extract_title_snippet(html: str) -> tuple[str | None, str | None]:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else None

    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    snippet = text[:360] if text else None
    return title, snippet


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc).isoformat()

    rows: list[RawEvent] = []
    for s in sources:
        try:
            status, html = fetch_html(s["url"])
            title, snippet = extract_title_snippet(html)
            rows.append(
                RawEvent(
                    source_id=s["id"],
                    source_name=s["name"],
                    source_url=s["url"],
                    fetched_at=now,
                    title=title,
                    snippet=snippet,
                    http_status=status,
                )
            )
        except Exception as e:
            rows.append(
                RawEvent(
                    source_id=s["id"],
                    source_name=s["name"],
                    source_url=s["url"],
                    fetched_at=now,
                    title=None,
                    snippet=f"FETCH_ERROR: {e}",
                    http_status=None,
                )
            )

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(asdict(r), ensure_ascii=False) + "\n")

    print(f"wrote {len(rows)} rows -> {OUT_JSONL}")


if __name__ == "__main__":
    main()
