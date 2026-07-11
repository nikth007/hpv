import { NextResponse } from 'next/server';
import { databaseConfigError, isDatabaseEnabled, isDemoMode, query } from '@/lib/db';

export async function GET() {
  if (databaseConfigError) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'misconfigured',
        database: 'missing',
        error: databaseConfigError
      },
      { status: 500 }
    );
  }

  if (isDemoMode) {
    return NextResponse.json({
      ok: true,
      mode: 'demo',
      database: 'not used'
    });
  }

  if (!isDatabaseEnabled) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'misconfigured',
        database: 'disabled'
      },
      { status: 500 }
    );
  }

  const rows = await query<{ patients: number }>(`SELECT count(*)::int as patients FROM patients`);
  return NextResponse.json({
    ok: true,
    mode: 'database',
    database: 'connected',
    patients: rows[0]?.patients ?? 0
  });
}
