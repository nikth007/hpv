import { NextResponse } from 'next/server';
import { auditLog, outboxEvent } from '@/lib/audit';
import { requireUser, roleCan } from '@/lib/auth';
import { isDemoMode, query } from '@/lib/db';
import { createResult, listResults } from '@/lib/mock-store';
import { resultSchema } from '@/lib/validators';

function isPositive(result: string) {
  return result === 'POSITIVE_HPV_16' || result === 'POSITIVE_HPV_18' || result === 'POSITIVE_OTHER_HR_HPV';
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!roleCan(user, 'result')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const body = resultSchema.parse(await request.json());
    if (isDemoMode) return NextResponse.json({ result: createResult(body, user) }, { status: 201 });

    const sampleRows = await query<any>(
      `SELECT s.id, s.patient_id, s.status, s.sample_id
       FROM samples s
       WHERE s.id::text = $1 OR s.sample_id = $1
       LIMIT 1`,
      [body.sampleId]
    );
    if (!sampleRows.length) return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
    const sample = sampleRows[0];
    if (!['RECEIVED_AT_HUB', 'IN_PROCESS', 'REPORTED', 'REFERRED'].includes(sample.status)) {
      return NextResponse.json({ error: 'Sample must be received at hub before result entry' }, { status: 400 });
    }

    const resultRows = await query<any>(
      `INSERT INTO lab_results(sample_id, result, remarks, reported_by)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(sample_id) DO UPDATE
         SET result = EXCLUDED.result,
             remarks = EXCLUDED.remarks,
             reported_by = EXCLUDED.reported_by,
             reported_at = now(),
             updated_at = now()
       RETURNING id,
                 sample_id as "sampleId",
                 result,
                 remarks,
                 reported_at as "reportedAt"`,
      [sample.id, body.result, body.remarks || null, user.id]
    );
    const result = resultRows[0];
    await query(`UPDATE samples SET status = $1, updated_at = now() WHERE id = $2`, [isPositive(body.result) ? 'REFERRED' : 'REPORTED', sample.id]);

    if (isPositive(body.result)) {
      const existing = await query<any>(`SELECT id FROM referrals WHERE sample_id = $1 LIMIT 1`, [sample.id]);
      if (!existing.length) {
        const hubRows = await query<any>(`SELECT id FROM centers WHERE center_type = 'hub' ORDER BY created_at LIMIT 1`);
        const referralRows = await query<any>(
          `INSERT INTO referrals(patient_id, sample_id, lab_result_id, result, referred_to_center_id, follow_up_status, created_by)
           VALUES($1,$2,$3,$4,$5,'PENDING_CONTACT',$6)
           RETURNING id`,
          [sample.patient_id, sample.id, result.id, body.result, hubRows[0]?.id ?? user.centerId, user.id]
        );
        await auditLog(user, 'POSITIVE_REFERRAL_CREATED', 'referral', referralRows[0].id, { sampleId: sample.id, result: body.result });
        await outboxEvent('POSITIVE_REFERRAL_CREATED', 'referral', referralRows[0].id, { sampleId: sample.id, result: body.result });
      }
    }

    await auditLog(user, 'RESULT_REPORTED', 'lab_result', result.id, { sampleId: sample.id, result: body.result });
    await outboxEvent('RESULT_REPORTED', 'sample', sample.id, { ...result, sampleCode: sample.sample_id });
    return NextResponse.json({ result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    if (isDemoMode) return NextResponse.json({ results: listResults(user) });
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || undefined;
    const resultFilter = url.searchParams.get('result') || undefined;
    const params: any[] = [];
    let where = 'WHERE TRUE';
    if (user.role === 'spoke') {
      params.push(user.centerId);
      where += ` AND s.center_id = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (s.sample_id ILIKE $${params.length} OR p.full_name ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }
    if (resultFilter) {
      params.push(resultFilter);
      where += ` AND r.result = $${params.length}`;
    }
    const results = await query<any>(
      `SELECT r.id,
              r.sample_id as "sampleId",
              s.sample_id as "sampleCode",
              p.full_name as "patientName",
              c.name as "centerName",
              r.result,
              r.remarks,
              r.reported_at as "reportedAt"
       FROM lab_results r
       JOIN samples s ON s.id = r.sample_id
       JOIN patients p ON p.id = s.patient_id
       JOIN centers c ON c.id = s.center_id
       ${where}
       ORDER BY r.reported_at DESC
       LIMIT 200`,
      params
    );
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
