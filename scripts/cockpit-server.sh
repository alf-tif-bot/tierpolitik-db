#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/alf/.openclaw/workspace/cockpit"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Ensure dependencies/build exist
NPM_BIN="/opt/homebrew/bin/npm"
NODE_BIN="/opt/homebrew/bin/node"
if [ ! -x "$NPM_BIN" ]; then
  NPM_BIN="$(command -v npm)"
fi
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node)"
fi

if [ ! -d node_modules ]; then
  "$NPM_BIN" ci
fi

# Deploy-Guardrail: immer frisch bauen, damit keine stale chunk refs ausgeliefert werden
"$NPM_BIN" run build

# Guardrail checks vor Start
if [ ! -f .next/BUILD_ID ]; then
  echo "[cockpit-server] BUILD_ID fehlt - Start abgebrochen" >&2
  exit 1
fi

if ! ls .next/static/chunks/app/page-*.js >/dev/null 2>&1; then
  echo "[cockpit-server] app page chunk fehlt - Start abgebrochen" >&2
  exit 1
fi

exec "$NODE_BIN" "$ROOT/node_modules/next/dist/bin/next" start --hostname 0.0.0.0 --port 3002
