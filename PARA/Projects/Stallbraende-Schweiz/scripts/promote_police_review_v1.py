#!/usr/bin/env python3
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'articles.police.review.v1.jsonl'
OUT = ROOT / 'data' / 'stallbraende' / 'articles.police.promoted.v1.jsonl'

FARM = re.compile(r'(stall|scheune|landwirtschaft|bauernhof|oekonomiegebaeude|ökonomiegebäude|tierstall|tierhaltung|vieh|rinder|kühe|kuehe|schweine|ferkel|kälber|kaelber|hühner|huehner|legehennen|masthühner|masthuehner)', re.I)
TITLE_RE = re.compile(r'<title[^>]*>(.*?)</title>', re.I | re.S)

def fetch(url: str) -> str:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 StallbraendeMonitor/0.9'})
    return urlopen(req, timeout=25).read().decode('utf-8', 'ignore')

def clean(html: str) -> str:
    html = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.I)
    html = re.sub(r'<style[\s\S]*?</style>', ' ', html, flags=re.I)
    txt = re.sub(r'<[^>]+>', ' ', html)
    return re.sub(r'\s+', ' ', txt).strip()

rows = [json.loads(l) for l in INP.read_text(encoding='utf-8').splitlines() if l.strip()] if INP.exists() else []
promoted = []
for r in rows:
    u = r.get('url')
    if not u:
        continue
    try:
        html = fetch(u)
    except Exception:
        continue
    m = TITLE_RE.search(html)
    title = re.sub(r'\s+', ' ', m.group(1)).strip() if m else (r.get('title') or '')
    txt = clean(html)
    hay = f"{title} {txt[:12000]}"
    hits = sorted(set(h.lower() for h in FARM.findall(hay)))
    if not hits:
        continue
    out = dict(r)
    out['title'] = title
    out['snippet'] = txt[:1200]
    out['candidate_reason'] = 'police_review_promoted_v1'
    out['farm_hits'] = hits
    out['candidate_tier'] = 'promoted'
    promoted.append(out)

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open('w', encoding='utf-8') as f:
    for r in promoted:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

print(f'wrote {len(promoted)} promoted police candidates -> {OUT}')
for r in promoted[:20]:
    print('-', r.get('source_id'), r.get('url'), r.get('farm_hits'))
