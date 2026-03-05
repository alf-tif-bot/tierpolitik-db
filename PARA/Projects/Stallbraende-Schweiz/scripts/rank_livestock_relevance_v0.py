#!/usr/bin/env python3
from __future__ import annotations
import json,re,html
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INP=ROOT/'data'/'stallbraende'/'articles.raw.v0.jsonl'
OUT=ROOT/'data'/'stallbraende'/'articles.scored.v0.jsonl'

POS_PATTERNS=[
 (r'\bstallbrand\b',4,'stallbrand'),
 (r'\bstall\b',2,'stall'),
 (r'\bscheune\b',2,'scheune'),
 (r'\blandwirtschaft(lich|sbetrieb)?\b',2,'landwirtschaft'),
 (r'\b(kuh\w*|kälber\w*|kalb\w*|rinder\w*|schwein\w*|huhn\w*|hühner\w*|geflügel\w*|pferd\w*|tiere?)\b',3,'tierart'),
 (r'\bmasth[üu]hner\b',4,'masthuehner'),
 (r'\bverenden\b',2,'verenden'),
]
NEG_PATTERNS=[
 (r'\bwohnungsbrand\b',-3,'wohnungsbrand'),
 (r'\bauto\b|\bfahrzeug\b|\bmotorrad\b',-2,'verkehr'),
 (r'\bstadtrat\b|\bwahlen\b|\bwasserleitung\b',-2,'stadtpolitik'),
]


def has_proximity_livestock_incident(txt:str)->bool:
    livestock=r'(stall|kälber\w*|kalb\w*|rinder\w*|schwein\w*|huhn\w*|hühner\w*|geflügel\w*|masthühner\w*|legehennen\w*|kuh\w*|tiere?)'
    incident=r'(brand|feuer|verenden|verstorben|tot|todesopfer|stallbrand|stallfeuer)'
    parts=re.split(r'[\.!?;:\n]+', txt)
    for s in parts:
        if re.search(livestock,s,re.I) and re.search(incident,s,re.I):
            return True
    toks=re.findall(r'\w+',txt.lower())
    for i,t in enumerate(toks):
        if re.fullmatch(livestock,t,re.I):
            lo=max(0,i-12); hi=min(len(toks),i+13)
            win=' '.join(toks[lo:hi])
            if re.search(incident,win,re.I):
                return True
    return False


rows=[]
for line in INP.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    r=json.loads(line)
    txt_raw=' '.join([(r.get('title') or ''),(r.get('snippet') or '')])
    txt=html.unescape(txt_raw).lower()
    score=0
    hits=[]
    for pat,pts,label in POS_PATTERNS:
        if re.search(pat,txt,re.I):
            score+=pts; hits.append(label)
    for pat,pts,label in NEG_PATTERNS:
        if re.search(pat,txt,re.I):
            score+=pts; hits.append(label)

    has_fire=bool(re.search(r'\b(brand|feuer)\b',txt,re.I))
    has_livestock=bool(re.search(r'\b(stall|kälber\w*|kalb\w*|rinder\w*|schwein\w*|huhn\w*|hühner\w*|geflügel\w*|masthühner\w*|legehennen\w*|tiere)\b',txt,re.I))
    if has_fire and has_livestock:
        score += 4
        hits.append('combo_fire_livestock')

    has_livestock_signal=bool(re.search(r'\b(stall|kälber\w*|kalb\w*|rinder\w*|schwein\w*|huhn\w*|hühner\w*|geflügel\w*|masthühner\w*|legehennen\w*|kuh\w*|tiere?)\b',txt,re.I))
    if not has_livestock_signal and score>2:
        score=2
        hits.append('livestock_gate_cap')

    prox=has_proximity_livestock_incident(txt)
    if score>=6 and not prox:
        score=4
        hits.append('proximity_guard_cap')

    # title livestock gate: avoid high from body leakage when title has no livestock signal
    title_txt=html.unescape(r.get('title') or '').lower()
    title_livestock=bool(re.search(r'\b(stall|kälber\w*|kalb\w*|rinder\w*|schwein\w*|huhn\w*|hühner\w*|geflügel\w*|masthühner\w*|legehennen\w*|kuh\w*|tiere?)\b',title_txt,re.I))
    if score>=6 and not title_livestock:
        score=4
        hits.append('title_livestock_gate_cap')

    rr=dict(r)
    rr['livestock_score']=score
    rr['livestock_hits']=hits
    rr['livestock_relevance']='high' if score>=6 else ('medium' if score>=3 else 'low')
    rows.append(rr)

with OUT.open('w',encoding='utf-8') as f:
    for r in rows:
        f.write(json.dumps(r,ensure_ascii=False)+'\n')
print('wrote',len(rows),'rows ->',OUT)
print('high',sum(1 for r in rows if r['livestock_relevance']=='high'),'medium',sum(1 for r in rows if r['livestock_relevance']=='medium'))
