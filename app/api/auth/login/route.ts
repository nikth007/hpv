import { NextResponse } from 'next/server';
import { login, setSession } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';
import { auditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.parse(body);
    const user = await login(parsed.username, parsed.password);
    if (!user) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    await setSession(user);
    await auditLog(user, 'LOGIN', 'user', user.id, { username: user.username, role: user.role });
    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 400 });
  }
}
