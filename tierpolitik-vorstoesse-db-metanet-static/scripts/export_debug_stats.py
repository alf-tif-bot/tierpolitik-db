#!/usr/bin/env python3
import json
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

OUT = Path('data/debug-stats.json')


def main():
    load_dotenv('.env')
    db = os.environ.get('DATABASE_URL')
    if not db:
        raise SystemExit('DATABASE_URL fehlt')

    payload = {}

    with psycopg.connect(db) as conn, conn.cursor() as cur:
        cur.execute("select count(*) from politics_monitor.pm_items")
        payload['items_total'] = cur.fetchone()[0]

        cur.execute("select count(*) from politics_monitor.pm_items where home_visible=true")
        payload['items_home_visible'] = cur.fetchone()[0]

        cur.execute("""
            select count(*)
            from politics_monitor.pm_items i
            join politics_monitor.pm_classification c on c.item_id=i.id
            where i.home_visible=true and c.label='yes'
        """)
        payload['items_home_yes'] = cur.fetchone()[0]

        cur.execute("""
            select count(*)
            from politics_monitor.pm_items i
            join politics_monitor.pm_classification c on c.item_id=i.id
            where i.review_status='queued' and c.label in ('yes','unsure')
        """)
        payload['review_queue'] = cur.fetchone()[0]

        cur.execute("""
            select coalesce(c.label,'none') as label, count(*)
            from politics_monitor.pm_items i
            left join politics_monitor.pm_classification c on c.item_id=i.id
            group by 1 order by 2 desc
        """)
        payload['labels'] = [{'label': r[0], 'count': r[1]} for r in cur.fetchall()]

        cur.execute("""
            select s.source_key,
                   count(*) as total,
                   count(*) filter (where i.home_visible=true) as home_visible,
                   count(*) filter (where c.label='yes') as yes,
                   count(*) filter (where c.label='unsure') as unsure,
                   count(*) filter (where i.review_status='queued') as queued
            from politics_monitor.pm_items i
            join politics_monitor.pm_sources s on s.id=i.source_id
            left join politics_monitor.pm_classification c on c.item_id=i.id
            group by s.source_key
            order by total desc
        """)
        payload['by_source'] = [
            {
                'source_key': r[0],
                'total': r[1],
                'home_visible': r[2],
                'yes': r[3],
                'unsure': r[4],
                'queued': r[5],
            }
            for r in cur.fetchall()
        ]

        cur.execute("""
            select coalesce(i.canton,'(none)') as canton,
                   count(*) as total,
                   count(*) filter (where c.label='yes') as yes,
                   count(*) filter (where i.home_visible=true and c.label='yes') as home_yes
            from politics_monitor.pm_items i
            left join politics_monitor.pm_classification c on c.item_id=i.id
            group by canton
            order by total desc
        """)
        payload['by_canton'] = [
            {'canton': r[0], 'total': r[1], 'yes': r[2], 'home_yes': r[3]}
            for r in cur.fetchall()
        ]

        cur.execute("""
            select coalesce(i.municipality,'(none)') as municipality,
                   count(*) as total,
                   count(*) filter (where c.label='yes') as yes,
                   count(*) filter (where i.home_visible=true and c.label='yes') as home_yes
            from politics_monitor.pm_items i
            left join politics_monitor.pm_classification c on c.item_id=i.id
            group by municipality
            order by total desc
            limit 30
        """)
        payload['by_municipality_top'] = [
            {'municipality': r[0], 'total': r[1], 'yes': r[2], 'home_yes': r[3]}
            for r in cur.fetchall()
        ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
