import { NextResponse } from 'next/server';
import { clearSession, currentUser } from '@/lib/auth';
import { auditLog } from '@/lib/audit';

export async function POST() {
  const user = await currentUser();
  await auditLog(user, 'LOGOUT', 'user', user?.id, { username: user?.username });
  await clearSession();
  return NextResponse.json({ ok: true });
}
