#!/usr/bin/env python3
import json
import re
from html import unescape
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'articles.police.lu.archive.firequeue.v1.jsonl'
OUT = ROOT / 'data' / 'stallbraende' / 'articles.police.lu.archive.firequeue.filtered.v1.jsonl'

KEEP = re.compile(
    r'(stall|scheune|scheunen|landwirtschaft|bauernhof|oekonomiegebaeude|ökonomiegebäude|tierstall|tierhaltung|'
    r'schweinestall|rinderstall|kuhstall|huehnerstall|hühnerstall|pferdestall|geflügelstall|heu|heustock|miststock|'
    r'verendet|tier[e]?)',
    re.I,
)

FIRE = re.compile(r'(brand|feuer|brennt|rauch|explosion|vollbrand|schwelbrand)', re.I)

DROP = re.compile(
    r'(wohnhaus|mehrfamilienhaus|wohnungsbrand|zimmerbrand|balkonbrand|auto|motorrad|lastwagen|lieferwagen|'
    r'kollision|frontalkollision|selbstunfall|kutschenunfall|einbrecher|gef[aä]ngnis|zeugenaufruf|elektrobrand.*wohnung)',
    re.I,
)


def year_from_url(url: str):
    try:
        qs = parse_qs(urlparse(url).query)
        y = int((qs.get('year') or [''])[0])
        return y
    except Exception:
        return None


def main():
    rows = []
    total = 0

    for line in INP.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        total += 1
        r = json.loads(line)
        title = unescape((r.get('title') or '').strip())
        snippet = unescape((r.get('snippet') or '').strip())
        hay = f'{title} {snippet}'

        if DROP.search(hay):
            continue
        if not FIRE.search(hay):
            continue
        if not KEEP.search(hay):
            continue

        y = year_from_url(r.get('url', ''))
        r['title'] = title
        r['candidate_reason'] = 'lu_archive_firequeue_filtered_v1'
        r['year'] = y
        r['historical'] = bool(y and y < 2020)
        rows.append(r)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    print(f'input rows: {total}')
    print(f'filtered rows: {len(rows)} -> {OUT}')
    years = sorted({r.get('year') for r in rows if r.get('year')})
    if years:
        print(f'year range: {years[0]}-{years[-1]}')
    for r in rows[:20]:
        print('-', r.get('title'))


if __name__ == '__main__':
    main()
