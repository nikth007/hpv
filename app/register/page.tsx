'use client';

import { Printer, Save, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import type { SessionUser } from '@/lib/types';

export default function RegisterPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [form, setForm] = useState<any>({ gender: 'female', consent: true });
  const [matches, setMatches] = useState<any[]>([]);
  const [message, setMessage] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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
          <form className="form" onSubmit={submit}>
            <div className="grid two">
              <div className="field">
                <label>Aadhaar number</label>
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
                <label>ABHA number</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={form.abhaNumber || ''}
                  onChange={(e) => set('abhaNumber', e.target.value)}
                  placeholder="14 digits"
                />
              </div>
              <div className="field">
                <label>Mobile number</label>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.mobile || ''}
                  onChange={(e) => set('mobile', e.target.value)}
                  placeholder="10 digits"
                />
              </div>
              <div className="field">
                <label>Date of birth</label>
                <input className="input" type="date" value={form.dob || ''} onChange={(e) => set('dob', e.target.value)} />
              </div>
            </div>
            <div className="grid two">
              <div className="field">
                <label>Patient name</label>
                <input className="input" value={form.fullName || ''} onChange={(e) => set('fullName', e.target.value)} />
              </div>
              <div className="field">
                <label>Age if DOB unavailable</label>
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
    </>
  );
}
