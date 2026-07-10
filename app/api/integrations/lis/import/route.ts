import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit';
import { requireUser, roleCan } from '@/lib/auth';
import { isDatabaseEnabled, query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!roleCan(user, 'result')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const body = await request.json();

    if (isDatabaseEnabled) {
      await query(
        `INSERT INTO outbox_events(event_type, aggregate_type, aggregate_id, payload, target_system)
         VALUES('LIS_RESULT_IMPORT_STAGED','integration',gen_random_uuid(),$1,'lis')`,
        [JSON.stringify(body)]
      );
    }

    await auditLog(user, 'LIS_RESULT_IMPORT_STAGED', 'integration', null, { itemCount: Array.isArray(body?.results) ? body.results.length : 1 });
    return NextResponse.json({
      accepted: true,
      message: 'LIS result import is staged for future activation. MVP manual result entry remains the source of truth.'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 400 });
  }
}
