#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LINKS=ROOT/'data'/'stallbraende'/'links.raw.v0.jsonl'

BE_LINKS=[
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=dd77aff1-f760-4ad7-9ff9-ef11ecb0a281",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=2f368709-f114-49c0-8f81-9b7ee426e16c",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=1032c645-4592-4206-9cd3-5ae7b227bc15",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=416c0867-e357-4bac-8aac-e91004ab0963",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=ca5a9367-42f9-4c2d-bee0-07d4828f9f57",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=37e44273-9009-4736-8786-c4aef67dec3c",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=c5e2c0bb-c7bf-4789-89f0-a262b1771015",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=aa0d0746-6176-4fd4-8670-d694d09c5f30",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=44eb59d9-d70b-46e1-8457-8f04798fd60a",
"https://www.police.be.ch/de/start/themen/news/medienmitteilungen.html?newsID=c7bed753-badd-400a-9e85-2fd602ff56c4",
]

ZH_LINKS=[
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/03/vom_motorradfahrerzumfussgaenger.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/03/15-jahre-unesco-pfahlbauten-app-past-zuerich.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/03/gefluechtet_aufgespuertfestgenommen.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/03/mann_nach_auseinandersetzungimkreis1verletzt.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/02/an-der-thurgauerstrasse-in-seebach-entsteht-ein-neuer-quartierpark.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/02/stadt-zuerich-unterstuetzt-gesamtinstandsetzung-siedlung-hardau-stiftung-alterswohnungen.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/02/gesundheitszentrum-fuer-das-alter-stampfenbach-instandsetzung-umbauten-2027-geplant.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/02/stadtrat-verurteilt-gewalt-und-vandalismus-wahlen.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/02/erneuerung-wasserleitung-fischerweg.html",
"https://www.stadt-zuerich.ch/de/aktuell/medienmitteilungen/2026/02/todesopfer_nach_wohnungsbrandimkreis11.html",
]

rows=[json.loads(l) for l in LINKS.read_text(encoding='utf-8').splitlines() if l.strip()]
seen={(r.get('source_id'),r.get('url')) for r in rows}
added=0
for url in BE_LINKS:
    k=('ch-be-police-news',url)
    if k not in seen:
        rows.append({'source_id':'ch-be-police-news','source_name':'Kantonspolizei Bern – Medienmitteilungen','url':url,'origin':'browser_rendered_seed'})
        seen.add(k); added+=1
for url in ZH_LINKS:
    k=('ch-zh-police-news',url)
    if k not in seen:
        rows.append({'source_id':'ch-zh-police-news','source_name':'Stadtpolizei Zürich – Medienmitteilungen','url':url,'origin':'browser_rendered_seed'})
        seen.add(k); added+=1

with LINKS.open('w',encoding='utf-8') as f:
    for r in rows:
        f.write(json.dumps(r,ensure_ascii=False)+'\n')
print('added',added,'total',len(rows))
