#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'links.discovered.v1.jsonl'
OUT = ROOT / 'data' / 'stallbraende' / 'links.prioritized.v1.jsonl'

TRUST_BONUS = {
    'ch-be-police-news': 40,
    'ch-zh-police-news': 40,
    'ch-lu-police-news': 40,
    'ch-ag-police-news': 40,
    'ch-srf-search': 25,
    'ch-swissfire': 20,
    'ch-20min-search': 5,
    'ch-nzz-search': 5,
}

BAD_DOMAIN = ('abo.nzz.ch', 'spiele.nzz.ch', 'shop.swissfire.ch')
GOOD_HINTS = ('medien', 'mitteilung', 'news', 'aktuell', 'polizei', 'brand', 'feuer')

rows=[]
for line in INP.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    r=json.loads(line)
    raw_link = r.get('link')
    if not raw_link:
        continue
    link=str(raw_link).lower()
    domain=(r.get('domain') or '').lower()
    sid=r.get('source_id') or ''

    score=TRUST_BONUS.get(sid,0)
    if any(b in domain for b in BAD_DOMAIN):
        score -= 30
    if any(h in link for h in GOOD_HINTS):
        score += 15
    if '/search' in link or '/suche' in link:
        score -= 10

    r['priority_score']=score
    rows.append(r)

rows.sort(key=lambda x: x.get('priority_score',0), reverse=True)

with OUT.open('w',encoding='utf-8') as f:
    for r in rows:
        f.write(json.dumps(r,ensure_ascii=False)+'\n')

print(f'wrote {len(rows)} prioritized links -> {OUT}')
print('top10:')
for r in rows[:10]:
    print(r.get('priority_score'), r.get('source_id'), r.get('link'))
