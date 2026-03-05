#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'links.prioritized.v1.jsonl'
OUT = ROOT / 'data' / 'stallbraende' / 'links.filtered.v1.jsonl'

# Domain/source specific allowlist patterns to suppress nav/anchor/search noise
ALLOW = {
    'ch-srf-search': ['/news/', '/story/'],
    'ch-20min-search': ['/story/'],
    'ch-nzz-search': ['/schweiz/', '/international/', '/panorama/'],
    'ch-swissfire': ['/news', '/aktuell', '/medien'],
    # Police sources: keep only likely detail pages
    'ch-be-police-news': ['?newsid=', '/medienmitteilungen.html?newsid='],
    'ch-zh-police-news': ['/de/aktuell/medienmitteilungen/', '/mitteilungsarchiv/'],
    'ch-lu-police-news': ['/dienstleistungen/medienmitteilungen/'],
    'ch-ag-police-news': ['/de/themen/sicherheit/kantonspolizei/medienmitteilungen/'],
}

# global noise blocklist
BLOCK_CONTAINS = [
    '#', 'newsletter', '/suche', '/search', '/rss', '.rss',
    'radio', 'podcast', 'shop.', 'abo.', 'linkedin.com',
    'readspeaker.com', 'opensearch', 'mitteilungsarchiv.html'
]

# source-specific hard blocks to remove listing/navigation/archive links
SOURCE_BLOCK = {
    'ch-be-police-news': ['/medienmitteilungen.html', '/fr/start/themen/news/medienmitteilungen.html'],
    'ch-zh-police-news': ['/de/aktuell/medienmitteilungen.html', '/teaser.rss'],
    'ch-lu-police-news': ['archiv_medienmitteilungen_2004_2015'],
    'ch-ag-police-news': ['/medienmitteilungen$'],
}

rows=[]
for line in INP.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    r=json.loads(line)
    link=(r.get('link') or '').lower()
    sid=r.get('source_id') or ''
    if not link:
        continue
    if any(b in link for b in BLOCK_CONTAINS):
        continue

    blocked = False
    for b in SOURCE_BLOCK.get(sid, []):
        if b.endswith('$'):
            if link.rstrip('/') == b[:-1].rstrip('/'):
                blocked = True
                break
        elif b in link:
            blocked = True
            break
    if blocked:
        continue

    allow = ALLOW.get(sid)
    if allow and not any(a in link for a in allow):
        continue

    rows.append(r)

with OUT.open('w', encoding='utf-8') as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

print(f'wrote {len(rows)} filtered links -> {OUT}')
print('top10:')
for r in rows[:10]:
    print(r.get('priority_score'), r.get('source_id'), r.get('link'))
