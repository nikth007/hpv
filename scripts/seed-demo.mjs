import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing.');
  process.exit(1);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

const sql = neon(process.env.DATABASE_URL);
const passwordHash = hashPassword('welcome@123');

const centers = [
  ['IOG-EGMORE', 'IOG Hospital, Egmore', 'hub', 'Chennai'],
  ['STANLEY', 'Stanley', 'spoke', 'Chennai'],
  ['KMC', 'KMC', 'spoke', 'Chennai'],
  ['KGH-OMD', 'KGH / Omandurar Hospital', 'spoke', 'Chennai'],
  ['PHC-CHC', 'PHC / CHC centers', 'spoke', 'Chennai']
];

const users = [
  ['admin', 'Program Admin', 'admin', 'IOG-EGMORE'],
  ['hub', 'Hub Coordinator', 'hub', 'IOG-EGMORE'],
  ['lab', 'Lab User', 'lab', 'IOG-EGMORE'],
  ['stanley', 'Stanley Spoke User', 'spoke', 'STANLEY'],
  ['kmc', 'KMC Spoke User', 'spoke', 'KMC'],
  ['kgh', 'KGH Spoke User', 'spoke', 'KGH-OMD'],
  ['phc', 'PHC/CHC Spoke User', 'spoke', 'PHC-CHC']
];

async function upsertCenter([code, name, centerType, district]) {
  const rows = await sql`
    INSERT INTO centers(code, name, center_type, district)
    VALUES (${code}, ${name}, ${centerType}, ${district})
    ON CONFLICT(code) DO UPDATE
      SET name = EXCLUDED.name,
          center_type = EXCLUDED.center_type,
          district = EXCLUDED.district,
          active = TRUE,
          updated_at = now()
    RETURNING id, code
  `;
  return rows[0];
}

async function upsertUser([username, fullName, role, centerCode]) {
  const centerRows = await sql`SELECT id FROM centers WHERE code = ${centerCode}`;
  const centerId = centerRows[0]?.id ?? null;
  await sql`
    INSERT INTO users(username, full_name, role, center_id, password_hash, active)
    VALUES (${username}, ${fullName}, ${role}, ${centerId}, ${passwordHash}, TRUE)
    ON CONFLICT(username) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          center_id = EXCLUDED.center_id,
          password_hash = EXCLUDED.password_hash,
          active = TRUE,
          updated_at = now()
  `;
}

async function main() {
  for (const center of centers) await upsertCenter(center);
  for (const user of users) await upsertUser(user);
  console.log('Demo centers and users seeded. Password for all demo users: welcome@123');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
