import { cookies } from 'next/headers';
import { query, isDatabaseEnabled } from './db';
import { getDemoUser } from './mock-store';
import { signPayload, verifyPassword, verifySignedPayload } from './crypto';
import type { Role, SessionUser } from './types';

const COOKIE_NAME = 'hpv_session';

export async function login(username: string, password: string): Promise<SessionUser | null> {
  if (!isDatabaseEnabled) {
    const demo = getDemoUser(username);
    if (!demo || !verifyPassword(password, demo.passwordHash)) return null;
    const { passwordHash, ...user } = demo;
    return user;
  }

  const rows = await query<any>(`
    SELECT u.id, u.username, u.full_name as "fullName", u.role, u.center_id as "centerId",
           u.password_hash as "passwordHash", c.code as "centerCode", c.name as "centerName", c.center_type as "centerType"
    FROM users u
    LEFT JOIN centers c ON c.id = u.center_id
    WHERE lower(u.username) = lower($1) AND u.active = TRUE
    LIMIT 1
  `, [username]);
  const row = rows[0];
  if (!row || !verifyPassword(password, row.passwordHash)) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    centerId: row.centerId,
    centerCode: row.centerCode,
    centerName: row.centerName,
    centerType: row.centerType
  };
}

export async function setSession(user: SessionUser) {
  const token = signPayload({ user, exp: Date.now() + 1000 * 60 * 60 * 12 });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === 'production'
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const payload = verifySignedPayload<{ user: SessionUser; exp: number }>(token);
  return payload?.user ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export function roleCan(user: SessionUser, action: 'register' | 'collect' | 'batch' | 'receive' | 'result' | 'admin') {
  if (action === 'admin') return user.role === 'admin';
  if (user.role === 'admin') return true;
  if (action === 'register' || action === 'collect' || action === 'batch') return user.role === 'spoke' || user.role === 'hub';
  if (action === 'receive') return user.role === 'hub';
  if (action === 'result') return user.role === 'lab';
  return false;
}

export function roleLabel(role?: Role) {
  if (role === 'admin') return 'Admin';
  if (role === 'hub') return 'Hub';
  if (role === 'lab') return 'Lab';
  if (role === 'spoke') return 'Spoke';
  return 'User';
}

export function centerScopeWhere(user: SessionUser, tableAlias: string, params: any[]) {
  if (user.role !== 'spoke') return '';
  params.push(user.centerId);
  return ` AND ${tableAlias}.center_id = $${params.length}`;
}
