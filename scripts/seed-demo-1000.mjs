import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing.');
  process.exit(1);
}

if (!process.env.IDENTIFIER_PEPPER || process.env.IDENTIFIER_PEPPER.length < 32) {
  console.error('IDENTIFIER_PEPPER is required for safe demo patient identifier hashes.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const names = ['Anitha', 'Bhuvana', 'Chitra', 'Deepa', 'Eswari', 'Farida', 'Geetha', 'Hemalatha', 'Indira', 'Jayanthi', 'Kavitha', 'Lakshmi', 'Meena', 'Nalini', 'Padma', 'Revathi', 'Selvi', 'Uma', 'Valli', 'Yasmin'];
const surnames = ['R', 'S', 'Kumar', 'Devi', 'Nagaraj', 'M', 'Prasad', 'Begum', 'Rajan', 'Sekar'];
const spokeCodes = ['STANLEY', 'KMC', 'KGH-OMD', 'PHC-CHC'];
const results = ['NEGATIVE', 'POSITIVE_HPV_16', 'POSITIVE_HPV_18', 'POSITIVE_OTHER_HR_HPV', 'INVALID_REPEAT_REQUIRED'];

function hmac(value) {
  return crypto.createHmac('sha256', process.env.IDENTIFIER_PEPPER).update(String(value).toLowerCase()).digest('hex');
}

function code(prefix, centerCode, index) {
  return `${prefix}-${centerCode}-${String(index).padStart(5, '0')}`;
}

function aadhaarFor(index) {
  return `70000000${String(index).padStart(4, '0')}`;
}

function abhaFor(index) {
  return `9100000000${String(index).padStart(4, '0')}`;
}

function isoDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function isPositive(result) {
  return result.startsWith('POSITIVE');
}

async function centerByCode(codeValue) {
  const rows = await sql`SELECT id, code, name FROM centers WHERE code = ${codeValue}`;
  if (!rows[0]) throw new Error(`Center not found: ${codeValue}. Run npm run db:seed first.`);
  return rows[0];
}

async function userByName(username) {
  const rows = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (!rows[0]) throw new Error(`User not found: ${username}. Run npm run db:seed first.`);
  return rows[0];
}

async function main() {
  const hub = await centerByCode('IOG-EGMORE');
  const labUser = await userByName('lab');
  const adminUser = await userByName('admin');
  const centers = {};
  for (const centerCode of spokeCodes) centers[centerCode] = await centerByCode(centerCode);

  const batchByCenter = {};
  for (const centerCode of spokeCodes) {
    const center = centers[centerCode];
    const rows = await sql`
      INSERT INTO dispatch_batches(batch_id, source_center_id, hub_center_id, status, sample_count, courier_name, dispatched_by)
      VALUES (${code('BATCH', center.code, 1)}, ${center.id}, ${hub.id}, 'DISPATCHED', 0, 'Demo transport', ${adminUser.id})
      ON CONFLICT(batch_id) DO UPDATE SET source_center_id = EXCLUDED.source_center_id
      RETURNING id
    `;
    batchByCenter[centerCode] = rows[0].id;
  }

  for (let i = 1; i <= 1000; i += 1) {
    const centerCode = spokeCodes[(i - 1) % spokeCodes.length];
    const center = centers[centerCode];
    const fullName = `${names[i % names.length]} ${surnames[i % surnames.length]}`;
    const aadhaar = aadhaarFor(i);
    const abha = abhaFor(i);
    const dob = `${1975 + (i % 28)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`;
    const mobile = `9${String(100000000 + i).slice(-9)}`;
    const patientCode = code('PT', center.code, i);
    const sampleCode = code('HPV', center.code, i);

    const patientRows = await sql`
      INSERT INTO patients(patient_code, full_name, dob, age_years, gender, mobile, address, center_id, consent, created_by, created_at)
      VALUES (${patientCode}, ${fullName}, ${dob}, ${48 + (i % 12)}, 'female', ${mobile}, ${`Ward ${i % 50}, Chennai`}, ${center.id}, TRUE, ${adminUser.id}, ${isoDate(i % 30)})
      ON CONFLICT(patient_code) DO UPDATE SET full_name = EXCLUDED.full_name, mobile = EXCLUDED.mobile
      RETURNING id
    `;
    const patientId = patientRows[0].id;

    await sql`
      INSERT INTO patient_identifiers(patient_id, aadhaar_hash, aadhaar_last4, abha_hash, abha_number)
      VALUES (${patientId}, ${hmac(aadhaar)}, ${aadhaar.slice(-4)}, ${hmac(abha)}, ${`XX-XXXX-XXXX-${abha.slice(-4)}`})
      ON CONFLICT(patient_id) DO UPDATE
        SET aadhaar_hash = EXCLUDED.aadhaar_hash,
            aadhaar_last4 = EXCLUDED.aadhaar_last4,
            abha_hash = EXCLUDED.abha_hash,
            abha_number = EXCLUDED.abha_number,
            updated_at = now()
    `;

    const status = i % 10 === 0 ? 'REFERRED' : i % 5 === 0 ? 'REPORTED' : i % 4 === 0 ? 'RECEIVED_AT_HUB' : i % 3 === 0 ? 'DISPATCHED' : 'COLLECTED';
    const sampleRows = await sql`
      INSERT INTO samples(sample_id, patient_id, center_id, collection_mode, collection_date, collected_by, status)
      VALUES (${sampleCode}, ${patientId}, ${center.id}, 'PROVIDER_COLLECTED', ${isoDate(i % 21)}, ${adminUser.id}, ${status})
      ON CONFLICT(sample_id) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `;
    const sampleId = sampleRows[0].id;

    if (status !== 'COLLECTED') {
      await sql`
        INSERT INTO dispatch_batch_samples(dispatch_batch_id, sample_id, receive_status)
        VALUES (${batchByCenter[centerCode]}, ${sampleId}, ${status === 'DISPATCHED' ? 'PENDING' : 'RECEIVED'})
        ON CONFLICT(dispatch_batch_id, sample_id) DO UPDATE SET receive_status = EXCLUDED.receive_status
      `;
    }

    if (status === 'REPORTED' || status === 'REFERRED') {
      const result = status === 'REFERRED' ? results[1 + (i % 3)] : 'NEGATIVE';
      const resultRows = await sql`
        INSERT INTO lab_results(sample_id, result, remarks, reported_by, reported_at)
        VALUES (${sampleId}, ${result}, 'Demo seeded result', ${labUser.id}, ${isoDate(i % 14)})
        ON CONFLICT(sample_id) DO UPDATE SET result = EXCLUDED.result, reported_at = EXCLUDED.reported_at
        RETURNING id
      `;
      if (isPositive(result)) {
        await sql`
          INSERT INTO referrals(patient_id, sample_id, lab_result_id, result, referred_to_center_id, follow_up_status, created_by)
          VALUES (${patientId}, ${sampleId}, ${resultRows[0].id}, ${result}, ${hub.id}, 'PENDING_CONTACT', ${labUser.id})
          ON CONFLICT DO NOTHING
        `;
      }
    }
  }

  for (const centerCode of spokeCodes) {
    const batchId = batchByCenter[centerCode];
    await sql`
      UPDATE dispatch_batches
      SET sample_count = (SELECT count(*)::int FROM dispatch_batch_samples WHERE dispatch_batch_id = ${batchId}),
          status = 'DISPATCHED',
          updated_at = now()
      WHERE id = ${batchId}
    `;
  }

  console.log('Seeded 1,000 demo patients with samples, dispatch links, lab results, and referrals.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
