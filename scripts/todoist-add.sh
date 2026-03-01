#!/usr/bin/env bash
set -euo pipefail
source /Users/alf/.openclaw/workspace/secrets/todoist.env

CONTENT="${1:-}"
DUE="${2:-}"
if [[ -z "$CONTENT" ]]; then
  echo "Usage: $0 \"content\" [due_string]"
  exit 1
fi

if [[ -n "$DUE" ]]; then
  curl -sS -X POST https://api.todoist.com/api/v1/tasks \
    -H "Authorization: Bearer $TODOIST_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"content\":\"$CONTENT\",\"due_string\":\"$DUE\"}"
else
  curl -sS -X POST https://api.todoist.com/api/v1/tasks \
    -H "Authorization: Bearer $TODOIST_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"content\":\"$CONTENT\"}"
fi
