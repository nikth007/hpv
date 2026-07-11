import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit';
import { requireUser, roleCan } from '@/lib/auth';
import { hashIdentifier, maskAbha, normalizeAadhaar, normalizeAbha } from '@/lib/crypto';
import { isDemoMode, query } from '@/lib/db';
import { patientCode } from '@/lib/ids';
import { createPatient } from '@/lib/mock-store';
import { patientSchema } from '@/lib/validators';

function value(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const foundKey = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === key);
    const found = foundKey ? row[foundKey] : undefined;
    if (found !== undefined && found !== null && String(found).trim() !== '') return String(found).trim();
  }
  return undefined;
}

function normalizeRow(row: Record<string, unknown>) {
  return {
    fullName: value(row, ['patient name', 'name', 'full name', 'patient_name', 'full_name']),
    dob: value(row, ['dob', 'date of birth', 'date_of_birth']),
    ageYears: value(row, ['age', 'age years', 'age_years']),
    gender: value(row, ['gender']) || 'female',
    mobile: value(row, ['mobile', 'mobile number', 'phone', 'phone number']),
    aadhaar: value(row, ['aadhaar', 'aadhaar number', 'aadhar', 'aadhar number']),
    abhaNumber: value(row, ['abha', 'abha number', 'abha_number']),
    address: value(row, ['address']),
    consent: String(value(row, ['consent', 'consent recorded']) || 'true').toLowerCase() !== 'false'
  };
}

function patientSelect() {
  return `
    SELECT p.id,
           p.patient_code as "patientCode",
           p.full_name as "fullName",
           p.dob,
           p.age_years as "ageYears",
           p.mobile,
           pi.aadhaar_last4 as "aadhaarLast4",
           pi.abha_number as "abhaNumber"
    FROM patients p
    LEFT JOIN patient_identifiers pi ON pi.patient_id = p.id
  `;
}

async function duplicateFor(body: any, aadhaarHash: string | null, abhaHash: string | null) {
  const lowerName = body.fullName.trim().toLowerCase();
  const rows = await query<any>(
    `${patientSelect()}
     WHERE ($1::text IS NOT NULL AND pi.aadhaar_hash = $1)
        OR ($2::text IS NOT NULL AND pi.abha_hash = $2)
        OR ($3::text IS NOT NULL AND p.mobile = $3 AND lower(p.full_name) = $4 AND ($5::date IS NULL OR p.dob = $5::date))
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [aadhaarHash, abhaHash, body.mobile || null, lowerName, body.dob || null]
  );
  return rows[0] || null;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!roleCan(user, 'register')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const payload = await request.json();
    const rows = Array.isArray(payload?.patients) ? payload.patients : [];
    if (!rows.length) return NextResponse.json({ error: 'No patient rows found in upload.' }, { status: 400 });
    if (rows.length > 1000) return NextResponse.json({ error: 'Upload up to 1,000 patients at a time.' }, { status: 400 });

    const summary = {
      total: rows.length,
      created: 0,
      duplicates: 0,
      failed: 0,
      errors: [] as Array<{ row: number; name?: string; message: string }>
    };

    for (const [index, rawRow] of rows.entries()) {
      const rowNumber = index + 2;
      const parsed = patientSchema.safeParse(normalizeRow(rawRow || {}));
      if (!parsed.success) {
        summary.failed += 1;
        summary.errors.push({
          row: rowNumber,
          name: String((rawRow as any)?.['Patient name'] || (rawRow as any)?.name || ''),
          message: parsed.error.issues.map((issue) => issue.message).join('; ')
        });
        continue;
      }

      const body = parsed.data;
      const aadhaar = normalizeAadhaar(body.aadhaar);
      const abha = normalizeAbha(body.abhaNumber);
      const aadhaarHash = aadhaar ? hashIdentifier(aadhaar) : null;
      const abhaHash = abha ? hashIdentifier(abha) : null;

      if (isDemoMode) {
        const result = createPatient(body, user);
        if ('duplicate' in result && result.duplicate) {
          summary.duplicates += 1;
          summary.errors.push({ row: rowNumber, name: body.fullName, message: 'Duplicate patient found' });
        } else {
          summary.created += 1;
        }
        continue;
      }

      const duplicate = await duplicateFor(body, aadhaarHash, abhaHash);
      if (duplicate) {
        summary.duplicates += 1;
        summary.errors.push({ row: rowNumber, name: body.fullName, message: `Duplicate patient found: ${duplicate.patientCode}` });
        continue;
      }

      const patientRows = await query<any>(
        `INSERT INTO patients(patient_code, full_name, dob, age_years, gender, mobile, address, center_id, consent, created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          patientCode(user.centerCode),
          body.fullName.trim(),
          body.dob || null,
          body.ageYears || null,
          body.gender || 'female',
          body.mobile,
          body.address || null,
          user.centerId,
          body.consent,
          user.id
        ]
      );

      const patientId = patientRows[0].id;
      await query(
        `INSERT INTO patient_identifiers(patient_id, aadhaar_hash, aadhaar_last4, abha_hash, abha_number)
         VALUES($1,$2,$3,$4,$5)`,
        [patientId, aadhaarHash, aadhaar ? aadhaar.slice(-4) : null, abhaHash, abha ? maskAbha(abha) : null]
      );

      summary.created += 1;
      await auditLog(user, 'PATIENT_IMPORTED', 'patient', patientId, {
        row: rowNumber,
        aadhaarStoredAsHash: Boolean(aadhaarHash),
        abhaStoredAsHash: Boolean(abhaHash)
      });
    }

    await auditLog(user, 'PATIENT_IMPORT_COMPLETED', 'patient', null, {
      total: summary.total,
      created: summary.created,
      duplicates: summary.duplicates,
      failed: summary.failed
    });

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not import patients' }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}
