#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

WORKSPACE = Path('/Users/alf/.openclaw/workspace')
STATE_PATH = WORKSPACE / 'memory' / 'heartbeat-state.json'
SOCIAL_WEEKLY_DIR = WORKSPACE / 'PARA' / 'Resources' / 'Social' / 'weekly'
OPENCLAW_CONFIG = Path('/Users/alf/.openclaw/openclaw.json')
OPENCLAW_LOG_DIR = Path('/tmp/openclaw')
ALERT_CHANNEL = 'telegram'
ALERT_TARGET = '14844529'

DAILY_INTERVAL = 24 * 3600
WEEKLY_INTERVAL = 7 * 24 * 3600
MONTHLY_INTERVAL = 30 * 24 * 3600
SOCIAL_STALE_SECONDS = 3 * 24 * 3600
MAX_GIT_REPO_MB = 500


def now_ts() -> int:
    return int(time.time())


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_state() -> Dict:
    if not STATE_PATH.exists():
        return {
            'lastChecks': {},
            'lastBackup': None,
            'lastRun': None,
        }
    try:
        return json.loads(STATE_PATH.read_text())
    except Exception:
        return {'lastChecks': {}, 'lastBackup': None, 'lastRun': None}


def save_state(state: Dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False) + '\n')


def run(cmd: List[str], cwd: Path | None = None, timeout: int = 120) -> Tuple[int, str, str]:
    p = subprocess.run(cmd, cwd=str(cwd) if cwd else None, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def should_run(last_ts: int | None, interval: int) -> bool:
    if not last_ts:
        return True
    return now_ts() - int(last_ts) >= interval


def latest_social_snapshot_age_seconds() -> int | None:
    if not SOCIAL_WEEKLY_DIR.exists():
        return None
    files = [p for p in SOCIAL_WEEKLY_DIR.glob('*.md') if p.is_file()]
    if not files:
        return None
    latest = max(files, key=lambda p: p.stat().st_mtime)
    return int(now_ts() - int(latest.stat().st_mtime))


def check_git_repo_size_mb() -> int | None:
    git_dir = WORKSPACE / '.git'
    if not git_dir.exists():
        return None
    code, out, _ = run(['du', '-sm', str(git_dir)])
    if code != 0 or not out:
        return None
    try:
        return int(out.split()[0])
    except Exception:
        return None


def normalize_error_line(line: str) -> str:
    line = re.sub(r'\d{4}-\d{2}-\d{2}T[^\s]+', '', line)
    line = re.sub(r'\b\d{2,}\b', '<n>', line)
    return line.strip()[:240]


def recurring_errors() -> List[Tuple[str, int]]:
    candidates: List[str] = []

    for lf in sorted(OPENCLAW_LOG_DIR.glob('openclaw-*.log'))[-3:]:
        try:
            candidates.extend(lf.read_text(errors='ignore').splitlines())
        except Exception:
            pass

    tmp_dir = WORKSPACE / 'tmp'
    if tmp_dir.exists():
        for ef in tmp_dir.glob('*.err.log'):
            try:
                candidates.extend(ef.read_text(errors='ignore').splitlines())
            except Exception:
                pass

    freq: Dict[str, int] = {}
    for line in candidates:
        if not line:
            continue
        low = line.lower()
        if ('error' in low) or ('fatal' in low) or ('exception' in low) or ('unauthorized' in low):
            key = normalize_error_line(line)
            freq[key] = freq.get(key, 0) + 1

    recurring = sorted([(k, v) for k, v in freq.items() if v >= 3], key=lambda kv: kv[1], reverse=True)
    return recurring[:6]


def run_git_backup() -> Tuple[bool, str]:
    code, out, err = run(['git', 'status', '--porcelain'], cwd=WORKSPACE)
    if code != 0:
        return False, f'git status failed: {err or out}'
    if not out.strip():
        return True, 'no changes'

    # Avoid nested repos / volatile mirrors that break `git add -A` in monorepo backups.
    add_cmd = [
        'git', 'add', '-A', '--', '.',
        ':(exclude)agents',
        ':(exclude)projects',
        ':(exclude)second-brain-next',
    ]
    code, add_out, add_err = run(add_cmd, cwd=WORKSPACE)
    if code != 0:
        return False, f'git add failed: {add_err or add_out}'

    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    code, out, err = run(['git', 'commit', '-m', f'Heartbeat backup: {ts}'], cwd=WORKSPACE)
    if code != 0:
        # if nothing to commit after add (rare race), treat as ok
        joined = (out + '\n' + err).lower()
        if 'nothing to commit' in joined:
            return True, 'no commit needed'
        return False, f'git commit failed: {err or out}'

    code, out, err = run(['git', 'push'], cwd=WORKSPACE)
    if code != 0:
        return False, f'git push failed: {err or out}'

    return True, 'committed + pushed'


def check_gateway_security() -> List[str]:
    alerts: List[str] = []
    if not OPENCLAW_CONFIG.exists():
        return ['openclaw.json not found']

    try:
        cfg = json.loads(OPENCLAW_CONFIG.read_text())
    except Exception as e:
        return [f'openclaw.json parse failed: {e}']

    gw = cfg.get('gateway', {}) if isinstance(cfg, dict) else {}
    bind = gw.get('bind', 'loopback')
    auth = gw.get('auth', {}) if isinstance(gw.get('auth', {}), dict) else {}

    if bind not in ('loopback', '127.0.0.1', 'localhost'):
        alerts.append(f'Gateway bind is "{bind}" (expected loopback/localhost).')

    has_auth = bool(auth.get('token') or auth.get('password') or auth.get('tokenFile'))
    if not has_auth:
        alerts.append('Gateway auth appears disabled (no token/password configured).')

    return alerts


def scan_memory_for_injection_patterns() -> List[str]:
    alerts: List[str] = []
    candidates = [WORKSPACE / 'MEMORY.md']
    mem_dir = WORKSPACE / 'memory'
    if mem_dir.exists():
        candidates.extend(mem_dir.glob('*.md'))

    patterns = [
        r'ignore (all|previous|earlier) (instructions|system prompt)',
        r'reveal (the )?(system prompt|developer message)',
        r'bypass (safety|policy|guardrails)',
        r'exfiltrat(e|ion)',
        r'disable (safeguards|safety checks)',
        r'you are now (unrestricted|root|developer)',
    ]
    rx = [re.compile(p, re.IGNORECASE) for p in patterns]

    for p in candidates:
        if not p.exists() or not p.is_file():
            continue
        text = p.read_text(errors='ignore')
        for r in rx:
            m = r.search(text)
            if m:
                alerts.append(f'Suspicious pattern in {p}: "{m.group(0)}"')
                break

    return alerts


def send_alert(lines: List[str]) -> None:
    if not lines:
        return
    body = '🚨 Health Heartbeat Alert\n\n' + '\n'.join(f'- {x}' for x in lines)
    run([
        'openclaw', 'message', 'send',
        '--channel', ALERT_CHANNEL,
        '--target', ALERT_TARGET,
        '--message', body,
    ], cwd=WORKSPACE, timeout=120)


def main() -> int:
    state = load_state()
    last = state.setdefault('lastChecks', {})
    alerts: List[str] = []

    # Daily checks
    if should_run(last.get('daily'), DAILY_INTERVAL):
        age = latest_social_snapshot_age_seconds()
        if age is None:
            alerts.append('Social tracker has no snapshot file yet.')
        elif age > SOCIAL_STALE_SECONDS:
            days = round(age / 86400, 1)
            alerts.append(f'Social tracker data is stale ({days} days old, >3 days).')

        git_mb = check_git_repo_size_mb()
        if git_mb is not None and git_mb > MAX_GIT_REPO_MB:
            alerts.append(f'Git repo size is {git_mb}MB (> {MAX_GIT_REPO_MB}MB). Possible binary/blob accumulation.')

        recurring = recurring_errors()
        if recurring:
            preview = '; '.join([f'{count}x {msg}' for msg, count in recurring[:3]])
            alerts.append(f'Recurring errors detected: {preview}')

        ok, msg = run_git_backup()
        state['lastBackup'] = {'at': now_ts(), 'iso': iso_now(), 'status': 'ok' if ok else 'error', 'detail': msg}
        if not ok:
            alerts.append(f'Git backup failed: {msg}')

        last['daily'] = now_ts()

    # Weekly checks
    if should_run(last.get('weekly'), WEEKLY_INTERVAL):
        weekly_alerts = check_gateway_security()
        alerts.extend(weekly_alerts)
        last['weekly'] = now_ts()

    # Monthly checks
    if should_run(last.get('monthly'), MONTHLY_INTERVAL):
        monthly_alerts = scan_memory_for_injection_patterns()
        alerts.extend(monthly_alerts)
        last['monthly'] = now_ts()

    state['lastRun'] = {'at': now_ts(), 'iso': iso_now(), 'alertsCount': len(alerts)}
    save_state(state)

    if alerts:
        send_alert(alerts)

    # Silence if fine.
    return 0


if __name__ == '__main__':
    sys.exit(main())
