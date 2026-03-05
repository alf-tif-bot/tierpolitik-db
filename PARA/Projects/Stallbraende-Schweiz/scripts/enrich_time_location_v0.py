#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
INP=ROOT/'data'/'stallbraende/articles.scored.v0.jsonl'
OUT=ROOT/'data'/'stallbraende/articles.enriched.v0.jsonl'

CANTON_MAP={
 'zh':'ZH','zürich':'ZH','zurich':'ZH',
 'be':'BE','bern':'BE',
 'ag':'AG','aargau':'AG',
 'lu':'LU','luzern':'LU',
 'fr':'FR','freiburg':'FR',
 'sh':'SH','schaffhausen':'SH',
}

YEAR_PATTERNS=[r'/((?:19|20)\d{2})/', r'\b((?:19|20)\d{2})\b']


def infer_year(text:str,url:str)->int|None:
    for pat in YEAR_PATTERNS:
        m=re.search(pat,url) or re.search(pat,text)
        if m:
            y=int(m.group(1))
            if 1990<=y<=2100:
                return y
    return None


def infer_canton(text:str,url:str)->str|None:
    t=(text+' '+url).lower()
    host=urlparse(url).netloc.lower()

    # 0) source-host priors first for official cantonal sources
    if 'stadt-zuerich' in host:
        return 'ZH'
    if 'police.be.ch' in host:
        return 'BE'
    if 'ag.ch' in host:
        return 'AG'
    if 'polizei.lu.ch' in host:
        return 'LU'

    # generic aggregators: avoid weak token-based canton guessing
    if 'swissfire.ch' in host:
        return None

    # 1) strong short-tag patterns e.g. "Düdingen FR"
    m=re.search(r'\b([a-zäöü]+)\s+(zh|be|ag|lu|fr|sh)\b',t,re.I)
    if m:
        return m.group(2).upper()

    # 2) lexical fallback only if combined with incident context
    incident=bool(re.search(r'\b(brand|feuer|stall|verenden|verstorben|tot|todesopfer)\b',t,re.I))
    if incident:
        for k,v in CANTON_MAP.items():
            if re.search(rf'\b{re.escape(k)}\b',t,re.I):
                return v

    return None

rows=[]
for line in INP.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    r=json.loads(line)
    txt=' '.join([(r.get('title') or ''),(r.get('snippet') or '')])
    url=r.get('url') or ''
    rr=dict(r)
    rr['event_year']=infer_year(txt,url)
    rr['event_canton']=infer_canton(txt,url)
    rows.append(rr)

with OUT.open('w',encoding='utf-8') as f:
    for r in rows:
        f.write(json.dumps(r,ensure_ascii=False)+'\n')

print('wrote',len(rows),'->',OUT)
print('with_year',sum(1 for r in rows if r.get('event_year')),'with_canton',sum(1 for r in rows if r.get('event_canton')))
