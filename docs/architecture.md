# Architecture

## Runtime

- Frontend and backend: Next.js App Router
- UI: React, TypeScript, Tailwind CSS
- Hosting: Vercel
- Database: Neon Postgres
- Data access: server-side SQL via `@neondatabase/serverless`
- Auth: signed HTTP-only session cookie for the MVP

## Data Model

Core tables:

- `centers`
- `users`
- `patients`
- `patient_identifiers`
- `samples`
- `dispatch_batches`
- `dispatch_batch_samples`
- `lab_results`
- `referrals`
- `audit_logs`
- `external_patient_links`
- `outbox_events`

## Identity Matching

1. Aadhaar exact match through HMAC using `IDENTIFIER_PEPPER`.
2. ABHA exact match through HMAC using `IDENTIFIER_PEPPER`.
3. Mobile + name + DOB as a soft duplicate warning.
4. Future HIS/UHID matching through `external_patient_links`.

The app never stores full Aadhaar. ABHA is stored as a masked display value plus hash.

## Roles

- `admin`: full operational access.
- `hub`: hub receipt, monitoring, and referrals.
- `lab`: received samples pending result and result entry.
- `spoke`: own-center patient registration, sample collection, and dispatch batches.

## Interoperability Hooks

- `external_patient_links` can store HIS UHID, LIS IDs, or program IDs.
- `outbox_events` queues future events such as `SAMPLE_COLLECTED`, `BATCH_DISPATCHED`, `BATCH_RECEIVED`, `RESULT_REPORTED`, and `POSITIVE_REFERRAL_CREATED`.
- `/api/integrations/lis/import` stages future LIS imports.
- `/api/integrations/lis/webhook` stages future LIS or lab machine push payloads.
- `/api/integrations/abdm` stages future ABDM/ABHA consent-link activity.
