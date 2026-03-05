#!/usr/bin/env python3
import json
import re
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'articles.merged.v1.jsonl'
OUT = ROOT / 'data' / 'stallbraende' / 'events.table.v1.json'

CANTON_RE = re.compile(r'\b([A-Za-zÄÖÜäöü\-]+)\s+([A-Z]{2})\b')
URL_CANTON_RE = re.compile(r'[-_/]([a-z]{2})[-_/]')
ANIMAL_RE = re.compile(r'(masthuehner|masthühner|legehennen|ferkel|kaelber|kälber|schweine|rinder|kuehe|kühe)', re.I)
COUNT_RE = re.compile(r"(\d{1,3}(?:(?:['’]|&#x27;|\s)\d{3})*|\d+)\s+(masthuehner|masthühner|legehennen|ferkel|kaelber|kälber|schweine|rinder|kuehe|kühe)", re.I)

rows=[]
for line in INP.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    r=json.loads(line)
    title=html.unescape((r.get('title') or '').strip())
    url=r.get('url')

    canton=None
    m=CANTON_RE.search(title)
    if m:
        canton=m.group(2)
    if not canton and url:
        um=URL_CANTON_RE.search(url.lower())
        if um:
            maybe=um.group(1).upper()
            if maybe in {'ZH','BE','LU','AG','SH','FR','SZ','GR','TG','SG','SO','BL','BS','AR','AI','GL','ZG','UR','OW','NW','VD','VS','NE','JU','GE','TI'}:
                canton=maybe

    animals=[]
    for a in ANIMAL_RE.findall(title):
        animals.append(a.lower())
    animals=list(dict.fromkeys(animals))

    counts=[]
    for n,a in COUNT_RE.findall(title):
        n=n.replace("'",'').replace('’','').replace('&#x27;','').replace(',', '').replace(' ', '')
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
