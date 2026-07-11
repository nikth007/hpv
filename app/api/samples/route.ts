import { NextResponse } from 'next/server';
import { auditLog, outboxEvent } from '@/lib/audit';
import { requireUser, roleCan } from '@/lib/auth';
import { isDemoMode, query } from '@/lib/db';
import { createSample, listSamples } from '@/lib/mock-store';
import { sampleSchema } from '@/lib/validators';
import { sampleBarcode } from '@/lib/ids';

function sampleSelect() {
  return `
    SELECT s.id,
           s.sample_id as "sampleId",
           s.patient_id as "patientId",
           p.full_name as "patientName",
           pi.aadhaar_last4 as "aadhaarLast4",
           s.center_id as "centerId",
           c.name as "centerName",
           s.collection_mode as "collectionMode",
           s.collection_date as "collectionDate",
           s.status,
           s.condition_status as "conditionStatus"
    FROM samples s
    JOIN patients p ON p.id = s.patient_id
    LEFT JOIN patient_identifiers pi ON pi.patient_id = p.id
    JOIN centers c ON c.id = s.center_id
  `;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!roleCan(user, 'collect')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const body = sampleSchema.parse(await request.json());
    if (isDemoMode) {
      const sample = createSample(body, user);
      return NextResponse.json({ sample }, { status: 201 });
    }

    const patientRows = await query<any>(`SELECT id, center_id FROM patients WHERE id = $1 LIMIT 1`, [body.patientId]);
    if (!patientRows.length) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    if (user.role === 'spoke' && patientRows[0].center_id !== user.centerId) {
      return NextResponse.json({ error: 'Patient is outside your center' }, { status: 403 });
    }

    const rows = await query<any>(
      `INSERT INTO samples(sample_id, patient_id, center_id, collection_mode, collected_by)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id`,
      [sampleBarcode(user.centerCode), body.patientId, user.centerId, body.collectionMode, user.id]
    );

    const sampleId = rows[0].id;
    const sampleRows = await query<any>(`${sampleSelect()} WHERE s.id = $1`, [sampleId]);
    await auditLog(user, 'SAMPLE_CREATED', 'sample', sampleId, { sampleId: sampleRows[0].sampleId, patientId: body.patientId });
    await outboxEvent('SAMPLE_COLLECTED', 'sample', sampleId, sampleRows[0]);
    return NextResponse.json({ sample: sampleRows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not create sample' }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || undefined;
    const labPending = url.searchParams.get('labPending') === 'true';
    if (isDemoMode) return NextResponse.json({ samples: listSamples(user, { id, labPending }) });

    const params: any[] = [];
    let where = 'WHERE TRUE';
    if (id) {
      params.push(id);
      where += ` AND (s.id::text = $${params.length} OR s.sample_id = $${params.length})`;
    }
    if (labPending) {
      where += ` AND s.status IN ('RECEIVED_AT_HUB','IN_PROCESS')`;
      where += ` AND NOT EXISTS (SELECT 1 FROM lab_results lr WHERE lr.sample_id = s.id)`;
    }
    if (user.role === 'spoke') {
      params.push(user.centerId);
      where += ` AND s.center_id = $${params.length}`;
    }

    const samples = await query<any>(`${sampleSelect()} ${where} ORDER BY s.created_at DESC LIMIT 200`, params);
    return NextResponse.json({ samples });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
