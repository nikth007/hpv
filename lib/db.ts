import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const explicitDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const isVercelDeployment = Boolean(process.env.VERCEL);

export const isDatabaseEnabled = Boolean(databaseUrl && databaseUrl.startsWith('postgres') && !explicitDemoMode);
export const isDemoMode = explicitDemoMode || (!isVercelDeployment && !databaseUrl);
export const databaseConfigError = !isDatabaseEnabled && !isDemoMode
  ? 'Database is not configured for this deployment. Add DATABASE_URL in Vercel and redeploy.'
  : null;

export const sql = isDatabaseEnabled ? neon(databaseUrl!) : null;

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  if (!sql) throw new Error(databaseConfigError || 'DATABASE_URL is not configured.');
  // Neon supports the query(text, params) call pattern for parameterized SQL.
  return (await sql.query(text, params)) as T[];
}

export function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
