# Codex Task Brief

Use this brief when continuing the repository in Codex.

## Goal

Maintain the HPV screening app as a production-ready Next.js, React, Neon Postgres, and Vercel MVP for hub-and-spoke cervical cancer screening operations.

## Product Rules

1. Aadhaar and ABHA are equal-priority identity fields.
2. Aadhaar-first entry is supported because it is more available in the field.
3. Never store full Aadhaar in plaintext. Store only HMAC hash and last four digits.
4. Store ABHA as hash plus masked display unless a compliance-approved full-storage approach is added.
5. Spoke users only access their own center data.
6. Hub and admin users can monitor all centers.
7. Lab users can access received samples pending result.
8. Every sample has one sample ID/barcode and a clear status.
9. Every dispatch has a digital manifest.
10. Positive results create referral tasks automatically.
11. Audit sensitive actions.

## Workflow

Register or find patient -> collect sample -> create dispatch batch -> hub receive -> lab result -> referral follow-up.

## Next Implementation Tasks

- Add user management CRUD under `/admin`.
- Add forced password change after first login.
- Add CSV exports for daily sample, batch, result, and referral reports.
- Add scanner-friendly bulk hub receipt.
- Add result PDF generation.
- Add HIS/LIS/ABDM integration workers that consume `outbox_events`.
- Add automated tests for dedupe, role scoping, and status transitions.
