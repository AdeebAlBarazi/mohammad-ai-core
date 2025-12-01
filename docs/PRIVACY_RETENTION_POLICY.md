# Privacy, Retention, and Erasure Policy (Draft)

## Data Inventory (PII)
- Identity: name, email, phone, addresses, user identifiers.
- Orders: order IDs, items, totals, timestamps.

## Retention
- Operational logs: 30–90 days, PII redacted.
- Orders and financial records: 5–7 years (jurisdiction-dependent), encrypted at rest.
- Media assets: retained while products are active; deleted upon product removal if not referenced.

## Erasure (DSR)
- User requests trigger data erasure workflow.
- Delete user profile and associated tokens; anonymize orders where legal retention applies.
- Best-effort removal from derived systems and caches.

## Security Controls
- Transport: HTTPS-only with HSTS.
- At-rest encryption for databases, volumes, and object storage.
- Logging redaction and correlation IDs enabled.

## Auditing
- Access logs for sensitive endpoints retained for 90 days.
- Admin actions recorded with user and correlation IDs.
