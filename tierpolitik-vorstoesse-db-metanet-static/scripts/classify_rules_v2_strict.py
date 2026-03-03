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
    r"\bfischzucht\w*\b", r"\baquakultur\w*\b", r"\bwildtier\w*\b", r"\bjagd\w*\b", r"\bfuchsjagd\w*\b",
    r"\bveterinae?r\w*\b", r"\btierarznei\w*\b", r"\btierseuch\w*\b",
]

WEAK_PATTERNS = [
    r"\bbiodivers\w*\b", r"\bnaturschutz\w*\b", r"\bartenschutz\w*\b", r"\blebensraum\w*\b", r"\bseevogel\w*\b", r"\bwasservogel\w*\b",
]

NEGATIVE = [
    "tierkreis", "tierpark", "sternbild", "spielzeugfreier kindergarten",
]

STOPWORDS = {
    'der','die','das','und','oder','von','vom','im','in','am','an','zu','zur','zum','mit','ohne','auf','für','bei','als','eine','einer','eines','einem','einen','des','dem','den','dass','sowie','stadt','zuerich','zurich','gemeinderat','kantonsrat','postulat','motion','weisung','anfrage','einzelinitiative'
}


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", text.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", t).strip()


def extract_tokens(text: str):
    toks = re.findall(r"[a-zA-ZäöüÄÖÜß]{4,}", text)
    toks = [norm(t) for t in toks]
    return {t for t in toks if t and t not in STOPWORDS}


def classify_text(text: str, pos_tokens: set[str], neg_tokens: set[str]):
    # harte Regel aus User-Feedback: Zoo-Titel i.d.R. relevant
    if re.search(r"\bzoo\b", text):
        return "yes", 0.97, "zoo_rule"

    if any(n in text for n in NEGATIVE):
        return "no", 0.95, "negative_rule"

    core_hits = [p for p in CORE_PATTERNS if re.search(p, text)]
    weak_hits = [p for p in WEAK_PATTERNS if re.search(p, text)]

    if len(core_hits) >= 1:
        return "yes", 0.92, f"core:{','.join(core_hits[:4])}"

    # Learning aus bisherigen Entscheiden (approved/rejected)
    toks = extract_tokens(text)
    pos_score = len(toks & pos_tokens)
    neg_score = len(toks & neg_tokens)

    # learned positives bleiben vorsichtig -> unsure (kein automatisches yes)
    if pos_score >= 5 and neg_score == 0:
        return "unsure", 0.62, f"learned:+{pos_score}/-{neg_score}"
    if neg_score >= 5 and pos_score == 0:
        return "no", 0.76, f"learned:+{pos_score}/-{neg_score}"

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
        # Lern-Basis aus manuellen Entscheiden
        cur.execute(
            """
            select title, body
            from politics_monitor.pm_items
            where review_status='approved'
            order by reviewed_at desc nulls last
            limit 2000
            """
        )
        approved_rows = cur.fetchall()

        cur.execute(
            """
            select title, body
            from politics_monitor.pm_items
            where review_status='rejected'
            order by reviewed_at desc nulls last
            limit 4000
            """
        )
        rejected_rows = cur.fetchall()

        raw_pos=set()
        for t,b in approved_rows:
            raw_pos |= extract_tokens(norm(" ".join([t or "", b or ""])))
        raw_neg=set()
        for t,b in rejected_rows:
            raw_neg |= extract_tokens(norm(" ".join([t or "", b or ""])))

        # nur unterscheidende Tokens verwenden (verringert False Positives)
        pos_tokens = raw_pos - raw_neg
        neg_tokens = raw_neg - raw_pos

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
            label, conf, reason = classify_text(text, pos_tokens, neg_tokens)

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
