'use client';

import { ClipboardList, Printer, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';

function statusLabel(value?: string) {
  return value ? value.replaceAll('_', ' ') : '-';
}

export default function BatchesPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [courierName, setCourierName] = useState('');
  const [message, setMessage] = useState<any>(null);
  const [activeBatch, setActiveBatch] = useState<any>(null);

  async function load() {
    const [sampleRes, batchRes] = await Promise.all([
      fetch('/api/samples').then((r) => r.json()),
      fetch('/api/batches').then((r) => r.json())
    ]);
    setSamples(sampleRes.samples || []);
    setBatches(batchRes.batches || []);
  }

  useEffect(() => { load(); }, []);

  const eligible = useMemo(() => samples.filter((s) => s.status === 'COLLECTED'), [samples]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectAll() {
    setSelected(eligible.map((sample) => sample.id));
  }

  async function createBatch() {
    setMessage(null);
    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleIds: selected, courierName })
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ type: 'error', text: data.error || 'Batch failed' });
    setMessage({ type: 'success', text: `Batch dispatched: ${data.batch.batchId}` });
    setActiveBatch(data.batch);
    setSelected([]);
    setCourierName('');
    await load();
  }

  return (
    <>
      <PageHeader
        kicker="Dispatch"
        title="Create dispatch batch"
        right={<button className="btn secondary" onClick={load}><RefreshCcw size={18} aria-hidden="true" />Refresh</button>}
      />
      <div className="grid two no-print">
        <div className="card">
          <h2>Collected samples</h2>
          <div className="field">
            <label>Courier / handover person</label>
            <input className="input" value={courierName} onChange={(e) => setCourierName(e.target.value)} />
          </div>
          <div className="actions" style={{ margin: '14px 0' }}>
            <button className="btn secondary" onClick={selectAll} disabled={!eligible.length}>Select all ({eligible.length})</button>
            <button className="btn" disabled={!selected.length} onClick={createBatch}>
              <ClipboardList size={18} aria-hidden="true" />
              Dispatch selected ({selected.length})
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th></th><th>Sample</th><th>Patient</th><th>Status</th></tr></thead>
              <tbody>
                {eligible.map((sample) => (
                  <tr key={sample.id}>
                    <td><input type="checkbox" checked={selected.includes(sample.id)} onChange={() => toggle(sample.id)} /></td>
                    <td><strong>{sample.sampleId}</strong></td>
                    <td>{sample.patientName}</td>
                    <td><span className="badge">{statusLabel(sample.status)}</span></td>
                  </tr>
                ))}
                {!eligible.length && <tr><td colSpan={4} className="mini">No collected samples waiting for dispatch.</td></tr>}
              </tbody>
            </table>
          </div>
          {message && <div className={`toast ${message.type}`} style={{ marginTop: 14 }}>{message.text}</div>}
        </div>

        <div className="card">
          <h2>Batches</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Batch</th><th>Source</th><th>Samples</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td><strong>{batch.batchId}</strong></td>
                    <td>{batch.sourceCenterName}</td>
                    <td>{batch.sampleCount}</td>
                    <td><span className="badge warn">{statusLabel(batch.status)}</span></td>
                    <td><button className="btn secondary" onClick={() => setActiveBatch(batch)}>Manifest</button></td>
                  </tr>
                ))}
                {!batches.length && <tr><td colSpan={5} className="mini">No dispatch batches yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {activeBatch && (
        <div className="card manifest" style={{ marginTop: 18 }}>
          <div className="actions no-print" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Dispatch manifest</h2>
            <button className="btn" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />Print / save PDF</button>
          </div>
          <div className="grid two" style={{ marginBottom: 12 }}>
            <div><strong>Batch:</strong> {activeBatch.batchId}</div>
            <div><strong>Source:</strong> {activeBatch.sourceCenterName}</div>
            <div><strong>Samples:</strong> {activeBatch.sampleCount}</div>
            <div><strong>Dispatched:</strong> {activeBatch.dispatchedAt ? new Date(activeBatch.dispatchedAt).toLocaleString() : '-'}</div>
            <div><strong>Courier:</strong> {activeBatch.courierName || '-'}</div>
            <div><strong>Status:</strong> {statusLabel(activeBatch.status)}</div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Sample</th><th>Patient</th><th>Status</th><th>Received</th></tr></thead>
              <tbody>
                {(activeBatch.samples || []).map((row: any) => (
                  <tr key={row.id || row.sampleId}>
                    <td><strong>{row.sample?.sampleId || row.sampleId}</strong></td>
                    <td>{row.sample?.patientName || row.patientName || '-'}</td>
                    <td>{statusLabel(row.sample?.status || row.status)}</td>
                    <td>{statusLabel(row.receiveStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
