import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env.local or set it in your shell.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

async function main() {
  const statements = schema
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log(`Schema created/updated (${statements.length} statements). Now run: npm run db:seed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
