#!/usr/bin/env python3
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
INP = ROOT / 'data' / 'stallbraende' / 'articles.police.review.v1.jsonl'
OUT = ROOT / 'docs' / 'POLICE-REVIEW-QUEUE.v1.md'

rows = []
if INP.exists():
    rows = [json.loads(l) for l in INP.read_text(encoding='utf-8').splitlines() if l.strip()]

lines = []
lines.append('# Police Review Queue v1')
lines.append('')
lines.append(f'_Generated: {datetime.now(timezone.utc).isoformat()}_')
lines.append('')
lines.append(f'- Items: **{len(rows)}**')
lines.append('')
lines.append('## Queue')
lines.append('')

for i, r in enumerate(rows, 1):
    lines.append(f"{i}. **{r.get('title') or '(ohne Titel)'}**")
    lines.append(f"   - Source: {r.get('source_id')}")
    lines.append(f"   - Reason: {r.get('candidate_reason')}")
    lines.append(f"   - Tier: {r.get('candidate_tier')}")
    lines.append(f"   - Link: {r.get('url')}")
    lines.append('')

OUT.write_text('\n'.join(lines), encoding='utf-8')
print(f'wrote review queue -> {OUT} ({len(rows)} items)')
