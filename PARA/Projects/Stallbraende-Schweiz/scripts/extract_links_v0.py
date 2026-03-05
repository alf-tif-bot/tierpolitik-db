#!/usr/bin/env python3
"""Extract detail-link candidates from saved source snapshots (v0.3 source-aware)."""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data' / 'stallbraende' / 'events.raw.v0.jsonl'
OUT = ROOT / 'data' / 'stallbraende' / 'links.raw.v0.jsonl'

HREF_RE = re.compile(r"href=[\"']([^\"']+)[\"']", re.I)
BAD_PREFIX = ('javascript:', 'mailto:', '#')
BAD_EXT = ('.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.pdf', '.zip')
GENERIC_HINT = re.compile(r'(brand|feuer|stall|hof|landwirtschaft|scheune)', re.I)

SOURCE_PATTERNS = {
    'ch-be-police-news': re.compile(r'newsid=|medienmitteilungen\.html\?newsid=', re.I),
    'ch-zh-police-news': re.compile(r'/de/aktuell/medienmitteilungen/\d{4}/\d{2}/', re.I),
    'ch-lu-police-news': re.compile(r'/dienstleistungen/medienmitteilungen/|\bmedienmitteilungen\b.*\d{4}', re.I),
    'ch-ag-police-news': re.compile(r'/de/themen/sicherheit/kantonspolizei/medienmitteilungen/[^/#?]+', re.I),
}


def extract_pattern_links(sid: str, html: str, base: str) -> list[str]:
    found = []
    if sid == 'ch-be-police-news':
        for m in re.findall(r'newsID=([0-9a-fA-F-]{36})', html):
            found.append(f"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID={m}")
    if sid == 'ch-zh-police-news':
        for m in re.findall(r'(/de/aktuell/medienmitteilungen/\d{4}/\d{2}/[a-zA-Z0-9_-]+\.html)', html):
            found.append(urljoin(base, m))
    if sid == 'ch-ag-police-news':
        for m in re.findall(r'(/de/themen/sicherheit/kantonspolizei/medienmitteilungen/[a-zA-Z0-9_-]+)', html):
            found.append(urljoin(base, m))
    if sid == 'ch-lu-police-news':
        for m in re.findall(r'(/dienstleistungen/medienmitteilungen/[a-zA-Z0-9_-]+)', html):
            found.append(urljoin(base, m))
    return found


def normalize(base: str, href: str) -> str | None:
    h = href.strip()
    if not h or h.startswith(BAD_PREFIX):
        return None
    url = urljoin(base, h)
    u = urlparse(url)
    if u.scheme not in ('http', 'https'):
        return None
    if any(u.path.lower().endswith(ext) for ext in BAD_EXT):
        return None
    return url


rows: list[dict] = []
seen: set[tuple[str, str]] = set()
for line in RAW.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    r = json.loads(line)
    sid = r.get('source_id') or ''
    base = r.get('source_url') or ''
    html_path = r.get('html_path')
    html = ''
    if html_path:
        p = ROOT / html_path
        if p.exists():
            html = p.read_text(encoding='utf-8', errors='ignore')

    source_pat = SOURCE_PATTERNS.get(sid)
    # 1) HREF-based extraction
    for href in HREF_RE.findall(html):
        url = normalize(base, href)
        if not url:
            continue
        u = url.lower()
        keep = False
        if source_pat and source_pat.search(u):
            keep = True
        elif GENERIC_HINT.search(u):
            keep = True
        if not keep:
            continue
        key = (sid, url)
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            'source_id': sid,
            'source_name': r.get('source_name'),
            'fetched_at': r.get('fetched_at'),
            'url': url,
            'origin': 'snapshot_href_source_aware',
        })

    # 2) pattern extraction from raw html (for JS-heavy pages)
    for url in extract_pattern_links(sid, html, base):
        key = (sid, url)
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            'source_id': sid,
            'source_name': r.get('source_name'),
            'fetched_at': r.get('fetched_at'),
            'url': url,
            'origin': 'snapshot_pattern_source_aware',
        })

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open('w', encoding='utf-8') as f:
    for row in rows:
        f.write(json.dumps(row, ensure_ascii=False) + '\n')

print(f'wrote {len(rows)} links -> {OUT}')
