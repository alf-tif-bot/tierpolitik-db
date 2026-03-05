#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data'/'stallbraende'/'events.raw.v0.jsonl'
OUT=ROOT/'data'/'stallbraende'/'seed-fetch-report.v0.md'

rows=[json.loads(l) for l in RAW.read_text(encoding='utf-8').splitlines() if l.strip()]
ok=[r for r in rows if r.get('html_path')]
fail=[r for r in rows if not r.get('html_path')]

lines=[]
lines.append('# Seed Fetch Report v0')
lines.append('')
lines.append(f'- total sources: {len(rows)}')
lines.append(f'- html snapshots ok: {len(ok)}')
lines.append(f'- failed/no-html: {len(fail)}')
lines.append('')
if fail:
    lines.append('## Failed sources')
    for r in fail:
        lines.append(f"- `{r.get('source_id')}` | {r.get('source_url')} | error: {r.get('snippet')}")
    lines.append('')
if ok:
    lines.append('## OK sources')
    for r in ok:
        lines.append(f"- `{r.get('source_id')}` | {r.get('source_url')} | status={r.get('http_status')}")

OUT.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(f'wrote {OUT}')
