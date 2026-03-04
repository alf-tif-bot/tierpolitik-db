#!/usr/bin/env python3
import os
import re
from datetime import date

import psycopg
from dotenv import load_dotenv

MONTHS = {
    'januar': 1, 'februar': 2, 'maerz': 3, 'märz': 3, 'april': 4, 'mai': 5, 'juni': 6,
    'juli': 7, 'august': 8, 'september': 9, 'oktober': 10, 'november': 11, 'dezember': 12,
}

RE_NUM = re.compile(r'\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b')
RE_DE = re.compile(r'\b(\d{1,2})\.\s*(januar|februar|maerz|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})\b', re.I)
RE_YEAR = re.compile(r'\b(19\d{2}|20\d{2})\b')


def parse_dt(text: str):
    if not text:
        return None
    m = RE_NUM.search(text)
    if m:
        d, mth, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(y, mth, d)
        except Exception:
            return None
    m = RE_DE.search(text)
    if m:
        d = int(m.group(1))
        mon = MONTHS.get(m.group(2).lower())
        y = int(m.group(3))
        if mon:
            try:
                return date(y, mon, d)
            except Exception:
                return None

    years = [int(y) for y in RE_YEAR.findall(text)]
    years = [y for y in years if 1900 <= y <= 2026]
    if years:
        # conservative fallback: oldest referenced year in title
        return date(min(years), 1, 1)
    return None


def main():
    load_dotenv('.env')
    db = os.environ.get('DATABASE_URL')
    if not db:
        raise SystemExit('DATABASE_URL fehlt')

    updated = 0
    scanned = 0
    with psycopg.connect(db) as conn, conn.cursor() as cur:
        cur.execute("""
            select id, title
            from politics_monitor.pm_items
            where canton='AG' and submitted_at is null
        """)
        rows = cur.fetchall()
        for item_id, title in rows:
            scanned += 1
            dt = parse_dt(title or '')
            if not dt:
                continue
            cur.execute(
                "update politics_monitor.pm_items set submitted_at=%s, updated_at=now() where id=%s",
                (dt, item_id),
            )
            updated += cur.rowcount
        conn.commit()

    print(f'scanned={scanned} updated={updated}')


if __name__ == '__main__':
    main()
