#!/usr/bin/env python3
import json
import re
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data' / 'stallbraende' / 'sources.v0.json'
OUT = ROOT / 'data' / 'stallbraende' / 'links.police.v1.jsonl'

POLICE_IDS = {'ch-be-police-news', 'ch-zh-police-news', 'ch-lu-police-news', 'ch-ag-police-news'}
HREF = re.compile(r'href=["\']([^"\']+)["\']', re.I)

ALLOW_PATTERNS = {
  'ch-be-police-news': [
      re.compile(r'/de/start/themen/news/medienmitteilungen/[^\s?#]+', re.I),
  ],
  'ch-zh-police-news': [
      re.compile(r'/de/aktuell/medienmitteilungen/[^\s?#]+', re.I),
      re.compile(r'/misc/de/mitteilungsarchiv\.html', re.I),
      re.compile(r'/jcr:content/.+\.rss$', re.I),
  ],
  'ch-lu-police-news': [
      re.compile(r'/dienstleistungen/medienmitteilungen/[^\s?#]+', re.I),
      re.compile(r'/dienstleistungen/medienmitteilungen/archiv[^\s?#]*', re.I),
  ],
  'ch-ag-police-news': [
      re.compile(r'/themen/sicherheit/kantonspolizei/medienmitteilungen/[^\s?#]+', re.I),
  ],
}
BLOCK = re.compile(
    r'(linkedin\.com|readspeaker|/kontakt|/impressum|/datenschutz|mailto:|javascript:|tel:|#)',
    re.I,
)
HUB_HINT = re.compile(r'(archiv|archive|medienmitteilungen(\.html)?$|/jahr/|/news/)', re.I)


def fetch(url: str) -> str:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 StallbraendeMonitor/0.6'})
    return urlopen(req, timeout=30).read().decode('utf-8', 'ignore')


def allowed(source_id: str, full_url: str) -> bool:
    pats = ALLOW_PATTERNS.get(source_id, [])
    return any(p.search(full_url) for p in pats)


def normalize(u: str) -> str:
    return u.strip().split('#')[0]


def is_hub_link(u: str) -> bool:
    return bool(HUB_HINT.search(u)) and not u.lower().endswith('.pdf')


def extract_links(base_url: str, html: str):
    for href in HREF.findall(html):
        full = urljoin(base_url, href)
        if not full.startswith('http'):
            continue
        full = normalize(full)
        if BLOCK.search(full):
            continue
        yield full


def main():
    sources = json.loads(SRC.read_text(encoding='utf-8'))
    rows = []
    seen = set()

    for s in sources:
        sid = s.get('id')
        if sid not in POLICE_IDS:
            continue

        base = s.get('url')
        hub_links = set()
        try:
            html = fetch(base)
        except Exception as e:
            rows.append({'source_id': sid, 'base_url': base, 'error': str(e), 'link': None})
            continue

        # Pass 1: from landing page
        for full in extract_links(base, html):
            if not allowed(sid, full):
                continue
            if is_hub_link(full):
                hub_links.add(full)
            key = (sid, full)
            if key in seen:
                continue
            seen.add(key)
            rows.append({'source_id': sid, 'base_url': base, 'link': full})

        # Pass 2: crawl one level deeper on archive/hub pages
        for hub in sorted(hub_links):
            try:
                hub_html = fetch(hub)
            except Exception:
                continue
            for full in extract_links(hub, hub_html):
                if not allowed(sid, full):
                    continue
                key = (sid, full)
                if key in seen:
                    continue
                seen.add(key)
                rows.append({'source_id': sid, 'base_url': base, 'link': full, 'discovered_via': hub})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    print(f'wrote {len(rows)} police-focused links -> {OUT}')
    by_source = {}
    for r in rows:
        sid = r.get('source_id', 'unknown')
        by_source[sid] = by_source.get(sid, 0) + 1
    for sid in sorted(by_source):
        print(f'  {sid}: {by_source[sid]}')


if __name__ == '__main__':
    main()
