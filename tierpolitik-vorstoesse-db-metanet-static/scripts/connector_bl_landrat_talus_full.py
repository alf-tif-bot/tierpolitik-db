#!/usr/bin/env python3
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import psycopg
from dotenv import load_dotenv

SOURCE_KEY = 'ch-bl-landrat-talus'
BASE_URL = 'https://baselland.talus.ch/de/politik/cdws/geschaefte_data.php'

ROW_RE = re.compile(r'<tr[^>]*>(.*?)</tr>', re.I | re.S)
GID_RE = re.compile(r'geschaeft\.php\?gid=([0-9a-f]{32})', re.I)
DATE_RE = re.compile(r'\b(\d{2}\.\d{2}\.\d{4})\b')
LAUF_RE = re.compile(r'\b(\d{4}/\d+)\b')
TAG_RE = re.compile(r'<[^>]+>')
SPACE_RE = re.compile(r'\s+')


def clean_html(s: str) -> str:
    return SPACE_RE.sub(' ', unescape(TAG_RE.sub(' ', s))).strip()


def parse_submitted_at(date_text: str | None):
    if not date_text:
        return None
    try:
        return datetime.strptime(date_text, '%d.%m.%Y').date()
    except Exception:
        return None


def fetch_html():
    params = {k: '' for k in ['volltext', 'number', 'title', 'typ', 'vorstoss', 'year', 'author', 'partei', 'state', 'board', 'committee', 'pendent', 'due']}
    url = BASE_URL + '?' + urlencode(params)
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 TierpolitikMonitor/1.0'})
    return urlopen(req, timeout=180).read().decode('utf-8', 'ignore')


def parse_items(html: str):
    out = []
    seen = set()

    for row_html in ROW_RE.findall(html):
        gids = GID_RE.findall(row_html)
        if not gids:
            continue
        gid = gids[0].lower()
        if gid in seen:
            continue
        seen.add(gid)

        txt = clean_html(row_html)
        if not txt:
            continue
        m_date = DATE_RE.search(txt)
        m_lauf = LAUF_RE.search(txt)
        date_text = m_date.group(1) if m_date else None
        lauf = m_lauf.group(1) if m_lauf else None

        title = txt
        if date_text:
            title = title.replace(date_text, '', 1).strip()
        if lauf:
            title = title.replace(lauf, '', 1).strip()
        if len(title) < 6:
            continue

        out.append({
            'external_id': gid,
            'laufnummer': lauf,
            'date_text': date_text,
            'title': title,
            'url': f'https://baselland.talus.ch/de/politik/cdws/geschaeft.php?gid={gid}',
        })

    return out


def main():
    load_dotenv('.env')
    db = os.environ.get('DATABASE_URL')
    if not db:
        raise SystemExit('DATABASE_URL fehlt in .env')

    max_rows = int(os.environ.get('TPM_BL_MAX_ROWS', '1200'))

    html = fetch_html()
    items = parse_items(html)[:max_rows]

    with psycopg.connect(db) as conn:
        with conn.cursor() as cur:
            cur.execute('select id from politics_monitor.pm_sources where source_key=%s', (SOURCE_KEY,))
            row = cur.fetchone()
            if not row:
                raise SystemExit(f'Source {SOURCE_KEY} fehlt; zuerst seed_sources.py ausführen')
            source_id = row[0]

            cur.execute("insert into politics_monitor.pm_runs (source_id,status,started_at) values (%s,'running',now()) returning id", (source_id,))
            run_id = cur.fetchone()[0]

        fetched = inserted = updated = 0
        now = datetime.now(timezone.utc)
        try:
            with conn.cursor() as cur:
                for it in items:
                    fetched += 1
                    ext = it['external_id']
                    submitted_at = parse_submitted_at(it.get('date_text'))
                    body_bits = []
                    if it.get('laufnummer'):
                        body_bits.append(f"Laufnummer: {it['laufnummer']}")
                    if it.get('date_text'):
                        body_bits.append(f"Datum: {it['date_text']}")
                    body = '\n'.join(body_bits) if body_bits else None

                    raw_payload = json.dumps(it, ensure_ascii=False)
                    raw_hash = hashlib.sha256(raw_payload.encode('utf-8')).hexdigest()
                    cur.execute(
                        """
                        insert into politics_monitor.pm_items_raw
                        (run_id, source_id, external_id, fetched_at, raw_payload, raw_hash)
                        values (%s,%s,%s,%s,%s::jsonb,%s)
                        """,
                        (run_id, source_id, ext, now, raw_payload, raw_hash),
                    )

                    cur.execute(
                        """
                        insert into politics_monitor.pm_items
                        (source_id, external_id, title, body, item_type, status, submitted_at, canton, source_url, first_seen_at, last_seen_at, updated_at, language)
                        values (%s,%s,%s,%s,'Vorstoss',null,%s,'BL',%s,now(),now(),now(),'de')
                        on conflict (source_id, external_id)
                        do update set
                          title=excluded.title,
                          body=excluded.body,
                          item_type=excluded.item_type,
                          status=excluded.status,
                          submitted_at=excluded.submitted_at,
                          canton='BL',
                          source_url=excluded.source_url,
                          last_seen_at=now(),
                          updated_at=now()
                        """,
                        (source_id, ext, it['title'], body, submitted_at, it['url']),
                    )
                    if cur.rowcount == 1:
                        inserted += 1
                    else:
                        updated += 1

                cur.execute(
                    "update politics_monitor.pm_runs set status='ok', finished_at=now(), items_fetched=%s, items_inserted=%s, items_updated=%s, items_failed=0 where id=%s",
                    (fetched, inserted, updated, run_id),
                )
            conn.commit()
            print(f'run_id={run_id} ok fetched={fetched} inserted={inserted} updated={updated}')
        except Exception as e:
            with conn.cursor() as cur:
                cur.execute("update politics_monitor.pm_runs set status='error', finished_at=now(), error_message=%s where id=%s", (str(e)[:2000], run_id))
            conn.commit()
            raise


if __name__ == '__main__':
    main()
