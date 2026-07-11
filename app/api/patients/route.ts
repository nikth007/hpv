import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit';
import { requireUser, roleCan } from '@/lib/auth';
import { isDemoMode, query } from '@/lib/db';
import { createPatient, searchPatients } from '@/lib/mock-store';
import { patientSchema } from '@/lib/validators';
import { hashIdentifier, maskAbha, normalizeAadhaar, normalizeAbha } from '@/lib/crypto';
import { patientCode } from '@/lib/ids';

function patientSelect() {
  return `
    SELECT p.id,
           p.patient_code as "patientCode",
           p.full_name as "fullName",
           p.dob,
           p.age_years as "ageYears",
           p.gender,
           p.mobile,
           p.address,
           p.center_id as "centerId",
           c.name as "centerName",
           pi.aadhaar_last4 as "aadhaarLast4",
           pi.abha_number as "abhaNumber",
           p.created_at as "createdAt"
    FROM patients p
    LEFT JOIN patient_identifiers pi ON pi.patient_id = p.id
    LEFT JOIN centers c ON c.id = p.center_id
  `;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!roleCan(user, 'register')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const body = patientSchema.parse(await request.json());

    if (isDemoMode) {
      const result = createPatient(body, user);
      if ('duplicate' in result && result.duplicate) {
        await auditLog(user, 'PATIENT_CREATE_DEMO', 'patient', result.duplicate.id);
        return NextResponse.json({ error: 'Duplicate patient found', duplicate: result.duplicate }, { status: 409 });
      }
      await auditLog(user, 'PATIENT_CREATE_DEMO', 'patient', result.patient.id);
      return NextResponse.json(result, { status: 201 });
    }

    const aadhaar = normalizeAadhaar(body.aadhaar);
    const abha = normalizeAbha(body.abhaNumber);
    const aadhaarHash = aadhaar ? hashIdentifier(aadhaar) : null;
    const abhaHash = abha ? hashIdentifier(abha) : null;
    const lowerName = body.fullName.trim().toLowerCase();

    const duplicateRows = await query<any>(
      `${patientSelect()}
       WHERE ($1::text IS NOT NULL AND pi.aadhaar_hash = $1)
          OR ($2::text IS NOT NULL AND pi.abha_hash = $2)
          OR ($3::text IS NOT NULL AND p.mobile = $3 AND lower(p.full_name) = $4 AND ($5::date IS NULL OR p.dob = $5::date))
       ORDER BY p.created_at DESC
       LIMIT 5`,
      [aadhaarHash, abhaHash, body.mobile || null, lowerName, body.dob || null]
    );

    if (duplicateRows.length) {
      await auditLog(user, 'PATIENT_DUPLICATE_BLOCKED', 'patient', duplicateRows[0].id, {
        matchCount: duplicateRows.length,
        aadhaarProvided: Boolean(aadhaar),
        abhaProvided: Boolean(abha)
      });
      return NextResponse.json({ error: 'Duplicate patient found', duplicate: duplicateRows[0], matches: duplicateRows }, { status: 409 });
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
        body.mobile || null,
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

    const rows = await query<any>(`${patientSelect()} WHERE p.id = $1`, [patientId]);
    await auditLog(user, 'PATIENT_CREATED', 'patient', patientId, {
      centerId: user.centerId,
      aadhaarStoredAsHash: Boolean(aadhaarHash),
      abhaStoredAsHash: Boolean(abhaHash)
    });
    return NextResponse.json({ patient: rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not create patient' }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || undefined;
    if (isDemoMode) return NextResponse.json({ patients: searchPatients({ q }, user) });

    const params: any[] = [];
    let where = 'WHERE TRUE';
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (p.full_name ILIKE $${params.length} OR p.patient_code ILIKE $${params.length} OR p.mobile ILIKE $${params.length})`;
    }
    if (user.role === 'spoke') {
      params.push(user.centerId);
      where += ` AND p.center_id = $${params.length}`;
    }
    const patients = await query<any>(`${patientSelect()} ${where} ORDER BY p.created_at DESC LIMIT 50`, params);
    return NextResponse.json({ patients });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
