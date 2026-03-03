#!/usr/bin/env python3
import os
import re
import unicodedata

import psycopg
from dotenv import load_dotenv

# Strenger: nur klarer Tier-/Tierschutzbezug -> yes
CORE_PATTERNS = [
    r"\btierschutz\b", r"\btierwohl\b", r"\btierleid\b", r"\bmassentierhaltung\b",
    r"\bnutztiere?n?\b", r"\btiertransport\w*\b", r"\btierhalt\w*\b",
    r"\bschlacht\w*\b", r"\bschlachthof\w*\b", r"\btierversuch\w*\b", r"\bversuchstier\w*\b", r"\bpelz\w*\b",
    r"\blegehenn\w*\b", r"\bhuhn\w*\b", r"\bhuehn\w*\b", r"\bgefluegel\w*\b", r"\bpoulet\w*\b", r"\btrut\w*\b", r"\btruthahn\w*\b",
    r"\bschwein\w*\b", r"\brind\w*\b", r"\bkalb\w*\b", r"\bzieg\w*\b", r"\bschaf\b|\bschaefe\w*\b",
    r"\bfischzucht\w*\b", r"\baquakultur\w*\b", r"\bwildtier\w*\b", r"\bjagd\w*\b",
    r"\bwolf\w*\b", r"\bbiber\w*\b", r"\bfuchs\w*\b", r"\breh\w*\b", r"\bhirsch\w*\b",
    r"\bveterinae?r\w*\b", r"\btierarznei\w*\b", r"\btierseuch\w*\b",
]

WEAK_PATTERNS = [
    r"\bbiodivers\w*\b", r"\bnaturschutz\w*\b", r"\bartenschutz\w*\b", r"\blebensraum\w*\b", r"\bseevogel\w*\b", r"\bwasservogel\w*\b",
]

NEGATIVE = [
    "tierkreis", "tierpark", "sternbild", "spielzeugfreier kindergarten",
]


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", text.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", t).strip()


def classify_text(text: str):
    if any(n in text for n in NEGATIVE):
        return "no", 0.95, "negative_rule"

    core_hits = [p for p in CORE_PATTERNS if re.search(p, text)]
    weak_hits = [p for p in WEAK_PATTERNS if re.search(p, text)]

    if len(core_hits) >= 1:
        return "yes", 0.92, f"core:{','.join(core_hits[:4])}"

    # biodiversität alleine = zu unscharf -> unsure statt yes
    if len(weak_hits) >= 1:
        return "unsure", 0.55, f"weak:{','.join(weak_hits[:3])}"

    return "no", 0.9, "no_core_hit"


def main():
    load_dotenv('.env')
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise SystemExit('DATABASE_URL fehlt in .env')

    limit = int(os.environ.get('TPM_CLASSIFY_LIMIT', '400'))

    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            select i.id, i.title, i.body, i.item_type
            from politics_monitor.pm_items i
            order by i.last_seen_at desc
            limit %s
            """,
            (limit,),
        )
        rows = cur.fetchall()

        yes = unsure = no = 0
        for item_id, title, body, item_type in rows:
            text = norm(" ".join([title or "", body or "", item_type or ""]))
            label, conf, reason = classify_text(text)

            if label == 'yes':
                yes += 1
                is_rel = True
            elif label == 'no':
                no += 1
                is_rel = False
            else:
                unsure += 1
                is_rel = None

            cur.execute(
                """
                insert into politics_monitor.pm_classification
                (item_id, is_animal_related, label, confidence, reason, classifier, classified_at, updated_at)
                values (%s,%s,%s,%s,%s,'rules_v2_strict',now(),now())
                on conflict (item_id) do update set
                  is_animal_related = excluded.is_animal_related,
                  label = excluded.label,
                  confidence = excluded.confidence,
                  reason = excluded.reason,
                  classifier = excluded.classifier,
                  updated_at = now()
                """,
                (item_id, is_rel, label, conf, reason),
            )

        conn.commit()

    print(f"classified={len(rows)} yes={yes} unsure={unsure} no={no}")


if __name__ == '__main__':
    main()
