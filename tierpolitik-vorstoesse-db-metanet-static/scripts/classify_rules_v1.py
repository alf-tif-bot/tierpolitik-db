#!/usr/bin/env python3
import os
import re
import unicodedata

import psycopg
from dotenv import load_dotenv

POSITIVE_KEYWORDS = [
    "tierschutz", "tierwohl", "tierqu", "tierleid", "massentierhaltung", "nutztier",
    "legehenne", "huhn", "huehn", "gefluegel", "poulet", "trute", "truthahn",
    "schwein", "rind", "kalb", "ziege", "schaf", "fischzucht", "aquakultur",
    "schlacht", "schlachthof", "pelz", "stopfleber", "foie gras", "tierversuch",
    "versuchstier", "3r", "wildtier", "jagd", "wolf", "veterinaer", "veterinär",
    "tierarznei", "tiertransport", "tierhalt", "tierprodu", "eierproduktion", "legebetrieb",
]

NEGATIVE_HINTS = [
    "tiergarten", "sternbild", "tierkreis", "tierpark",
]


def normalize(text: str) -> str:
    t = unicodedata.normalize("NFKD", text.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def classify(title: str, body: str | None, item_type: str | None):
    text = normalize(" ".join([title or "", body or "", item_type or ""]))

    if any(n in text for n in NEGATIVE_HINTS):
        return "no", 0.70, "negative_hint"

    hits = [kw for kw in POSITIVE_KEYWORDS if kw in text]
    if len(hits) >= 2:
        return "yes", 0.90, f"keywords:{','.join(hits[:5])}"
    if len(hits) == 1:
        return "unsure", 0.65, f"keyword:{hits[0]}"

    return "no", 0.80, "no_keyword_hit"


def main():
    load_dotenv('.env')
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise SystemExit('DATABASE_URL fehlt in .env')

    limit = int(os.environ.get('TPM_CLASSIFY_LIMIT', '200'))

    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            select i.id, i.title, i.body, i.item_type
            from politics_monitor.pm_items i
            left join politics_monitor.pm_classification c on c.item_id = i.id
            where c.item_id is null
            order by i.last_seen_at desc
            limit %s
            """,
            (limit,),
        )
        rows = cur.fetchall()

        yes = no = unsure = 0
        for item_id, title, body, item_type in rows:
            label, confidence, reason = classify(title or "", body, item_type)
            if label == 'yes':
                yes += 1
                is_animal_related = True
            elif label == 'no':
                no += 1
                is_animal_related = False
            else:
                unsure += 1
                is_animal_related = None

            cur.execute(
                """
                insert into politics_monitor.pm_classification
                (item_id, is_animal_related, label, confidence, reason, classifier, classified_at, updated_at)
                values (%s, %s, %s, %s, %s, 'rules_v1', now(), now())
                on conflict (item_id) do update set
                  is_animal_related = excluded.is_animal_related,
                  label = excluded.label,
                  confidence = excluded.confidence,
                  reason = excluded.reason,
                  classifier = excluded.classifier,
                  updated_at = now()
                """,
                (item_id, is_animal_related, label, confidence, reason),
            )

        conn.commit()

    print(f"classified={len(rows)} yes={yes} unsure={unsure} no={no}")


if __name__ == '__main__':
    main()
