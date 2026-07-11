'use client';

import { Download, FileSpreadsheet, Printer, Save, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import type { SessionUser } from '@/lib/types';

type ImportSummary = {
  total: number;
  created: number;
  duplicates: number;
  failed: number;
  errors: Array<{ row: number; name?: string; message: string }>;
};

function RequiredMark() {
  return <span aria-label="required" className="required-mark">*</span>;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function rowsToObjects(rows: string[][]) {
  const headerIndex = rows.findIndex((row) => row.some(Boolean));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((header) => header.trim());
  return rows.slice(headerIndex + 1)
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeImportCell(header, row[index] || '')])));
}

function normalizeImportCell(header: string, value: string) {
  const trimmed = String(value || '').trim();
  const normalizedHeader = header.toLowerCase();
  if ((normalizedHeader === 'dob' || normalizedHeader.includes('date of birth')) && /^\d{5}$/.test(trimmed)) {
    const date = new Date(Math.round((Number(trimmed) - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  return trimmed;
}

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

async function inflateRaw(data: Uint8Array) {
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipXlsx(bytes: Uint8Array) {
  const decoder = new TextDecoder();
  const files = new Map<string, string>();
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Could not read Excel file.');

  const entries = u16(bytes, eocd + 10);
  let offset = u32(bytes, eocd + 16);
  for (let i = 0; i < entries; i += 1) {
    if (u32(bytes, offset) !== 0x02014b50) break;
    const method = u16(bytes, offset + 10);
    const compressedSize = u32(bytes, offset + 20);
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    const localHeaderOffset = u32(bytes, offset + 42);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)).replace(/\\/g, '/');

    const localNameLength = u16(bytes, localHeaderOffset + 26);
    const localExtraLength = u16(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const fileBytes = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
    if (fileBytes) files.set(name, decoder.decode(fileBytes));

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function colIndex(ref: string) {
  const letters = ref.replace(/[0-9]/g, '').toUpperCase();
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, index - 1);
}

async function parseXlsx(file: File) {
  const files = await unzipXlsx(new Uint8Array(await file.arrayBuffer()));
  const workbook = parseXml(files.get('xl/workbook.xml') || '');
  const rels = parseXml(files.get('xl/_rels/workbook.xml.rels') || '');
  const firstSheet = workbook.getElementsByTagName('sheet')[0];
  const relId = firstSheet?.getAttribute('r:id') || firstSheet?.getAttribute('id');
  const relationship = Array.from(rels.getElementsByTagName('Relationship')).find((rel) => rel.getAttribute('Id') === relId);
  const target = relationship?.getAttribute('Target') || 'worksheets/sheet1.xml';
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  const sharedStrings = Array.from(parseXml(files.get('xl/sharedStrings.xml') || '<sst />').getElementsByTagName('si'))
    .map((si) => Array.from(si.getElementsByTagName('t')).map((t) => t.textContent || '').join(''));
  const sheet = parseXml(files.get(sheetPath) || files.get('xl/worksheets/sheet1.xml') || '');
  const rows = Array.from(sheet.getElementsByTagName('row')).map((rowEl) => {
    const row: string[] = [];
    Array.from(rowEl.getElementsByTagName('c')).forEach((cell) => {
      const ref = cell.getAttribute('r') || '';
      const index = colIndex(ref);
      const type = cell.getAttribute('t');
      let text = '';
      if (type === 'inlineStr') text = cell.getElementsByTagName('t')[0]?.textContent || '';
      else {
        const value = cell.getElementsByTagName('v')[0]?.textContent || '';
        text = type === 's' ? sharedStrings[Number(value)] || '' : value;
      }
      row[index] = text;
    });
    return row;
  });
  return rowsToObjects(rows);
}

async function parsePatientFile(file: File) {
  if (file.name.toLowerCase().endsWith('.xlsx')) return parseXlsx(file);
  return rowsToObjects(parseCsv(await file.text()));
}

export default function RegisterPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [form, setForm] = useState<any>({ gender: 'female', consent: true });
  const [matches, setMatches] = useState<any[]>([]);
  const [message, setMessage] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((data) => setUser(data.user));
  }, []);

  function set(key: string, value: any) {
    setForm((current: any) => ({ ...current, [key]: value }));
  }

  async function search() {
    setMessage(null);
    const res = await fetch('/api/patients/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setMatches(data.matches || []);
    if (!res.ok) return setMessage({ type: 'error', text: data.error || 'Search failed' });
    setMessage(data.matches?.length ? { type: 'error', text: 'Existing or possible duplicate patient found.' } : { type: 'success', text: 'No matching patient found.' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMatches(data.matches || (data.duplicate ? [data.duplicate] : []));
      return setMessage({ type: 'error', text: data.error || 'Registration failed' });
    }
    setMatches([data.patient]);
    setMessage({ type: 'success', text: `Patient registered: ${data.patient.patientCode}` });
  }

  async function collectSample(patientId: string) {
    setMessage(null);
    const res = await fetch('/api/samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, collectionMode: 'PROVIDER_COLLECTED' })
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ type: 'error', text: data.error || 'Could not create sample' });
    setMessage({
      type: 'success',
      text: `Sample created: ${data.sample.sampleId}`,
      sample: data.sample
    });
  }

  function downloadTemplate() {
    const csv = [
      'Patient name,Mobile number,DOB,Age,Aadhaar number,ABHA number,Gender,Address,Consent',
      'Meena R,9876543210,1980-05-12,,123456789012,,Female,"Chennai",true'
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hpv-patient-upload-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importPatients(file?: File) {
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    setMessage(null);
    try {
      const patients = await parsePatientFile(file);
      const res = await fetch('/api/patients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setImportSummary(data);
      setMessage({ type: data.created ? 'success' : 'error', text: `Upload finished. ${data.created} patient records saved.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Upload failed' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Register / Find"
        title="Find patient, then collect sample"
        subtitle={user?.centerName || 'Your center'}
      />
      <div className="grid two">
        <div className="card">
          <h2>Search first</h2>
          <div className="grid two">
            <div className="field">
              <label>Aadhaar number</label>
              <input className="input" value={form.aadhaar || ''} onChange={(e) => set('aadhaar', e.target.value)} placeholder="12 digits" />
            </div>
            <div className="field">
              <label>ABHA number</label>
              <input className="input" value={form.abhaNumber || ''} onChange={(e) => set('abhaNumber', e.target.value)} placeholder="14 digits" />
            </div>
            <div className="field">
              <label>Mobile number</label>
              <input className="input" value={form.mobile || ''} onChange={(e) => set('mobile', e.target.value)} placeholder="10 digits" />
            </div>
            <div className="field">
              <label>Date of birth</label>
              <input className="input" type="date" value={form.dob || ''} onChange={(e) => set('dob', e.target.value)} />
            </div>
          </div>
          <div className="actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn secondary" onClick={search}>
              <Search size={18} aria-hidden="true" />
              Search
            </button>
          </div>

          {!!matches.length && (
            <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
              {matches.map((patient) => (
                <div className="step" key={patient.id}>
                  <strong>{patient.fullName}</strong>
                  <span>{patient.patientCode} / Aadhaar last 4: {patient.aadhaarLast4 || 'NA'} / ABHA: {patient.abhaNumber || 'NA'}</span>
                  <div className="actions" style={{ marginTop: 10 }}>
                    <button type="button" className="btn" onClick={() => collectSample(patient.id)}>
                      <Printer size={18} aria-hidden="true" />
                      Collect sample
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {message && (
            <div className={`toast ${message.type}`} style={{ marginTop: 16 }}>
              {message.text}
              {message.sample && (
                <div style={{ marginTop: 10 }}>
                  <Link className="btn secondary" href={`/samples/${message.sample.id}/label`}>
                    <Printer size={18} aria-hidden="true" />
                    Print label
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>New registration</h2>
          <p className="mini">Fields marked <RequiredMark /> are required. Enter either Aadhaar or ABHA.</p>
          <form className="form" onSubmit={submit}>
            <div className="grid two">
              <div className="field">
                <label>Aadhaar number <RequiredMark /></label>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={12}
                  value={form.aadhaar || ''}
                  onChange={(e) => set('aadhaar', e.target.value)}
                  placeholder="12 digits"
                />
              </div>
              <div className="field">
                <label>ABHA number <RequiredMark /></label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={form.abhaNumber || ''}
                  onChange={(e) => set('abhaNumber', e.target.value)}
                  placeholder="14 digits"
                />
              </div>
              <div className="field">
                <label>Mobile number <RequiredMark /></label>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={form.mobile || ''}
                  onChange={(e) => set('mobile', e.target.value)}
                  placeholder="10 digits"
                />
              </div>
              <div className="field">
                <label>Date of birth <RequiredMark /></label>
                <input className="input" type="date" value={form.dob || ''} onChange={(e) => set('dob', e.target.value)} />
              </div>
            </div>
            <div className="grid two">
              <div className="field">
                <label>Patient name <RequiredMark /></label>
                <input className="input" required value={form.fullName || ''} onChange={(e) => set('fullName', e.target.value)} />
              </div>
              <div className="field">
                <label>Age if DOB unavailable <RequiredMark /></label>
                <input className="input" type="number" value={form.ageYears || ''} onChange={(e) => set('ageYears', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Gender</label>
              <select className="select" value={form.gender || 'female'} onChange={(e) => set('gender', e.target.value)}>
                <option value="female">Female</option>
                <option value="transgender">Transgender</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Address</label>
              <textarea className="textarea" value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
            </div>
            <label className="mini">
              <input type="checkbox" checked={!!form.consent} onChange={(e) => set('consent', e.target.checked)} /> Consent recorded
            </label>
            <button className="btn" disabled={saving}>
              <Save size={18} aria-hidden="true" />
              {saving ? 'Saving...' : 'Save patient'}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Upload patient list</h2>
            <p className="mini" style={{ margin: 0 }}>
              Upload Excel or CSV with patient name, mobile, DOB or age, and either Aadhaar or ABHA.
            </p>
          </div>
          <div className="actions">
            <button type="button" className="btn secondary" onClick={downloadTemplate}>
              <Download size={18} aria-hidden="true" />
              Template
            </button>
            <label className="btn">
              <Upload size={18} aria-hidden="true" />
              {importing ? 'Uploading...' : 'Upload Excel/CSV'}
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                disabled={importing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  importPatients(file);
                }}
              />
            </label>
          </div>
        </div>

        {importSummary && (
          <div className="step" style={{ marginTop: 14 }}>
            <strong><FileSpreadsheet size={16} aria-hidden="true" /> Upload summary</strong>
            <span>
              Total: {importSummary.total} / Saved: {importSummary.created} / Duplicates: {importSummary.duplicates} / Failed: {importSummary.failed}
            </span>
            {!!importSummary.errors.length && (
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Patient</th>
                      <th>Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSummary.errors.slice(0, 20).map((error) => (
                      <tr key={`${error.row}-${error.message}`}>
                        <td>{error.row}</td>
                        <td>{error.name || '-'}</td>
                        <td>{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importSummary.errors.length > 20 && <p className="mini">Showing first 20 issues.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
