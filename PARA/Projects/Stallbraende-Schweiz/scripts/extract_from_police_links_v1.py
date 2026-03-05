#!/usr/bin/env python3
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'links.police.v1.jsonl'
OUT = ROOT / 'data' / 'stallbraende' / 'articles.police.v1.jsonl'
OUT_REVIEW = ROOT / 'data' / 'stallbraende' / 'articles.police.review.v1.jsonl'

FIRE_ONLY = re.compile(r'(brand in|brand eines|brand auf|feuerwehreinsatz|brennt|rauchentwicklung|in flammen|stallbrand|scheunenbrand)', re.I)
NON_FIRE = re.compile(r'(kollision|unfall|frontalkollision|selbstunfall|zeugenaufruf|verkehrsunfall)', re.I)
FARM_OBJECT = re.compile(r'(stall|scheune|landwirtschaft|bauernhof|oekonomiegebaeude|ökonomiegebäude|tierstall)', re.I)

KEYWORD = re.compile(
    r'(stallbrand|stall\s*brand|brand.*stall|huehnerstall|h\u00fchnerstall|schweinestall|rinderstall|kuhstall|viehstall|'
    r'scheunenbrand|brand.*scheune|oekonomiegebaeude|\xF6konomiegeb[aä]ude|landwirtschaftsbetrieb|landwirtschaftsgeb[aä]ude|'
    r'bauernhof.*brand|heustock|heu.*brand|miststock|tierstall|tierhaltung|'
    r'masth\u00fchner|masthuehner|ferkel|k\u00e4lber|kaelber|legehennen)',
    re.I,
)
TITLE_RE = re.compile(r'<title[^>]*>(.*?)</title>', re.I | re.S)
ARCHIVE_BLOCK = re.compile(r'(archiv medienmitteilungen|/archiv_|/archiv/|2004\s*-\s*2015)', re.I)


def fetch(url: str) -> str:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 StallbraendeMonitor/0.5'})
    return urlopen(req, timeout=25).read().decode('utf-8', 'ignore')


def clean(html: str) -> str:
    html = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.I)
    html = re.sub(r'<style[\s\S]*?</style>', ' ', html, flags=re.I)
    txt = re.sub(r'<[^>]+>', ' ', html)
    return re.sub(r'\s+', ' ', txt).strip()


def main():
    links = [json.loads(l) for l in INP.read_text(encoding='utf-8').splitlines() if l.strip()]
    rows = []
    review_rows = []
    now = datetime.now(timezone.utc).isoformat()

    for rec in links:
      url = rec.get('link')
      if not url:
        continue
      if ARCHIVE_BLOCK.search(url):
        continue
      try:
        html = fetch(url)
      except Exception as e:
        rows.append({'source_id': rec.get('source_id'), 'url': url, 'error': str(e), 'fetched_at': now})
        continue

      m = TITLE_RE.search(html)
      title = re.sub(r'\s+', ' ', m.group(1)).strip() if m else ''
      if ARCHIVE_BLOCK.search(title):
        continue
      txt = clean(html)
      hay = title + ' ' + txt
      kw = bool(KEYWORD.search(hay))
      fire = bool(FIRE_ONLY.search(hay))
      if kw:
        rows.append({
          'source_id': rec.get('source_id'),
          'url': url,
          'title': title,
          'snippet': txt[:900],
          'fetched_at': now,
          'candidate_reason': 'police_keyword_match_v1',
        })
        continue

      if fire:
        title_l = (title or '').lower()
        if NON_FIRE.search(title_l) and not FIRE_ONLY.search(title_l):
          continue
        if not FARM_OBJECT.search(hay):
          continue
        review_rows.append({
          'source_id': rec.get('source_id'),
          'url': url,
          'title': title,
          'snippet': txt[:900],
          'fetched_at': now,
          'candidate_reason': 'police_fire_only_review_v1',
          'candidate_tier': 'review',
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', encoding='utf-8') as f:
      for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

    with OUT_REVIEW.open('w', encoding='utf-8') as f:
      for r in review_rows:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

    print(f'wrote {len(rows)} police article candidates -> {OUT}')
    print(f'wrote {len(review_rows)} police review-tier items -> {OUT_REVIEW}')
    for r in (rows[:10] + review_rows[:10]):
      print('-', r.get('source_id'), r.get('url'), r.get('candidate_reason'))


if __name__ == '__main__':
    main()
