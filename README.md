# HPV Screening Digital Backbone

Production-ready MVP for an HPV DNA cervical cancer screening hub-and-spoke workflow.

Hub: IOG Hospital, Egmore.

Spokes: Stanley, KMC, KGH / Omandurar Hospital, PHC / CHC centers.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Neon Postgres
- Vercel
- Server-side route handlers
- Cookie-based session authentication
- SQL schema migration script
- Demo seed scripts

## Environment Variables

Create `.env.local` for local development. Add the same values in Vercel Project Settings.

```bash
DATABASE_URL=<provided by Neon>
SESSION_SECRET=<long random secret, 32+ chars>
IDENTIFIER_PEPPER=<long random secret, 32+ chars>
NEXT_PUBLIC_DEMO_MODE=false
```

Never commit `.env.local`.

## Local Setup

```bash
npm install
npm run db:init
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

For 1,000 demo patients and samples:

```bash
npm run seed:demo-1000
```

Build check:

```bash
npm run lint
npm run build
```

## Seeded Users

All seeded passwords are `welcome@123`.

| Username | Role | Center |
| --- | --- | --- |
| admin | admin | IOG Hospital, Egmore |
| hub | hub | IOG Hospital, Egmore |
| lab | lab | IOG Hospital, Egmore |
| stanley | spoke | Stanley |
| kmc | spoke | KMC |
| kgh | spoke | KGH / Omandurar Hospital |
| phc | spoke | PHC / CHC centers |

Change demo passwords before live use.

## Neon Setup

1. Create a Neon Postgres project.
2. Copy the pooled connection string.
3. Set `DATABASE_URL` in `.env.local`.
4. Set `SESSION_SECRET` and `IDENTIFIER_PEPPER`.
5. Run `npm run db:init`.
6. Run `npm run db:seed`.
7. Optional: run `npm run seed:demo-1000`.

## Vercel Setup

1. Push this repository to GitHub.
2. Import it in Vercel.
3. Set the environment variables listed above.
4. Use build command `npm run build`.
5. Deploy.
6. Run the database scripts locally against the Neon database or from a trusted deployment job.

## Operational Workflow

1. Spoke user logs in.
2. Search patient by Aadhaar, ABHA, or mobile/DOB.
3. Register patient if no match exists.
4. Collect sample and print barcode label.
5. Create dispatch batch and print/save manifest.
6. Hub receives batch and marks missing or damaged samples.
7. Lab reports result.
8. Positive result creates referral task.
9. Hub/spoke updates follow-up status to closure.

## Security Notes

- Full Aadhaar is never stored.
- Aadhaar duplicate detection uses HMAC with `IDENTIFIER_PEPPER`.
- Aadhaar last four digits are stored for display.
- ABHA is stored as HMAC plus masked display value.
- Sensitive actions write to `audit_logs`.
- Spoke users are scoped to their own center.
- Hub/admin can see all centers.
- Lab users can access received samples pending result.

## Database Commands

```bash
npm run db:init
npm run db:seed
npm run seed:demo-1000
```

## Post-Deployment Testing Checklist

1. Login as `admin`, `hub`, `lab`, `stanley`, `kmc`, `kgh`, and `phc`.
2. Confirm each spoke sees only its own patients, samples, and dispatches.
3. Register a new patient with Aadhaar and confirm only last four digits appear.
4. Try registering the same Aadhaar again and confirm duplicate warning.
5. Register or search a patient using ABHA and confirm masked ABHA display.
6. Collect a sample and print the barcode label.
7. Create a dispatch batch and print/save the manifest as PDF.
8. Login as `hub`, open incoming batch, mark one sample damaged, and receive.
9. Login as `lab`, report Negative for one sample.
10. Report Positive HPV 16 for another sample and confirm referral creation.
11. Update referral status through `PENDING_CONTACT`, `CONTACTED`, `APPOINTMENT_GIVEN`, `VISITED`, and `COMPLETED`.
12. Check dashboard totals: collected, dispatched, received, pending result, reported, positives, referral pending.
13. Confirm `audit_logs` and `outbox_events` have rows for sensitive actions.
14. Confirm `/api/integrations/lis/import`, `/api/integrations/lis/webhook`, and `/api/integrations/abdm` respond as staging endpoints only.

## Production Readiness Items Before Live Patient Use

- Replace seeded passwords.
- Add password reset and forced first-login password change.
- Approve consent wording for Aadhaar, ABHA, SMS, and phone follow-up.
- Validate DPDP Act, ABDM, and local hospital compliance requirements.
- Confirm data retention, backup, and incident response SOP.
- Add CSV exports and scanner-friendly bulk receive if needed for high-volume days.
