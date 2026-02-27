# Newsletter-Stack: Listmonk + SES (Mailchimp-Alternative)

- **Kurzbeschreibung:** Self-hosted Newsletter-System mit Listmonk und SES-SMTP als kosteneffiziente, flexible Alternative zu Mailchimp.
- **Status:** next
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

## Nächster Schritt
SES SMTP-Credentials + Sender-Domain-Auth (SPF/DKIM/DMARC) finalisieren, dann End-to-End Testversand an Seed-Liste.
