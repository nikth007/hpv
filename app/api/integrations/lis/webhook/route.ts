import { NextResponse } from 'next/server';
import { isDatabaseEnabled, query } from '@/lib/db';

export async function POST(request: Request) {
  const body = await request.json();

  // This endpoint is intentionally a staging receiver for future LIS/HIS integration.
  // For production, add signed webhook verification, source IP allowlist, and message replay protection.
  if (!isDatabaseEnabled) {
    return NextResponse.json({ accepted: true, mode: 'demo', message: 'Webhook accepted in demo mode; no database write performed.' });
  }

  await query(`
    INSERT INTO outbox_events(event_type, aggregate_type, aggregate_id, payload, target_system, status)
    VALUES('LIS_WEBHOOK_RECEIVED','integration',gen_random_uuid(),$1,'lis','pending')
  `, [JSON.stringify(body)]);

  return NextResponse.json({ accepted: true });
}
