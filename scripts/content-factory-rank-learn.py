#!/usr/bin/env python3
import csv
import json
import os
from collections import defaultdict

WORKDIR = "/Users/alf/.openclaw/workspace"
VOTES = os.path.join(WORKDIR, "content-factory", "votes.csv")
RANKING = os.path.join(WORKDIR, "content-factory", "sources-ranking.json")
REPORT = os.path.join(WORKDIR, "content-factory", "runs", "ranking-learning-latest.md")

UP = {"C": "B", "B": "A", "A": "A"}
DOWN = {"A": "B", "B": "C", "C": "C"}

POSITIVE = {"MM", "Vorstoss", "NL", "FR", "Kampagne", "Parken"}
NEGATIVE = {"Irrelevant"}


def norm_source(s: str) -> str:
    return (s or "").strip()


def load_ranking():
    if not os.path.exists(RANKING):
        return {}
    with open(RANKING, "r", encoding="utf-8") as f:
        raw = json.load(f)
    out = {}
    for k, v in raw.items():
        v = str(v).upper().strip()
        out[k] = v if v in {"A", "B", "C"} else "B"
    return out


def load_votes():
    if not os.path.exists(VOTES):
        return []
    rows = []
    with open(VOTES, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            src = norm_source(r.get("source", ""))
            decision = (r.get("decision", "") or "").strip()
            if src and decision:
                rows.append({"source": src, "decision": decision})
    return rows


def apply_learning(ranking, votes):
    stats = defaultdict(lambda: {"n": 0, "pos": 0, "neg": 0})
    for v in votes:
        s = v["source"]
        d = v["decision"]
        stats[s]["n"] += 1
        if d in POSITIVE:
            stats[s]["pos"] += 1
        elif d in NEGATIVE:
            stats[s]["neg"] += 1

    changes = []
    for source, st in stats.items():
        n, pos, neg = st["n"], st["pos"], st["neg"]
        old = ranking.get(source, "B")
        new = old
        pos_ratio = pos / n if n else 0
        neg_ratio = neg / n if n else 0

        if n >= 4 and pos_ratio >= 0.75:
            new = UP[old]
        elif n >= 3 and neg_ratio >= 0.60:
            new = DOWN[old]

        ranking[source] = new
        if new != old:
            changes.append((source, old, new, n, pos, neg))

    return ranking, changes, stats


def write_report(changes, stats):
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    lines = ["# Ranking Learning Report", ""]
    if not stats:
        lines.append("Keine Votes gefunden (`content-factory/votes.csv`).")
    else:
        lines.append("## Quelle-Statistiken")
        lines.append("")
        for src in sorted(stats.keys(), key=lambda x: x.lower()):
            st = stats[src]
            lines.append(f"- {src}: n={st['n']}, pos={st['pos']}, neg={st['neg']}")

    lines.append("")
    lines.append("## Änderungen")
    lines.append("")
    if not changes:
        lines.append("Keine Up-/Downgrades.")
    else:
        for c in changes:
            source, old, new, n, pos, neg = c
            lines.append(f"- {source}: {old} → {new} (n={n}, pos={pos}, neg={neg})")

    with open(REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


def main():
    ranking = load_ranking()
    votes = load_votes()
    ranking, changes, stats = apply_learning(ranking, votes)
    with open(RANKING, "w", encoding="utf-8") as f:
        json.dump(ranking, f, ensure_ascii=False, indent=2, sort_keys=True)
    write_report(changes, stats)
    print(f"updated ranking: {RANKING}")
    print(f"report: {REPORT}")


if __name__ == "__main__":
    main()
