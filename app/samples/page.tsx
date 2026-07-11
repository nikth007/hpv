'use client';

import { Printer, RefreshCcw, TestTube2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';

function statusLabel(value?: string) {
  return value ? value.replaceAll('_', ' ') : '-';
}

export default function SamplesPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [patientId, setPatientId] = useState('');
  const [collectionMode, setCollectionMode] = useState('PROVIDER_COLLECTED');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [todayOnly, setTodayOnly] = useState(true);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [message, setMessage] = useState<any>(null);

  async function load() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    if (todayOnly) params.set('today', 'true');
    const [patientRes, sampleRes] = await Promise.all([
      fetch(`/api/patients?q=${encodeURIComponent(query)}`).then((r) => r.json()),
      fetch(`/api/samples?${params.toString()}`).then((r) => r.json())
    ]);
    setPatients(patientRes.patients || []);
    setSamples(sampleRes.samples || []);
    setSelectedLabels([]);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    setMessage(null);
    const res = await fetch('/api/samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, collectionMode })
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ type: 'error', text: data.error || 'Could not create sample' });
    setMessage({ type: 'success', text: `Sample created: ${data.sample.sampleId}`, sample: data.sample });
    setPatientId('');
    await load();
  }

  function toggleLabel(id: string) {
    setSelectedLabels((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const labelHref = selectedLabels.length ? `/samples/labels?ids=${selectedLabels.join(',')}` : '/samples/labels';

  return (
    <>
      <PageHeader
        kicker="Samples"
        title="Collect and print barcodes"
        right={<button className="btn secondary" onClick={load}><RefreshCcw size={18} aria-hidden="true" />Refresh</button>}
      />
      <div className="grid two">
        <div className="card">
          <h2>Create sample</h2>
          <div className="form">
            <div className="field">
              <label>Search patient</label>
              <div className="actions">
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, patient code, or mobile" />
                <button className="btn secondary" onClick={load}>Search</button>
              </div>
            </div>
            <div className="field">
              <label>Select patient</label>
              <select className="select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Choose patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} / {p.patientCode}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Collection mode</label>
              <select className="select" value={collectionMode} onChange={(e) => setCollectionMode(e.target.value)}>
                <option value="PROVIDER_COLLECTED">Provider collected</option>
                <option value="SELF_SAMPLED">Self-sampled</option>
              </select>
            </div>
            <button className="btn" disabled={!patientId} onClick={create}>
              <TestTube2 size={18} aria-hidden="true" />
              Generate barcode
            </button>
            {message && (
              <div className={`toast ${message.type}`}>
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
        </div>
        <div className="card">
          <h2>Ready for dispatch</h2>
          <div className="grid">
            <div className="stat">
              <div className="num">{samples.filter((s) => s.status === 'COLLECTED').length}</div>
              <div className="label">Collected samples not dispatched</div>
            </div>
            <Link className="btn" href="/batches">Create dispatch batch</Link>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="actions" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Samples</h2>
          <div className="actions">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 190 }}>
              <option value="">All statuses</option>
              <option value="COLLECTED">Collected</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="RECEIVED_AT_HUB">Received at hub</option>
              <option value="REPORTED">Reported</option>
              <option value="REFERRED">Referred</option>
            </select>
            <label className="mini"><input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} /> Today</label>
            <button className="btn secondary" onClick={load}>Apply</button>
            <Link className="btn" href={labelHref}><Printer size={16} aria-hidden="true" />Print labels ({selectedLabels.length || 'today'})</Link>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th></th><th>Sample</th><th>Patient</th><th>Center</th><th>Mode</th><th>Status</th><th>Label</th></tr></thead>
            <tbody>
              {samples.map((s) => (
                <tr key={s.id}>
                  <td><input type="checkbox" checked={selectedLabels.includes(s.id)} onChange={() => toggleLabel(s.id)} /></td>
                  <td><strong>{s.sampleId}</strong></td>
                  <td>{s.patientName || s.patientId}</td>
                  <td>{s.centerName}</td>
                  <td>{statusLabel(s.collectionMode)}</td>
                  <td><span className="badge">{statusLabel(s.status)}</span></td>
                  <td><Link className="btn secondary" href={`/samples/${s.id}/label`}><Printer size={16} aria-hidden="true" />Print</Link></td>
                </tr>
              ))}
              {!samples.length && <tr><td colSpan={7} className="mini">No samples found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
