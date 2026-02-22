#!/usr/bin/env bash
set -euo pipefail

# Encrypted backup for this workspace using restic.
# Usage:
#   1) cp scripts/restic.env.example scripts/restic.env
#   2) fill values in scripts/restic.env
#   3) chmod 600 scripts/restic.env
#   4) ./scripts/backup-restic.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${RESTIC_ENV_FILE:-$ROOT_DIR/scripts/restic.env}"

RESTIC_BIN="$(command -v restic || true)"
if [[ -z "$RESTIC_BIN" && -x "/opt/homebrew/bin/restic" ]]; then
  RESTIC_BIN="/opt/homebrew/bin/restic"
fi
if [[ -z "$RESTIC_BIN" && -x "/usr/local/bin/restic" ]]; then
  RESTIC_BIN="/usr/local/bin/restic"
fi
if [[ -z "$RESTIC_BIN" ]]; then
  echo "restic is not installed. Install with: brew install restic"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create it from scripts/restic.env.example"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"
export RESTIC_REPOSITORY RESTIC_PASSWORD

EXCLUDES=(
  --exclude "$ROOT_DIR/.git"
  --exclude "$ROOT_DIR/**/node_modules"
  --exclude "$ROOT_DIR/**/.next"
  --exclude "$ROOT_DIR/**/dist"
  --exclude "$ROOT_DIR/**/build"
  --exclude "$ROOT_DIR/tmp"
)

echo "[$(date)] running restic backup..."
"$RESTIC_BIN" backup "$ROOT_DIR" "${EXCLUDES[@]}"

echo "[$(date)] pruning old snapshots..."
"$RESTIC_BIN" forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune

echo "[$(date)] done."
