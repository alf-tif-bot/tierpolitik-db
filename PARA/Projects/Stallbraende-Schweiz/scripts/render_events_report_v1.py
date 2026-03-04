#!/usr/bin/env python3
import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'events.table.v1.json'
OUT = ROOT / 'docs' / 'EVENTS-REPORT.v1.md'

rows = json.loads(INP.read_text(encoding='utf-8'))

by_canton = {}
for r in rows:
    c = r.get('canton') or 'UN'
    by_canton[c] = by_canton.get(c, 0) + 1

lines = []
lines.append('# Stallbrände Schweiz — Events Report v1')
lines.append('')
lines.append(f'_Generated: {datetime.utcnow().isoformat()}Z_')
lines.append('')
lines.append(f'- Kandidaten total: **{len(rows)}**')
lines.append(f"- Kantone: {', '.join(f'{k}({v})' for k,v in sorted(by_canton.items()))}")
lines.append('')
lines.append('## Ereignisliste')
lines.append('')

for i, r in enumerate(rows, 1):
    animals = ', '.join(r.get('animals') or []) or 'n/a'
    counts = r.get('counts') or []
    count_txt = '; '.join(f"{c['count']} {c['animal']}" for c in counts) if counts else 'n/a'
    lines.append(f"{i}. **{r.get('title','(ohne Titel)')}**")
    lines.append(f"   - Kanton: {r.get('canton') or 'n/a'}")
    lines.append(f"   - Tiere: {animals}")
    lines.append(f"   - Mengen: {count_txt}")
    lines.append(f"   - Confidence: {r.get('confidence')}")
    lines.append(f"   - Link: {r.get('url')}")
    lines.append('')

OUT.write_text('\n'.join(lines), encoding='utf-8')
print(f'wrote report -> {OUT}')
