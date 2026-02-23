#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/alf/.openclaw/workspace/projects/tierpolitik-db"
STATE_DIR="/Users/alf/.openclaw/workspace/tmp/monitor-nightly"
STATE_FILE="$STATE_DIR/state.json"
LOG_DIR="$STATE_DIR/logs"
mkdir -p "$STATE_DIR" "$LOG_DIR"

CANTONS=(AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH)

if [[ -f "$STATE_FILE" ]]; then
  idx="$(python3 - <<'PY' "$STATE_FILE"
import json,sys
p=sys.argv[1]
try:
  d=json.load(open(p))
  print(int(d.get('index',0)))
except Exception:
  print(0)
PY
)"
else
  idx=0
fi

if ! [[ "$idx" =~ ^[0-9]+$ ]]; then idx=0; fi
idx=$(( idx % ${#CANTONS[@]} ))
TARGET="${CANTONS[$idx]}"
NEXT=$(( (idx + 1) % ${#CANTONS[@]} ))

TS="$(date '+%Y-%m-%dT%H-%M-%S')"
RUN_LOG="$LOG_DIR/$TS-$TARGET.log"

{
  echo "[$(date)] monitor nightly start - target canton: $TARGET"
  cd "$PROJECT_DIR"
  export MONITOR_TARGET_CANTON="$TARGET"

  npm run crawler:collect:v2
  npm run crawler:score
  npm run crawler:build-review
  npm run crawler:export

  python3 - <<'PY' "$STATE_FILE" "$NEXT" "$TARGET"
import json,sys,datetime
path,next_i,target=sys.argv[1],int(sys.argv[2]),sys.argv[3]
obj={
  'index': next_i,
  'lastTargetCanton': target,
  'lastRunAt': datetime.datetime.now().isoformat(timespec='seconds')
}
json.dump(obj, open(path,'w'), indent=2)
print('state updated', obj)
PY

  echo "[$(date)] monitor nightly done - next index: $NEXT"
} >> "$RUN_LOG" 2>&1

echo "Monitor nightly completed. Log: $RUN_LOG"
