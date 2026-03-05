#!/usr/bin/env python3
from __future__ import annotations
import json,re,hashlib
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
INP=ROOT/'data'/'stallbraende'/'links.raw.v0.jsonl'
OUT=ROOT/'data'/'stallbraende'/'articles.raw.v0.jsonl'
SNAP=ROOT/'data'/'stallbraende'/'snapshots.articles.v0'


def fetch(url:str)->tuple[int|None,str|None,str|None]:
    try:
        req=Request(url,headers={"User-Agent":"Mozilla/5.0 StallbraendeMonitor/0.1"})
        with urlopen(req,timeout=20) as r:
            status=getattr(r,'status',None)
            html=r.read().decode('utf-8','ignore')
            return status,html,None
    except Exception as e:
        return None,None,str(e)


def isolate_main_html(html:str, url:str)->str:
    host=urlparse(url).netloc.lower()
    candidates=[]
    # source-aware selectors first
    if '20min.ch' in host:
        candidates += [
            r'<article[^>]*>([\s\S]*?)</article>',
            r'<div[^>]+id=["\']article["\'][^>]*>([\s\S]*?)</div>',
            r'<div[^>]+class=["\'][^"\']*(article|story|content-body)[^"\']*["\'][^>]*>([\s\S]*?)</div>',
        ]
    if 'police.be.ch' in host:
        candidates += [r'<main[^>]*>([\s\S]*?)</main>', r'<article[^>]*>([\s\S]*?)</article>']
    if 'stadt-zuerich.ch' in host:
        candidates += [r'<main[^>]*>([\s\S]*?)</main>', r'<article[^>]*>([\s\S]*?)</article>']

    # generic fallback selectors
    candidates += [
        r'<article[^>]*>([\s\S]*?)</article>',
        r'<main[^>]*>([\s\S]*?)</main>',
        r'<section[^>]+class=["\'][^"\']*(content|article|news|entry|body)[^"\']*["\'][^>]*>([\s\S]*?)</section>',
        r'<div[^>]+class=["\'][^"\']*(content|article|news|entry|body)[^"\']*["\'][^>]*>([\s\S]*?)</div>',
    ]

    for pat in candidates:
        mm=re.search(pat,html,re.I)
        if mm:
            return mm.group(mm.lastindex)
    return html

def text_snippet(html:str, url:str)->tuple[str|None,str|None]:
    m=re.search(r'<title[^>]*>(.*?)</title>',html,re.I|re.S)
    title=re.sub(r'\s+',' ',m.group(1)).strip() if m else None

    src=isolate_main_html(html, url)

    t=re.sub(r'<script[\s\S]*?</script>',' ',src,flags=re.I)
    t=re.sub(r'<style[\s\S]*?</style>',' ',t,flags=re.I)
    t=re.sub(r'<nav[\s\S]*?</nav>',' ',t,flags=re.I)
    t=re.sub(r'<footer[\s\S]*?</footer>',' ',t,flags=re.I)
    t=re.sub(r'<[^>]+>',' ',t)
    t=re.sub(r'\s+',' ',t).strip()

    # lightweight boilerplate suppression (v0)
    noise_patterns=[
        r'Direkt zum Inhalt', r'Skip to content', r'Nach oben',
        r'Impressum', r'Datenschutz', r'Rechtliches',
        r'Newsletter', r'Kontakt', r'Suche', r'Navigation',
        r'RSS-Feed abonnieren', r'Folgen Sie uns', r'Soziale Medien',
        r'Cookie', r'Alle Rechte vorbehalten',
    ]
    for pat in noise_patterns:
        t=re.sub(pat,' ',t,flags=re.I)
    t=re.sub(r'\s+',' ',t).strip()

    return title,(t[:2200] if t else None)

rows=[]
SNAP.mkdir(parents=True,exist_ok=True)
now=datetime.now(timezone.utc).isoformat()
for line in INP.read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    rec=json.loads(line)
    url=rec['url']
    status,html,err=fetch(url)
    title=snippet=html_path=None
    if html:
        title,snippet=text_snippet(html, url)
        digest=hashlib.sha1(html.encode('utf-8','ignore')).hexdigest()[:10]
        host=urlparse(url).netloc.replace(':','_')
        fn=f"{host}__{digest}.html"
        p=SNAP/fn
        p.write_text(html,encoding='utf-8')
        html_path=str(p.relative_to(ROOT))
    rows.append({
        'fetched_at':now,
        'source_id':rec.get('source_id'),
        'source_name':rec.get('source_name'),
        'url':url,
        'http_status':status,
        'title':title,
        'snippet':snippet,
        'html_path':html_path,
        'error':err,
    })

with OUT.open('w',encoding='utf-8') as f:
    for r in rows:
        f.write(json.dumps(r,ensure_ascii=False)+'\n')
print(f'wrote {len(rows)} article rows -> {OUT}')
print('ok_html',sum(1 for r in rows if r['html_path']))
print('errors',sum(1 for r in rows if r['error']))
