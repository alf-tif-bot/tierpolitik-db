#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

current_branch="$(git rev-parse --abbrev-ref HEAD)"

git add -A
if ! git diff --cached --quiet; then
  git commit -m "nightly backup: $(date '+%Y-%m-%d %H:%M:%S %Z')"
fi

git push origin "$current_branch"

echo "[$(date)] nightly github update done on branch $current_branch"
