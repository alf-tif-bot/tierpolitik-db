#!/usr/bin/env bash
set -euo pipefail

WORKDIR="/Users/alf/.openclaw/workspace"
OUTDIR="$WORKDIR/content-factory/runs"
mkdir -p "$OUTDIR"

DATE_UTC="$(date -u +%F)"
TS_UTC="$(date -u +%FT%TZ)"
OUT_MD="$OUTDIR/${DATE_UTC}.md"
TMP_JSON="$(mktemp)"
RANKING_JSON="$WORKDIR/content-factory/sources-ranking.json"

# Learn from vote history before each run (safe no-op if no votes)
python3 "$WORKDIR/scripts/content-factory-rank-learn.py" >/dev/null 2>&1 || true

# Lean source set
FEEDS=(
  "https://news.google.com/rss/search?q=tierschutz+OR+tierrechte+OR+animal+welfare&hl=de&gl=CH&ceid=CH:de"
  "https://news.google.com/rss/search?q=ngo+fundraising+animal&hl=en-US&gl=US&ceid=US:en"
  "https://news.google.com/rss/search?q=animal+campaign+ngo&hl=en-US&gl=US&ceid=US:en"
  "https://news.google.com/rss/search?q=vegan+recipe&hl=en-US&gl=US&ceid=US:en"
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCupvZG-5ko_eiXAupbDfxWw"
)

python3 - "$TMP_JSON" "$RANKING_JSON" "${FEEDS[@]}" <<'PY'
import sys, json, re, html, urllib.request, xml.etree.ElementTree as ET
from urllib.parse import urlparse

out_path, ranking_path = sys.argv[1], sys.argv[2]
feeds = sys.argv[3:]

rank_weight = {'A': 30, 'B': 15, 'C': 0}
ranking = {}
try:
    cfg = json.load(open(ranking_path, encoding='utf-8'))
    for k, v in cfg.items():
        ranking[k.lower().strip()] = str(v).upper().strip()
except Exception:
    pass

items = []

def pick(item, *names):
    for n in names:
        el = item.find(n)
        if el is not None and (el.text or '').strip():
            return el.text.strip()
    return ""

def detect_source(title, link):
    dom = urlparse(link).netloc.lower().strip()
    source_hint = title.rsplit(' - ', 1)[-1].strip() if ' - ' in title else ''
    if dom.endswith('news.google.com') and source_hint:
        return source_hint
    return source_hint or dom or 'unknown'

for url in feeds:
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = r.read()
        root = ET.fromstring(data)
    except Exception:
        continue

    for it in root.findall('.//item'):
        title = html.unescape(pick(it, 'title'))
        link = pick(it, 'link')
        desc = html.unescape(pick(it, 'description'))
        items.append({"title": title, "link": link, "summary": re.sub('<[^<]+?>', ' ', desc)})

    ns = {'a':'http://www.w3.org/2005/Atom'}
    for it in root.findall('.//a:entry', ns):
        title = html.unescape(pick(it, '{http://www.w3.org/2005/Atom}title'))
        link_el = it.find('{http://www.w3.org/2005/Atom}link')
        link = link_el.attrib.get('href','') if link_el is not None else ''
        summ = pick(it, '{http://www.w3.org/2005/Atom}summary')
        items.append({"title": title, "link": link, "summary": summ})

seen, clean = set(), []
for it in items:
    key = (it.get('link') or '')[:300]
    if not key or key in seen:
        continue
    seen.add(key)

    title = (it.get('title') or '').strip()
    source = detect_source(title, it.get('link') or '')
    txt = (title + ' ' + (it.get('summary') or '')).lower()

    cat, route = 'allgemein', 'NL'
    if any(k in txt for k in ['fundraising','spenden','donation','donor','crowdfunding','charity']):
        cat, route = 'fundraising', 'FR'
    elif any(k in txt for k in ['campaign','kampagne','petition','mobilization','mobilisierung']):
        cat, route = 'kampagne', 'Kampagne'
    elif any(k in txt for k in ['motion','interpellation','postulat','parlament','gesetz','policy','regulation']):
        cat, route = 'politik', 'Vorstoss'
    elif any(k in txt for k in ['skandal','missstand','abuse','investigation','scandal']):
        cat, route = 'missstand', 'MM'
    elif any(k in txt for k in ['youtube.com','video','clip']):
        cat, route = 'video', 'NL'
    elif any(k in txt for k in ['vegan recipe','rezept','plant-based recipe']):
        cat, route = 'rezept', 'NL'

    grade = ranking.get(source.lower(), 'B')
    score = rank_weight.get(grade, 15)
    clean.append({**it, 'source': source, 'grade': grade, 'sourceScore': score, 'category': cat, 'route': route})

limits = [('politik',2), ('missstand',2), ('fundraising',2), ('kampagne',2), ('video',1), ('rezept',1)]
selected = []
for cat, lim in limits:
    rows = sorted([x for x in clean if x['category'] == cat], key=lambda r: r['sourceScore'], reverse=True)[:lim]
    selected.extend(rows)

if len(selected) < 10:
    leftovers = [x for x in sorted(clean, key=lambda r: r['sourceScore'], reverse=True) if x not in selected]
    selected.extend(leftovers[:10-len(selected)])

json.dump(selected[:10], open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
PY

python3 - "$TMP_JSON" "$OUT_MD" "$TS_UTC" "$WORKDIR" <<'PY'
import sys, json, re, os

src, out_md, ts, workdir = sys.argv[1:5]
rows = json.load(open(src, encoding='utf-8'))

with open(out_md, 'w', encoding='utf-8') as f:
    f.write(f"# Daily Braindump ({ts})\n\n")
    f.write("Max 10 Items. Poll-Optionen: MM / Vorstoss / NL / FR / Kampagne / Parken / Irrelevant\n\n")
    for i, r in enumerate(rows, 1):
        title = (r.get('title') or '').strip() or 'Ohne Titel'
        link = (r.get('link') or '').strip()
        cat = r.get('category','allgemein')
        route = r.get('route','NL')
        source = r.get('source','unknown')
        grade = r.get('grade','B')
        summary = (r.get('summary') or '').strip().replace('\n',' ')
        summary = (summary[:220] + '...') if len(summary) > 223 else summary
        f.write(f"## {i}) {title}\n")
        f.write(f"- Quelle: {source} (Grade {grade})\n")
        f.write(f"- Kategorie: {cat}\n")
        f.write(f"- Vorschlag: {route}\n")
        if summary:
            f.write(f"- Warum relevant: {summary}\n")
        f.write(f"- Link: {link}\n\n")

base = os.path.join(workdir, 'PARA', 'Resources', 'Content-Factory', 'Quellen')
items_dir = os.path.join(workdir, 'PARA', 'Resources', 'Content-Factory', 'Items')
os.makedirs(base, exist_ok=True)
os.makedirs(items_dir, exist_ok=True)
index_path = os.path.join(base, 'Quellen-Index (Content Factory).md')

def safe_name(s: str) -> str:
    s = re.sub(r'[\\/:*?"<>|]', '-', s).strip()
    s = re.sub(r'\s+', ' ', s)
    return s[:120] or 'Unbenannt'

by_source = {}
for r in rows:
    src = (r.get('source') or 'Unknown Source').strip()
    by_source.setdefault(src, []).append(r)

index_lines = ['# Quellen-Index (Content Factory)', '', 'Ablage für wiederkehrende Quellen inkl. Tags und Wiki-Links.', '']
for source in sorted(by_source.keys(), key=lambda x: x.lower()):
    entries = by_source[source]
    note_name = safe_name(source)
    note_path = os.path.join(base, f"{note_name}.md")
    cats = sorted(set((x.get('category') or 'allgemein') for x in entries))
    routes = sorted(set((x.get('route') or 'NL') for x in entries))
    grades = sorted(set((x.get('grade') or 'B') for x in entries))

    lines = [
        f"# {note_name}",
        '',
        f"- Source: `{source}`",
        f"- Grade: `{', '.join(grades)}`",
        f"- Tags: {' '.join('#quelle/' + c for c in cats)} {' '.join('#route/' + r.lower() for r in routes)} #content-factory",
        '- Verlinkungen: [[Content Factory]] [[Quellen-Index (Content Factory)]]',
        '',
        '## Letzte Funde',
        ''
    ]

    for it in entries[:10]:
        title = safe_name((it.get('title') or 'Ohne Titel').strip())
        link = (it.get('link') or '').strip()
        cat = it.get('category') or 'allgemein'
        route = it.get('route') or 'NL'
        lines.append(f"- [[{title}]] · `{cat}` · `{route}`")

        item_note = [
            f"# {title}",
            '',
            f"- Link: {link}",
            f"- Quelle: [[{note_name}]]",
            f"- Kategorie: `{cat}`",
            f"- Route: `{route}`",
            f"- Grade: `{it.get('grade','B')}`",
            '',
            '## Notiz',
            ''
        ]
        with open(os.path.join(items_dir, f"{title}.md"), 'w', encoding='utf-8') as inf:
            inf.write('\n'.join(item_note))

    with open(note_path, 'w', encoding='utf-8') as nf:
        nf.write('\n'.join(lines).rstrip() + '\n')

    index_lines.append(f"- [[{note_name}]] · Grade: {', '.join(grades)} · Kategorien: {', '.join(cats)}")

with open(index_path, 'w', encoding='utf-8') as idx:
    idx.write('\n'.join(index_lines).rstrip() + '\n')

print(out_md)
print(index_path)
PY

rm -f "$TMP_JSON"
echo "Crawler run complete: $OUT_MD"
