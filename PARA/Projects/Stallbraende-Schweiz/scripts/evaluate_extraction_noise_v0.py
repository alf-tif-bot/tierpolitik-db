#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INP=ROOT/'data'/'stallbraende'/'articles.raw.v0.jsonl'
OUT=ROOT/'data'/'stallbraende'/'extraction-noise-report.v0.md'

NAV_NOISE=re.compile(r'(newsletter|impressum|datenschutz|nach oben|kontakt|rss|navigation|skip to content|direkt zum inhalt)', re.I)
RELATED_NOISE=re.compile(r'(weitere meldungen|mehr zum thema|ähnliche artikel|related|weitere artikel)', re.I)

rows=[json.loads(l) for l in INP.read_text(encoding='utf-8').splitlines() if l.strip()]
issues=[]
for r in rows:
    sn=(r.get('snippet') or '')
    title=(r.get('title') or '')
    noise_hits=0
    if NAV_NOISE.search(sn): noise_hits+=1
    if RELATED_NOISE.search(sn): noise_hits+=1
    # crude duplication signal
    toks=re.findall(r'\w+', sn.lower())
    uniq=len(set(toks)) if toks else 0
    rep=(len(toks)-uniq)/len(toks) if toks else 0
    noisy=(noise_hits>0 or rep>0.55)
    if noisy:
        issues.append((r.get('source_id'), title[:100], rep, noise_hits, r.get('url')))

lines=['# Extraction Noise Report v0','',f'- total articles: {len(rows)}',f'- flagged noisy snippets: {len(issues)}','']
lines.append('## Flagged samples')
for sid,title,rep,noise,url in issues[:20]:
    lines.append(f'- `{sid}` rep={rep:.2f} noise_hits={noise}')
    lines.append(f'  - title: {title}')
    lines.append(f'  - url: {url}')

OUT.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('wrote',OUT)
print('flagged',len(issues),'/',len(rows))
