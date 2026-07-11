import { NextResponse } from 'next/server';
import { auditLog, outboxEvent } from '@/lib/audit';
import { requireUser, roleCan } from '@/lib/auth';
import { isDemoMode, query } from '@/lib/db';
import { createBatch, listBatches } from '@/lib/mock-store';
import { batchSchema } from '@/lib/validators';
import { batchCode } from '@/lib/ids';

function batchSelect() {
  return `
    SELECT b.id,
           b.batch_id as "batchId",
           b.source_center_id as "sourceCenterId",
           sc.name as "sourceCenterName",
           b.hub_center_id as "hubCenterId",
           hc.name as "hubCenterName",
           b.status,
           b.sample_count as "sampleCount",
           b.courier_name as "courierName",
           b.dispatched_at as "dispatchedAt",
           b.received_at as "receivedAt",
           b.created_at as "createdAt",
           COALESCE(
             json_agg(
               json_build_object(
                 'id', s.id,
                 'sampleId', s.sample_id,
                 'patientName', p.full_name,
                 'status', s.status,
                 'conditionStatus', s.condition_status,
                 'receiveStatus', dbs.receive_status
               )
               ORDER BY s.sample_id
             ) FILTER (WHERE s.id IS NOT NULL),
             '[]'::json
           ) as samples
    FROM dispatch_batches b
    JOIN centers sc ON sc.id = b.source_center_id
    JOIN centers hc ON hc.id = b.hub_center_id
    LEFT JOIN dispatch_batch_samples dbs ON dbs.dispatch_batch_id = b.id
    LEFT JOIN samples s ON s.id = dbs.sample_id
    LEFT JOIN patients p ON p.id = s.patient_id
  `;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!roleCan(user, 'batch')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const body = batchSchema.parse(await request.json());
    if (isDemoMode) return NextResponse.json({ batch: createBatch(body, user) }, { status: 201 });

    const hubRows = await query<any>(`SELECT id FROM centers WHERE center_type = 'hub' AND active = TRUE ORDER BY created_at LIMIT 1`);
    const hubId = hubRows[0]?.id;
    if (!hubId) return NextResponse.json({ error: 'Hub center is not configured' }, { status: 400 });

    const eligible = await query<any>(
      `SELECT id FROM samples WHERE id = ANY($1::uuid[]) AND status = 'COLLECTED' AND center_id = $2`,
      [body.sampleIds, user.centerId]
    );
    if (!eligible.length) return NextResponse.json({ error: 'No eligible collected samples selected' }, { status: 400 });

    const batchRows = await query<any>(
      `INSERT INTO dispatch_batches(batch_id, source_center_id, hub_center_id, status, sample_count, courier_name, dispatched_by)
       VALUES($1,$2,$3,'DISPATCHED',$4,$5,$6)
       RETURNING id`,
      [batchCode(user.centerCode), user.centerId, hubId, eligible.length, body.courierName || null, user.id]
    );
    const batchId = batchRows[0].id;

    for (const row of eligible) {
      await query(`INSERT INTO dispatch_batch_samples(dispatch_batch_id, sample_id) VALUES($1,$2)`, [batchId, row.id]);
    }
    await query(`UPDATE samples SET status = 'DISPATCHED', updated_at = now() WHERE id = ANY($1::uuid[])`, [eligible.map((row) => row.id)]);

    const batch = (await query<any>(
      `${batchSelect()} WHERE b.id = $1
       GROUP BY b.id, sc.name, hc.name`,
      [batchId]
    ))[0];
    await auditLog(user, 'BATCH_DISPATCHED', 'dispatch_batch', batchId, { batchId: batch.batchId, sampleCount: eligible.length });
    await outboxEvent('BATCH_DISPATCHED', 'dispatch_batch', batchId, batch);
    return NextResponse.json({ batch }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not create batch' }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const receivePending = url.searchParams.get('receivePending') === 'true';
    const status = url.searchParams.get('status') || undefined;
    const q = url.searchParams.get('q') || undefined;
    if (isDemoMode) return NextResponse.json({ batches: listBatches(user, { receivePending }) });
    const params: any[] = [];
    let where = 'WHERE TRUE';
    if (receivePending) {
      where += ` AND b.status = 'DISPATCHED'`;
    }
    if (status) {
      params.push(status);
      where += ` AND b.status = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (b.batch_id ILIKE $${params.length} OR sc.name ILIKE $${params.length})`;
    }
    if (user.role === 'spoke') {
      params.push(user.centerId);
      where += ` AND b.source_center_id = $${params.length}`;
    }
    const batches = await query<any>(
      `${batchSelect()}
       ${where}
       GROUP BY b.id, sc.name, hc.name
       ORDER BY b.created_at DESC
       LIMIT 100`,
      params
    );
    return NextResponse.json({ batches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
