#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 \"title\" \"insight text\""
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/PARA/Areas/Health"
DATE="$(date +%F)"
TITLE="$1"
TEXT="$2"
SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
FILE="$DIR/${DATE}--${SLUG}.md"

mkdir -p "$DIR"
cat > "$FILE" <<EOF
---
type: insight
area: health
tags: [health, body]
source: chat
created: $DATE
---

# $TITLE

$TEXT
EOF

echo "$FILE"
