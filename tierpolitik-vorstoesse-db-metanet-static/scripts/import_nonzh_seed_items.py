#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT.parent / 'projects' / 'tierpolitik-db' / 'data' / 'crawler-v2-collect.json'

ANIMAL_RE = re.compile(r"\b(tierschutz|tierwohl|tierversuch\w*|versuchstier\w*|massentierhaltung|nutztiere?\w*|schlachthof\w*|schlacht\w*|wildtier\w*|jagd\w*|wolf\w*|zoo\w*|pelz\w*|foie\s?gras|stopfleber|gefluegel\w*|huhn\w*|schwein\w*|fuchsjagd\w*|vogel\w*)\b", re.I)


def upsert_source(cur, key, name, level, canton, base_url, list_url):
    cur.execute(
        """
        insert into politics_monitor.pm_sources
        (source_key,name,level,country,canton,parser_type,base_url,list_url,is_active,run_interval_minutes)
        values (%s,%s,%s,'CH',%s,'html_list',%s,%s,true,1440)
        on conflict (source_key) do update set updated_at=now()
        returning id
        """,
        (key, name, level, canton, base_url, list_url),
    )
    return cur.fetchone()[0]


def main():
    load_dotenv(ROOT / '.env')
    db = os.environ.get('DATABASE_URL')
    if not db:
        raise SystemExit('DATABASE_URL fehlt')

    items = json.loads(LEGACY.read_text(encoding='utf-8')).get('items', [])

    with psycopg.connect(db) as conn, conn.cursor() as cur:
        source_map = {}
        source_map['ch-be-legacy-rss'] = upsert_source(
            cur,
            'ch-be-legacy-rss',
            'Kanton Bern – Legacy RSS (verifiziert)',
            'kanton',
            'BE',
            'https://www.gr.be.ch',
            'https://www.gr.be.ch/de/start/geschaefte/geschaeftssuche',
        )
        source_map['ch-bund-legacy-curated'] = upsert_source(
            cur,
            'ch-bund-legacy-curated',
            'Bund – Legacy Curated (Curia Links)',
            'bund',
            None,
            'https://www.parlament.ch',
            'https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista',
        )

        ins = upd = kept = 0
        for it in items:
            sid = it.get('sourceId') or ''
            title = (it.get('title') or '').strip()
            summary = (it.get('summary') or '').strip()
            url = (it.get('sourceUrl') or '').strip()
            ext = str(it.get('externalId') or '').strip()
            text = f"{title} {summary}"

            target_key = None
            if sid == 'ch-cantonal-be-rss-v2' and 'gr.be.ch' in url:
                target_key = 'ch-be-legacy-rss'
            elif sid == 'ch-parliament-affairs-v2' and 'parlament.ch' in url:
                target_key = 'ch-bund-legacy-curated'

            if not target_key:
                continue
            if not ext or not url:
                continue
            if not ANIMAL_RE.search(text):
                continue

            source_id = source_map[target_key]
            cur.execute(
                """
                insert into politics_monitor.pm_items
                (source_id, external_id, title, body, item_type, status, canton, source_url, first_seen_at, last_seen_at, updated_at, language, review_status, home_visible)
                values (%s,%s,%s,%s,'Vorstoss',%s,%s,%s,now(),now(),now(),'de','queued',true)
                on conflict (source_id, external_id)
                do update set
                  title=excluded.title,
                  body=excluded.body,
                  status=excluded.status,
                  source_url=excluded.source_url,
                  last_seen_at=now(),
                  updated_at=now(),
                  home_visible=true
                """,
                (source_id, ext, title, summary or None, it.get('status') or 'new', 'BE' if target_key=='ch-be-legacy-rss' else None, url),
            )
            if cur.rowcount == 1:
                ins += 1
            else:
                upd += 1
            kept += 1

        conn.commit()

    print(f'kept={kept} inserted={ins} updated={upd}')


if __name__ == '__main__':
    main()
