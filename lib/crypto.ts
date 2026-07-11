import crypto from 'node:crypto';

function normalizeIdentifier(value: string) {
  return value.replace(/\s|-/g, '').trim().toLowerCase();
}

const runtimeSecrets = globalThis as typeof globalThis & {
  __hpvDemoSessionSecret?: string;
  __hpvDemoIdentifierPepper?: string;
};

function demoSecret(name: '__hpvDemoSessionSecret' | '__hpvDemoIdentifierPepper') {
  runtimeSecrets[name] ??= crypto.randomBytes(32).toString('hex');
  return runtimeSecrets[name]!;
}

function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || (!process.env.VERCEL && !process.env.DATABASE_URL);
}

function requiredSecret(envName: 'SESSION_SECRET' | 'IDENTIFIER_PEPPER') {
  const value = process.env[envName];
  if (value && value.length >= 32) return value;
  if (isDemoMode()) {
    return envName === 'SESSION_SECRET'
      ? demoSecret('__hpvDemoSessionSecret')
      : demoSecret('__hpvDemoIdentifierPepper');
  }
  throw new Error(`${envName} must be configured with a long random value.`);
}

export function hashIdentifier(value?: string | null) {
  if (!value) return null;
  const normalized = normalizeIdentifier(value);
  if (!normalized) return null;
  const pepper = requiredSecret('IDENTIFIER_PEPPER');
  return crypto.createHmac('sha256', pepper).update(normalized).digest('hex');
}

export function maskAadhaar(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

export function maskAbha(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `XX-XXXX-XXXX-${digits.slice(-4)}`;
}

export function normalizeAadhaar(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 ? digits : null;
}

export function normalizeAbha(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith('demo:')) {
    return storedHash === `demo:${password}`;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function signPayload(payload: object) {
  const secret = requiredSecret('SESSION_SECRET');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySignedPayload<T = any>(token?: string | null): T | null {
  if (!token || !token.includes('.')) return null;
  const secret = requiredSecret('SESSION_SECRET');
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed as T;
  } catch {
    return null;
  }
}
