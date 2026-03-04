#!/usr/bin/env python3
import json
import re
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data' / 'stallbraende' / 'sources.v0.json'
OUT = ROOT / 'data' / 'stallbraende' / 'links.police.v1.jsonl'

POLICE_IDS = {'ch-be-police-news', 'ch-zh-police-news', 'ch-lu-police-news', 'ch-ag-police-news'}
HREF = re.compile(r'href=["\']([^"\']+)["\']', re.I)

ALLOW_PATTERNS = {
  'ch-be-police-news': [
      re.compile(r'/de/start/themen/news/medienmitteilungen(?:/[^\s?#]+)?$', re.I),
      re.compile(r'/de/start\.html\?newsid=[0-9a-f-]+', re.I),
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
SITEMAP_HINT = re.compile(r'(medienmitteilungen|mitteilungsarchiv|/news/|/aktuell/|newsid=)', re.I)
YEAR_QS = re.compile(r'([?&](?:year|jahr)=)(\d{4})', re.I)

SITEMAP_SEEDS = {
    'ch-be-police-news': ['https://www.police.be.ch/sitemap.xml'],
    'ch-ag-police-news': ['https://www.ag.ch/sitemap.xml'],
    'ch-zh-police-news': ['https://www.stadt-zuerich.ch/misc/de/mitteilungsarchiv.gsitemap.xml'],
    'ch-lu-police-news': ['https://polizei.lu.ch/xmlsitemap'],
}


def fetch(url: str) -> str:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 StallbraendeMonitor/0.6'})
    return urlopen(req, timeout=30).read().decode('utf-8', 'ignore')


def fetch_bytes(url: str) -> bytes:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 StallbraendeMonitor/0.6'})
    return urlopen(req, timeout=30).read()


def looks_current_enough(u: str) -> bool:
    m = YEAR_QS.search(u)
    if not m:
        return True
    try:
        return int(m.group(2)) >= 2020
    except Exception:
        return True


def sitemap_urls(seed_url: str, max_urls: int = 1200):
    out = []
    queue = [seed_url]
    seen = set()

    while queue and len(out) < max_urls:
        cur = queue.pop(0)
        if cur in seen:
            continue
        seen.add(cur)

        try:
            raw = fetch_bytes(cur)
        except Exception:
            continue

        try:
            root = ET.fromstring(raw)
        except Exception:
            continue

        tag = root.tag.lower()
        # sitemap index
        if tag.endswith('sitemapindex'):
            for loc in root.findall('.//{*}loc'):
                if loc.text and loc.text.strip():
                    queue.append(loc.text.strip())
            continue

        # urlset
        for loc in root.findall('.//{*}loc'):
            if not loc.text:
                continue
            u = loc.text.strip()
            if u:
                out.append(u)
            if len(out) >= max_urls:
                break

    return out


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
                if not looks_current_enough(full):
                    continue
                key = (sid, full)
                if key in seen:
                    continue
                seen.add(key)
                rows.append({'source_id': sid, 'base_url': base, 'link': full, 'discovered_via': hub})

        # Pass 3: sitemap fallback for JS-heavy pages (BE/AG/LU/ZH)
        for sm in SITEMAP_SEEDS.get(sid, []):
            for full in sitemap_urls(sm):
                if not SITEMAP_HINT.search(full):
                    continue
                if not allowed(sid, full):
                    continue
                if not looks_current_enough(full):
                    continue
                if BLOCK.search(full):
                    continue
                key = (sid, full)
                if key in seen:
                    continue
                seen.add(key)
                rows.append({'source_id': sid, 'base_url': base, 'link': full, 'discovered_via': sm, 'source': 'sitemap'})

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
