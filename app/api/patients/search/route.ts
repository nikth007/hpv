import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { isDatabaseEnabled, query } from '@/lib/db';
import { searchPatients } from '@/lib/mock-store';
import { hashIdentifier, normalizeAadhaar, normalizeAbha } from '@/lib/crypto';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    if (!isDatabaseEnabled) {
      const matches = searchPatients(body, user);
      await auditLog(user, 'PATIENT_SEARCH_DEMO', 'patient', null, { matchCount: matches.length });
      return NextResponse.json({ matches });
    }

    const aadhaar = normalizeAadhaar(body.aadhaar);
    const abha = normalizeAbha(body.abhaNumber);
    const aadhaarHash = aadhaar ? hashIdentifier(aadhaar) : null;
    const abhaHash = abha ? hashIdentifier(abha) : null;
    const q = body.q?.trim();
    const lowerName = body.fullName?.trim().toLowerCase() || null;

    const params: any[] = [aadhaarHash, abhaHash, body.mobile || null, lowerName, body.dob || null];
    let where = `
      (($1::text IS NOT NULL AND pi.aadhaar_hash = $1)
       OR ($2::text IS NOT NULL AND pi.abha_hash = $2)
       OR ($3::text IS NOT NULL AND $4::text IS NOT NULL AND p.mobile = $3 AND lower(p.full_name) = $4 AND ($5::date IS NULL OR p.dob = $5::date))
    `;

    if (q) {
      params.push(`%${q}%`);
      where += ` OR p.full_name ILIKE $${params.length} OR p.patient_code ILIKE $${params.length} OR p.mobile ILIKE $${params.length}`;
    }
    where += ')';

    if (user.role === 'spoke' && !aadhaarHash && !abhaHash) {
      params.push(user.centerId);
      where += ` AND p.center_id = $${params.length}`;
    }

    const matches = await query<any>(
      `SELECT p.id,
              p.patient_code as "patientCode",
              p.full_name as "fullName",
              p.dob,
              p.age_years as "ageYears",
              p.mobile,
              c.name as "centerName",
              pi.aadhaar_last4 as "aadhaarLast4",
              pi.abha_number as "abhaNumber",
              p.created_at as "createdAt"
       FROM patients p
       LEFT JOIN patient_identifiers pi ON pi.patient_id = p.id
       LEFT JOIN centers c ON c.id = p.center_id
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT 10`,
      params
    );

    await auditLog(user, 'PATIENT_SEARCH', 'patient', null, {
      matchCount: matches.length,
      aadhaarProvided: Boolean(aadhaar),
      abhaProvided: Boolean(abha),
      mobileProvided: Boolean(body.mobile)
    });
    return NextResponse.json({ matches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
