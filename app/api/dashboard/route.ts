import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { isDatabaseEnabled, query } from '@/lib/db';
import { dashboardFor } from '@/lib/mock-store';

export async function GET() {
  try {
    const user = await requireUser();
    if (!isDatabaseEnabled) return NextResponse.json(dashboardFor(user));

    const centerScope = user.role === 'spoke' ? user.centerId : null;
    const counts = await query<any>(
      `SELECT
        (SELECT count(*)::int FROM patients p WHERE ($1::uuid IS NULL OR p.center_id = $1)) as "totalPatients",
        (SELECT count(DISTINCT p.id)::int FROM patients p WHERE ($1::uuid IS NULL OR p.center_id = $1)) as "uniquePatients",
        (SELECT count(*)::int FROM samples s WHERE ($1::uuid IS NULL OR s.center_id = $1)) as "totalSamples",
        (SELECT count(*)::int FROM samples s WHERE ($1::uuid IS NULL OR s.center_id = $1) AND date(s.collection_date) = current_date) as "collectedToday",
        (SELECT count(*)::int FROM samples s WHERE ($1::uuid IS NULL OR s.center_id = $1) AND s.status = 'COLLECTED') as "pendingDispatch",
        (SELECT count(*)::int FROM samples s WHERE ($1::uuid IS NULL OR s.center_id = $1) AND s.status = 'DISPATCHED') as "inTransit",
        (SELECT count(*)::int FROM samples s WHERE ($1::uuid IS NULL OR s.center_id = $1) AND s.status IN ('RECEIVED_AT_HUB','IN_PROCESS') AND NOT EXISTS (SELECT 1 FROM lab_results lr WHERE lr.sample_id = s.id)) as "receivedAtHub",
        (SELECT count(*)::int FROM samples s WHERE ($1::uuid IS NULL OR s.center_id = $1) AND s.status IN ('RECEIVED_AT_HUB','IN_PROCESS') AND NOT EXISTS (SELECT 1 FROM lab_results lr WHERE lr.sample_id = s.id)) as "pendingLabResult",
        (SELECT count(DISTINCT r.sample_id)::int FROM lab_results r JOIN samples s ON s.id = r.sample_id WHERE ($1::uuid IS NULL OR s.center_id = $1)) as "reported",
        (SELECT count(DISTINCT s.patient_id)::int FROM lab_results r JOIN samples s ON s.id = r.sample_id WHERE ($1::uuid IS NULL OR s.center_id = $1) AND r.result IN ('POSITIVE_HPV_16','POSITIVE_HPV_18','POSITIVE_OTHER_HR_HPV')) as "positivePatients",
        (SELECT count(*)::int FROM referrals r JOIN patients p ON p.id = r.patient_id WHERE ($1::uuid IS NULL OR p.center_id = $1) AND r.follow_up_status <> 'COMPLETED') as "referralPending"`,
      [centerScope]
    );

    const samplesByCenter = await query<any>(
      `SELECT c.id as "centerId", c.name as "centerName", count(s.id)::int as total
       FROM centers c
       LEFT JOIN samples s ON s.center_id = c.id
       WHERE c.center_type = 'spoke' AND ($1::uuid IS NULL OR c.id = $1)
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      [centerScope]
    );

    const dailyTrend = await query<any>(
      `SELECT to_char(day, 'YYYY-MM-DD') as day, count(s.id)::int as count
       FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') day
       LEFT JOIN samples s ON date(s.collection_date) = day::date AND ($1::uuid IS NULL OR s.center_id = $1)
       GROUP BY day
       ORDER BY day`,
      [centerScope]
    );

    const centerPerformance = await query<any>(
      `SELECT c.id as "centerId",
              c.name as "centerName",
              count(s.id)::int as collected,
              count(s.id) FILTER (WHERE s.status <> 'COLLECTED')::int as dispatched,
              count(DISTINCT s.id) FILTER (WHERE r.id IS NOT NULL)::int as reported
       FROM centers c
       LEFT JOIN samples s ON s.center_id = c.id
       LEFT JOIN lab_results r ON r.sample_id = s.id
       WHERE c.center_type = 'spoke' AND ($1::uuid IS NULL OR c.id = $1)
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      [centerScope]
    );

    const recentSamples = await query<any>(
      `SELECT s.id,
              s.sample_id as "sampleId",
              p.full_name as "patientName",
              c.name as "centerName",
              s.collection_date as "collectionDate",
              s.status
       FROM samples s
       JOIN patients p ON p.id = s.patient_id
       JOIN centers c ON c.id = s.center_id
       WHERE ($1::uuid IS NULL OR s.center_id = $1)
       ORDER BY s.created_at DESC
       LIMIT 8`,
      [centerScope]
    );

    const batches = await query<any>(
      `SELECT b.id,
              b.batch_id as "batchId",
              sc.name as "sourceCenterName",
              b.sample_count as "sampleCount",
              b.status,
              b.dispatched_at as "dispatchedAt",
              b.received_at as "receivedAt"
       FROM dispatch_batches b
       JOIN centers sc ON sc.id = b.source_center_id
       WHERE ($1::uuid IS NULL OR b.source_center_id = $1)
       ORDER BY b.created_at DESC
       LIMIT 8`,
      [centerScope]
    );

    const centers = await query<any>(
      `SELECT id, code, name, center_type as "centerType", district FROM centers WHERE active = TRUE ORDER BY center_type, name`
    );

    return NextResponse.json({
      ...counts[0],
      samplesByCenter,
      dailyTrend,
      centerPerformance,
      recentSamples,
      batches,
      centers
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
