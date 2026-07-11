'use client';

import { FlaskConical, RefreshCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';

const resultOptions = [
  ['NEGATIVE', 'Negative'],
  ['POSITIVE_HPV_16', 'Positive HPV 16'],
  ['POSITIVE_HPV_18', 'Positive HPV 18'],
  ['POSITIVE_OTHER_HR_HPV', 'Positive Other High-Risk HPV'],
  ['INVALID_REPEAT_REQUIRED', 'Invalid / Repeat Required']
];

function resultLabel(value?: string) {
  return resultOptions.find(([key]) => key === value)?.[1] || value?.replaceAll('_', ' ') || '-';
}

function statusLabel(value?: string) {
  return value ? value.replaceAll('_', ' ') : '-';
}

export default function LabPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [sampleId, setSampleId] = useState('');
  const [q, setQ] = useState('');
  const [result, setResult] = useState('NEGATIVE');
  const [remarks, setRemarks] = useState('');
  const [message, setMessage] = useState<any>(null);

  async function load() {
    const params = new URLSearchParams({ labPending: 'true' });
    if (q) params.set('q', q);
    const [sampleRes, resultRes] = await Promise.all([
      fetch(`/api/samples?${params.toString()}`).then((r) => r.json()),
      fetch('/api/lab/results').then((r) => r.json())
    ]);
    setSamples(sampleRes.samples || []);
    setResults(resultRes.results || []);
  }

  useEffect(() => { load(); }, []);

  async function saveResult() {
    setMessage(null);
    const res = await fetch('/api/lab/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleId, result, remarks })
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ type: 'error', text: data.error || 'Could not save result' });
    setMessage({ type: 'success', text: 'Result reported.' });
    setSampleId('');
    setRemarks('');
    await load();
  }

  return (
    <>
      <PageHeader
        kicker="Lab"
        title="Report HPV DNA results"
        subtitle="Received samples pending result"
        right={<button className="btn secondary" onClick={load}><RefreshCcw size={18} aria-hidden="true" />Refresh</button>}
      />
      <div className="grid two">
        <div className="card">
          <h2>Enter result</h2>
          <div className="form">
            <div className="field">
              <label>Scan / search barcode</label>
              <div className="actions">
                <input
                  className="input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      load();
                    }
                  }}
                  placeholder="Sample barcode, patient, mobile"
                />
                <button className="btn secondary" onClick={load}>Find</button>
              </div>
            </div>
            <div className="field">
              <label>Sample</label>
              <select className="select" value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
                <option value="">Choose sample</option>
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>{sample.sampleId} / {sample.patientName} / {sample.centerName}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Result</label>
              <select className="select" value={result} onChange={(e) => setResult(e.target.value)}>
                {resultOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Remarks</label>
              <textarea className="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <button className="btn" disabled={!sampleId} onClick={saveResult}>
              <Save size={18} aria-hidden="true" />
              Mark as reported
            </button>
            {message && <div className={`toast ${message.type}`}>{message.text}</div>}
          </div>
        </div>
        <div className="card">
          <h2>Pending samples</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Sample</th><th>Patient</th><th>Center</th><th>Status</th></tr></thead>
              <tbody>
                {samples.map((sample) => (
                  <tr key={sample.id}>
                    <td><strong>{sample.sampleId}</strong></td>
                    <td>{sample.patientName}</td>
                    <td>{sample.centerName}</td>
                    <td><span className="badge">{statusLabel(sample.status)}</span></td>
                  </tr>
                ))}
                {!samples.length && <tr><td colSpan={4} className="mini">No samples pending result.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Recent results</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Sample</th><th>Patient</th><th>Result</th><th>Reported</th></tr></thead>
            <tbody>
              {results.slice(0, 12).map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.sampleCode}</strong></td>
                  <td>{row.patientName}</td>
                  <td><span className={`badge ${row.result?.startsWith('POSITIVE') ? 'danger' : 'ok'}`}>{resultLabel(row.result)}</span></td>
                  <td>{row.reportedAt ? new Date(row.reportedAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {!results.length && <tr><td colSpan={4} className="mini">No results reported yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
