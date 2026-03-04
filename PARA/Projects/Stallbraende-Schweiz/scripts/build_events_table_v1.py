#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'articles.filtered.v1.jsonl'
OUT = ROOT / 'data' / 'stallbraende' / 'events.table.v1.json'

CANTON_RE = re.compile(r'\b([a-zäöü]+)\s+([A-Z]{2})\b')
ANIMAL_RE = re.compile(r'(masthuehner|masthühner|legehennen|ferkel|kaelber|kälber|schweine|rinder|kuehe|kühe)', re.I)
COUNT_RE = re.compile(r"(\d{1,3}(?:['’]\d{3})*|\d+)\s+(masthuehner|masthühner|legehennen|ferkel|kaelber|kälber|schweine|rinder|kuehe|kühe)", re.I)

rows=[]
for line in INP.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    r=json.loads(line)
    title=(r.get('title') or '').strip()
    url=r.get('url')

    canton=None
    m=CANTON_RE.search(title)
    if m:
        canton=m.group(2)

    animals=[]
    for a in ANIMAL_RE.findall(title):
        animals.append(a.lower())
    animals=list(dict.fromkeys(animals))

    counts=[]
    for n,a in COUNT_RE.findall(title):
        n=n.replace("'",'').replace('’','')
        try:
            counts.append({'count':int(n),'animal':a.lower()})
        except Exception:
            pass

    rows.append({
        'url': url,
        'title': title,
        'canton': canton,
        'animals': animals,
        'counts': counts,
        'confidence': 'medium' if counts or animals else 'low'
    })

OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'wrote {len(rows)} rows -> {OUT}')
