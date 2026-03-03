#!/usr/bin/env python3
import json
import os
from datetime import date
from pathlib import Path
import re

import psycopg
from dotenv import load_dotenv

OUT = Path('.netlify/functions/home-data')


def iso_or_today(d):
    if d:
        return d.isoformat()
    return date.today().isoformat()


def infer_business_number(external_id: str, title: str | None, body: str | None, raw_blob: str | None, source_url: str | None) -> str:
    t = (title or '')
    b = (body or '')
    rb = (raw_blob or '')

    # CH Curia style in title: 26.3018 / 22.3980
    m = re.search(r"\b(\d{2}\.\d{4})\b", t)
    if m:
        return m.group(1)

    # CH Curia style in raw JSON payload
    m = re.search(r'"BusinessShortNumber"\s*:\s*"(\d{2}\.\d{4})"', rb)
    if m:
        return m.group(1)

    # ZH/BE style: 2024/123
    m = re.search(r"\b(20\d{2}/\d{1,5})\b", t)
    if m:
        return m.group(1)
    m = re.search(r"\b(20\d{2}/\d{1,5})\b", b)
    if m:
        return m.group(1)

    # ZH XML raw payload: <...GRNr>2020/302</...GRNr>
    m = re.search(r">(20\d{2}/\d{1,5})<", rb)
    if m:
        return m.group(1)

    su = (source_url or '')
    m = re.search(r'[?&]guid=([a-f0-9]{8,40})', su, re.I)
    if m:
        return f"BE-{m.group(1)[:8]}"

    return str(external_id)


def map_type(item_type: str | None) -> str:
    t = (item_type or '').lower()
    if 'motion' in t:
        return 'Motion'
    if 'postulat' in t:
        return 'Postulat'
    if 'anfrage' in t:
        return 'Anfrage'
    if 'initiative' in t:
        return 'Volksinitiative'
    if 'interpell' in t:
        return 'Interpellation'
    if 'weisung' in t:
        return 'Anfrage'
    return 'Anfrage'


def main():
    load_dotenv('.env')
    db = os.environ.get('DATABASE_URL')
    if not db:
        raise SystemExit('DATABASE_URL fehlt')

    limit = int(os.environ.get('TPM_HOME_LIMIT', '800'))

    with psycopg.connect(db) as conn, conn.cursor() as cur:
        cur.execute(
            """
            select i.external_id, i.title, i.body, i.item_type, i.status, i.submitted_at,
                   i.updated_at::date, i.source_url, i.canton, i.municipality,
                   coalesce(c.label,'no') as label, c.reason, s.name as source_name, i.persons,
                   (
                     select coalesce(r.raw_payload->>'xml', r.raw_payload::text)
                     from politics_monitor.pm_items_raw r
                     where r.source_id=i.source_id and r.external_id=i.external_id
                     order by r.fetched_at desc
                     limit 1
                   ) as raw_blob
            from politics_monitor.pm_items i
            join politics_monitor.pm_sources s on s.id = i.source_id
            left join politics_monitor.pm_classification c on c.item_id = i.id
            where i.home_visible = true
              and coalesce(c.label,'no') = 'yes'
            order by i.submitted_at desc nulls last, i.updated_at desc
            limit %s
            """,
            (limit,),
        )
        rows = cur.fetchall()

    out = []
    for r in rows:
        ext, title, body, item_type, status, sub_date, upd_date, url, canton, municipality, label, reason, source_name, persons, raw_blob = r
        submitters = []
        if persons:
            submitters = [{'name': p, 'rolle': 'Einreichend', 'partei': 'Unbekannt'} for p in persons[:8]]
        else:
            submitters = [{'name': source_name or 'Unbekannt', 'rolle': 'Quelle', 'partei': 'Unbekannt'}]

        gnr = infer_business_number(str(ext), title, body, raw_blob, url)
        out.append({
            'id': f'vp-{str(ext).lower()}',
            'titel': title or f'Vorstoss {ext}',
            'typ': map_type(item_type),
            'kurzbeschreibung': (body or title or '')[:700] or 'Kein Beschreibungstext verfügbar.',
            'geschaeftsnummer': gnr,
            'ebene': 'Gemeinde' if municipality else ('Kanton' if canton else 'Bund'),
            'kanton': canton,
            'regionGemeinde': municipality,
            'status': 'Eingereicht',
            'datumEingereicht': iso_or_today(sub_date),
            'datumAktualisiert': iso_or_today(upd_date),
            'themen': ['Tiere', 'Tierpolitik'] if label == 'yes' else ['Tiere (unsicher)'],
            'schlagwoerter': [k for k in ['zoo', 'wildtier', 'schlachthof', 'tierschutz'] if (title or '').lower().find(k) >= 0] or ['tierpolitik'],
            'einreichende': submitters,
            'linkGeschaeft': url,
            'resultate': [],
            'medien': [],
            'metadaten': {
                'sprache': 'de',
                'haltung': 'neutral/unklar' if label == 'unsure' else 'pro-tierschutz',
                'zuletztGeprueftVon': 'Tierpolitik Monitor'
            }
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    print(f'wrote {len(out)} items to {OUT}')


if __name__ == '__main__':
    main()
