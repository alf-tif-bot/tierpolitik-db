#!/usr/bin/env bash
set -euo pipefail

PROMPT="${1:-editorial symbolic illustration, pencil sketch style, Swiss animal rights context}"
NEG="${2:-photorealistic skin pores, CGI, 3d render, glossy plastic, watermark, logo artifacts}"
SEED="${3:-$RANDOM}"
ROOT="/Users/alf/.openclaw/workspace/tools/ComfyUI"
WF="$ROOT/workflows/TIF_MM_680x383_api.json"
OUTDIR="$ROOT/output"

if ! curl -sf http://127.0.0.1:8188/system_stats >/dev/null; then
  echo "ComfyUI läuft nicht. Starte zuerst:"
  echo "cd $ROOT && source .venv/bin/activate && python main.py"
  exit 1
fi

python3 - <<PY
import json, urllib.request, pathlib
wf=json.loads(pathlib.Path('$WF').read_text())
wf['6']['inputs']['text']='$PROMPT'
wf['7']['inputs']['text']='$NEG'
wf['3']['inputs']['seed']=int('$SEED')
req=urllib.request.Request('http://127.0.0.1:8188/prompt', data=json.dumps({'prompt':wf}).encode(), headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req) as r:
    print(r.read().decode())
PY

echo "Queued. Warte bis neues tif-mm_*.png in $OUTDIR erscheint, dann croppe ich auf 680x383 JPG."
