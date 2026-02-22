# Backup Setup (Git + encrypted Restic)

## 1) Git remote (private)

```bash
cd /Users/alf/.openclaw/workspace
git remote add origin <YOUR_PRIVATE_REPO_URL>
git push -u origin master
```

## 2) Encrypted restic backup

Install restic:

```bash
brew install restic
```

Create env file:

```bash
cd /Users/alf/.openclaw/workspace
cp scripts/restic.env.example scripts/restic.env
chmod 600 scripts/restic.env
# then edit scripts/restic.env
```

First manual run:

```bash
./scripts/backup-restic.sh
```

## 3) Daily schedule (launchd)

```bash
./scripts/install-restic-launchd.sh
```

Runs daily at **03:30**.

## Notes
- `scripts/restic.env` is gitignored by root `.gitignore`.
- Backup excludes heavy build artifacts (`node_modules`, `.next`, `dist`, `build`, `tmp`).
- Keep your RESTIC_PASSWORD safe; without it restore is impossible.
