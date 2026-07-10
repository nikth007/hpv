import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { isDatabaseEnabled, query } from '@/lib/db';
import { listReferrals, updateReferral } from '@/lib/mock-store';
import { referralUpdateSchema } from '@/lib/validators';

function referralSelect() {
  return `
    SELECT r.id,
           r.patient_id as "patientId",
           p.full_name as "patientName",
           r.sample_id as "sampleId",
           s.sample_id as "sampleCode",
           r.result,
           r.referred_to_center_id as "referredToCenterId",
           c.name as "referredToCenterName",
           r.follow_up_status as "followUpStatus",
           r.follow_up_date as "followUpDate",
           r.notes,
           r.created_at as "createdAt"
    FROM referrals r
    JOIN patients p ON p.id = r.patient_id
    LEFT JOIN samples s ON s.id = r.sample_id
    LEFT JOIN centers c ON c.id = r.referred_to_center_id
  `;
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!isDatabaseEnabled) return NextResponse.json({ referrals: listReferrals(user) });

    const params: any[] = [];
    let where = 'WHERE TRUE';
    if (user.role === 'spoke') {
      params.push(user.centerId);
      where += ` AND p.center_id = $${params.length}`;
    }

    const referrals = await query<any>(
      `${referralSelect()}
       ${where}
       ORDER BY r.created_at DESC
       LIMIT 200`,
      params
    );
    return NextResponse.json({ referrals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    if (!['admin', 'hub', 'spoke'].includes(user.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const body = referralUpdateSchema.parse(await request.json());
    if (!isDatabaseEnabled) return NextResponse.json({ referral: updateReferral(body.id, body) });

    const existing = await query<any>(
      `SELECT r.id, p.center_id FROM referrals r JOIN patients p ON p.id = r.patient_id WHERE r.id = $1 LIMIT 1`,
      [body.id]
    );
    if (!existing.length) return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    if (user.role === 'spoke' && existing[0].center_id !== user.centerId) {
      return NextResponse.json({ error: 'Referral is outside your center' }, { status: 403 });
    }

    const rows = await query<any>(
      `UPDATE referrals
       SET follow_up_status = COALESCE($1, follow_up_status),
           follow_up_date = COALESCE($2::date, follow_up_date),
           referred_to_center_id = COALESCE($3::uuid, referred_to_center_id),
           notes = COALESCE($4, notes),
           updated_by = $5,
           updated_at = now()
       WHERE id = $6
       RETURNING id`,
      [body.followUpStatus || null, body.followUpDate || null, body.referredToCenterId || null, body.notes ?? null, user.id, body.id]
    );
    const referral = (await query<any>(`${referralSelect()} WHERE r.id = $1`, [rows[0].id]))[0];
    await auditLog(user, 'REFERRAL_UPDATED', 'referral', body.id, {
      followUpStatus: body.followUpStatus,
      followUpDate: body.followUpDate
    });
    return NextResponse.json({ referral });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}
