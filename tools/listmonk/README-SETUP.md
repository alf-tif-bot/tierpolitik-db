# Listmonk Setup (local on Mac mini)

## Installed
- listmonk binary: `tools/listmonk/listmonk`
- config: `tools/listmonk/config.toml`
- DB: PostgreSQL 16 (`listmonk` database + `listmonk` user)
- Local URL: `http://127.0.0.1:9000`

## First login
Open:
- `http://127.0.0.1:9000/admin`

Create the superadmin user in the UI.

## SMTP / SES (recommended)
In listmonk admin:
- Settings → Messengers → SMTP

Use SES SMTP credentials:
- Host: `email-smtp.<region>.amazonaws.com`
- Port: `587` (STARTTLS)
- Username: SES SMTP username
- Password: SES SMTP password
- From email: e.g. `newsletter@yourdomain.tld`

## Start / Stop
Start (manual):
```bash
cd /Users/alf/.openclaw/workspace/tools/listmonk
./listmonk --config config.toml
```

If already started in background:
```bash
pkill -f '/Users/alf/.openclaw/workspace/tools/listmonk/listmonk'
```

## Notes
- Current setup is local-only (localhost).
- For production sending, ensure SPF/DKIM/DMARC on sender domain.
