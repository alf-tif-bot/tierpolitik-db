#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$HOME/.openclaw/media/inbound"
DST_DIR="$HOME/.openclaw/workspace/inbox"
STATE_FILE="$HOME/.openclaw/workspace/inbox/.import-state"

mkdir -p "$DST_DIR"
touch "$STATE_FILE"

copied=0

# Copy only new image files by basename+mtime signature
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  mtime="$(stat -f %m "$f" 2>/dev/null || echo 0)"
  sig="${base}|${mtime}"

  if grep -Fxq "$sig" "$STATE_FILE"; then
    continue
  fi

  # Keep original filename, avoid overwrite collisions
  target="$DST_DIR/$base"
  if [[ -e "$target" ]]; then
    target="$DST_DIR/${mtime}-$base"
  fi

  cp "$f" "$target"
  echo "$sig" >> "$STATE_FILE"
  copied=$((copied + 1))
done < <(find "$SRC_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) -print0 2>/dev/null)

echo "Imported $copied image(s) to inbox/"
