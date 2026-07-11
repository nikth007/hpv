import { NextResponse } from 'next/server';
import { auditLog, outboxEvent } from '@/lib/audit';
import { requireUser, roleCan } from '@/lib/auth';
import { isDatabaseEnabled, query } from '@/lib/db';
import { receiveBatch } from '@/lib/mock-store';
import { receiveBatchSchema } from '@/lib/validators';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (!roleCan(user, 'receive')) return NextResponse.json({ error: 'Only hub users can receive batches' }, { status: 403 });
    const { id } = await params;
    const body = receiveBatchSchema.parse(await request.json().catch(() => ({})));
    if (!isDatabaseEnabled) return NextResponse.json({ batch: receiveBatch(id, body) });

    const batchRows = await query<any>(
      `SELECT id, status FROM dispatch_batches WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!batchRows.length) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    if (batchRows[0].status !== 'DISPATCHED') {
      return NextResponse.json({ error: 'This batch has already been received.' }, { status: 409 });
    }

    const links = await query<any>(
      `SELECT sample_id as "sampleId" FROM dispatch_batch_samples WHERE dispatch_batch_id = $1`,
      [id]
    );
    if (!links.length) return NextResponse.json({ error: 'Batch has no samples' }, { status: 404 });

    const missing = new Set(body.missingSampleIds);
    const damaged = new Set(body.damagedSampleIds);
    for (const link of links) {
      const sampleId = link.sampleId;
      if (missing.has(sampleId)) {
        await query(
          `UPDATE dispatch_batch_samples SET receive_status = 'MISSING' WHERE dispatch_batch_id = $1 AND sample_id = $2`,
          [id, sampleId]
        );
        await query(`UPDATE samples SET condition_status = 'MISSING', updated_at = now() WHERE id = $1 AND status = 'DISPATCHED'`, [sampleId]);
      } else if (damaged.has(sampleId)) {
        await query(
          `UPDATE dispatch_batch_samples SET receive_status = 'DAMAGED' WHERE dispatch_batch_id = $1 AND sample_id = $2`,
          [id, sampleId]
        );
        await query(`UPDATE samples SET status = 'RECEIVED_AT_HUB', condition_status = 'DAMAGED', updated_at = now() WHERE id = $1 AND status = 'DISPATCHED'`, [sampleId]);
      } else {
        await query(
          `UPDATE dispatch_batch_samples SET receive_status = 'RECEIVED' WHERE dispatch_batch_id = $1 AND sample_id = $2`,
          [id, sampleId]
        );
        await query(`UPDATE samples SET status = 'RECEIVED_AT_HUB', condition_status = 'OK', updated_at = now() WHERE id = $1 AND status = 'DISPATCHED'`, [sampleId]);
      }
    }

    const status = body.missingSampleIds.length || body.damagedSampleIds.length ? 'PARTIALLY_RECEIVED' : 'RECEIVED';
    const updatedBatchRows = await query<any>(
      `UPDATE dispatch_batches
       SET status = $1, received_at = now(), received_by = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, batch_id as "batchId", status, received_at as "receivedAt"`,
      [status, user.id, id]
    );
    if (!updatedBatchRows.length) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    await auditLog(user, 'BATCH_RECEIVED', 'dispatch_batch', id, {
      status,
      missingCount: body.missingSampleIds.length,
      damagedCount: body.damagedSampleIds.length
    });
    await outboxEvent('BATCH_RECEIVED', 'dispatch_batch', id, updatedBatchRows[0]);
    return NextResponse.json({ batch: updatedBatchRows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}
