import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { isDatabaseEnabled, query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!['admin', 'hub'].includes(user.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const body = await request.json();

    if (isDatabaseEnabled) {
      await query(
        `INSERT INTO outbox_events(event_type, aggregate_type, aggregate_id, payload, target_system)
         VALUES('ABDM_ABHA_LINK_STAGED','integration',gen_random_uuid(),$1,'abdm')`,
        [JSON.stringify(body)]
      );
    }

    await auditLog(user, 'ABDM_ABHA_LINK_STAGED', 'integration', null, { patientId: body?.patientId });
    return NextResponse.json({
      accepted: true,
      message: 'ABDM/ABHA integration is prepared but not activated in this MVP.'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}
