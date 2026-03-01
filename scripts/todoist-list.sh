#!/usr/bin/env bash
set -euo pipefail
source /Users/alf/.openclaw/workspace/secrets/todoist.env
curl -sS https://api.todoist.com/api/v1/tasks \
-H "Authorization: Bearer $TODOIST_API_TOKEN"
