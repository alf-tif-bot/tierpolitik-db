# Newsletter-Stack: Listmonk + SES (Mailchimp-Alternative)

- **Kurzbeschreibung:** Self-hosted Newsletter-System mit Listmonk und SES-SMTP als kosteneffiziente, flexible Alternative zu Mailchimp.
- **Status:** active
- **Impact:** high
- **Effort:** med
- **Tags:** newsletter, listmonk, ses, mailchimp-alternative, tif

## Ziel
Unabhängiger, API-fähiger Newsletter-Stack mit weniger Vendor-Lock-in und tieferen laufenden Kosten.

## Scope v1
- Listmonk lokal/Server
- SES SMTP Integration
- Basis-Segmente + 1 Standardtemplate
- Draft/Review/Send-Workflow mit ALF-Unterstützung

## Stand (2026-02-27)
- Listmonk lokal auf Mac mini installiert (`v6.0.0`) unter: `tools/listmonk/`
- PostgreSQL 16 installiert, DB + User `listmonk` eingerichtet
- Listmonk erreichbar unter:
  - lokal: `http://127.0.0.1:9000/admin/login`
  - LAN: `http://192.168.50.140:9000/admin/login`
- LaunchAgent eingerichtet: `ai.openclaw.listmonk` (Autostart aktiv)
- API-Integration mit ALF begonnen, aber noch blockiert durch ungültige API-Credentials (Token/User-Match noch nicht sauber)
- TIF-farbiges Newsletter-HTML-Template als Entwurf erstellt (Button/Links/Farben nach Styleguide)

## Offene Punkte / Blocker
1. API-User finalisieren (`Type=API`, `Role=alf-editor`, frischer Token via Copy/Paste in `secrets/listmonk.env`)
2. SES SMTP einrichten (Host, Port 587, SMTP-User/Pass)
3. Sender-Domain absichern (SPF/DKIM/DMARC)
4. End-to-End Test (Draft erstellen durch ALF, finaler Versand manuell durch Tobi)

## Nächster Schritt
Neuen API-Token sauber setzen und API-Auth-Check erfolgreich machen (`/api/lists`), danach SES anbinden und ersten Testnewsletter versenden.
