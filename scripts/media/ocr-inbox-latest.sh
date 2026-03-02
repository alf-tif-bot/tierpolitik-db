#!/usr/bin/env bash
set -euo pipefail

INBOX_DIR="$HOME/.openclaw/workspace/inbox"
OUT_DIR="$HOME/.openclaw/workspace/inbox/ocr"
mkdir -p "$OUT_DIR"

if ! command -v tesseract >/dev/null 2>&1; then
  echo "tesseract not installed"
  exit 1
fi

latest="$(ls -t "$INBOX_DIR"/*.{jpg,jpeg,png,webp,gif} 2>/dev/null | head -n1 || true)"
if [[ -z "${latest:-}" ]]; then
  echo "no image in inbox"
  exit 1
fi

base="$(basename "$latest")"
out="$OUT_DIR/${base%.*}"

tesseract "$latest" "$out" -l deu+eng --dpi 300 >/dev/null 2>&1 || tesseract "$latest" "$out" -l eng >/dev/null 2>&1

echo "OCR written: ${out}.txt"
