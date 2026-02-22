#!/usr/bin/env bash
set -euo pipefail

WORKDIR="/Users/alf/.openclaw/workspace"
OUTDIR="$WORKDIR/content-factory/runs"
mkdir -p "$OUTDIR"

DATE_UTC="$(date -u +%F)"
TS_UTC="$(date -u +%FT%TZ)"
OUT_MD="$OUTDIR/${DATE_UTC}.md"
TMP_JSON="$(mktemp)"

# Lean source set (can be extended later)
FEEDS=(
  "https://news.google.com/rss/search?q=tierschutz+OR+tierrechte+OR+animal+welfare&hl=de&gl=CH&ceid=CH:de"
  "https://news.google.com/rss/search?q=ngo+fundraising+animal&hl=en-US&gl=US&ceid=US:en"
  "https://news.google.com/rss/search?q=animal+campaign+ngo&hl=en-US&gl=US&ceid=US:en"
  "https://news.google.com/rss/search?q=vegan+recipe&hl=en-US&gl=US&ceid=US:en"
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCupvZG-5ko_eiXAupbDfxWw"
)

python3 - "$TMP_JSON" "${FEEDS[@]}" <<'PY'
import sys, json, re, html, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from datetime import datetime, timezone

out_path = sys.argv[1]
feeds = sys.argv[2:]

items = []

def parse_dt(s):
    if not s:
        return None
    for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z"):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    return None

def pick(item, *names):
    for n in names:
        el = item.find(n)
        if el is not None and (el.text or '').strip():
            return el.text.strip()
    return ""

for url in feeds:
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = r.read()
        root = ET.fromstring(data)
    except Exception:
        continue

    # RSS
    for it in root.findall('.//item'):
        title = html.unescape(pick(it, 'title'))
        link = pick(it, 'link')
        desc = html.unescape(pick(it, 'description'))
        pub = pick(it, 'pubDate')
        items.append({"title": title, "link": link, "summary": re.sub('<[^<]+?>', ' ', desc), "published": pub})

    # Atom (e.g. YouTube)
    ns = {'a':'http://www.w3.org/2005/Atom'}
    for it in root.findall('.//a:entry', ns):
        title = html.unescape(pick(it, '{http://www.w3.org/2005/Atom}title'))
        link_el = it.find('{http://www.w3.org/2005/Atom}link')
        link = link_el.attrib.get('href','') if link_el is not None else ''
        summ = pick(it, '{http://www.w3.org/2005/Atom}summary')
        pub = pick(it, '{http://www.w3.org/2005/Atom}published', '{http://www.w3.org/2005/Atom}updated')
        items.append({"title": title, "link": link, "summary": summ, "published": pub})

# dedupe
seen = set()
clean = []
for it in items:
    key = (it.get('link') or '')[:300]
    if not key or key in seen:
        continue
    seen.add(key)
    txt = ((it.get('title') or '') + ' ' + (it.get('summary') or '')).lower()
    cat = 'allgemein'
    route = 'NL'
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

    clean.append({**it, 'category': cat, 'route': route})

# pick lean mix
limits = [('politik',2), ('missstand',2), ('fundraising',2), ('kampagne',2), ('video',1), ('rezept',1)]
selected = []
for cat, lim in limits:
    rows = [x for x in clean if x['category']==cat][:lim]
    selected.extend(rows)

if len(selected) < 10:
    extras = [x for x in clean if x not in selected][:10-len(selected)]
    selected.extend(extras)

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(selected[:10], f, ensure_ascii=False, indent=2)
PY

python3 - "$TMP_JSON" "$OUT_MD" "$TS_UTC" <<'PY'
import sys, json
src, out_md, ts = sys.argv[1:4]
rows = json.load(open(src, encoding='utf-8'))

with open(out_md, 'w', encoding='utf-8') as f:
    f.write(f"# Daily Braindump ({ts})\n\n")
    f.write("Max 10 Items. Poll-Optionen: MM / Vorstoss / NL / FR / Kampagne / Parken / Irrelevant\n\n")
    for i, r in enumerate(rows, 1):
        title = (r.get('title') or '').strip() or 'Ohne Titel'
        link = (r.get('link') or '').strip()
        cat = r.get('category','allgemein')
        route = r.get('route','NL')
        summary = (r.get('summary') or '').strip().replace('\n',' ')
        summary = (summary[:220] + '...') if len(summary) > 223 else summary
        f.write(f"## {i}) {title}\n")
        f.write(f"- Kategorie: {cat}\n")
        f.write(f"- Vorschlag: {route}\n")
        if summary:
            f.write(f"- Warum relevant: {summary}\n")
        f.write(f"- Link: {link}\n\n")

print(out_md)
PY

rm -f "$TMP_JSON"
echo "Crawler run complete: $OUT_MD"
