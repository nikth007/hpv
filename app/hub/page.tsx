'use client';

import { PackageCheck, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';

function statusLabel(value?: string) {
  return value ? value.replaceAll('_', ' ') : '-';
}

export default function HubPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [damaged, setDamaged] = useState<string[]>([]);
  const [message, setMessage] = useState<any>(null);

  async function load() {
    const [batchRes, dashboardRes] = await Promise.all([
      fetch('/api/batches').then((r) => r.json()),
      fetch('/api/dashboard').then((r) => r.json())
    ]);
    setBatches(batchRes.batches || []);
    setStats(dashboardRes);
  }

  useEffect(() => { load(); }, []);

  function toggle(list: string[], setList: (value: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function receive() {
    if (!activeBatch) return;
    setMessage(null);
    const res = await fetch(`/api/batches/${activeBatch.id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingSampleIds: missing, damagedSampleIds: damaged })
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ type: 'error', text: data.error || 'Receive failed' });
    setMessage({ type: 'success', text: `Batch received: ${data.batch.batchId}` });
    setActiveBatch(null);
    setMissing([]);
    setDamaged([]);
    await load();
  }

  return (
    <>
      <PageHeader
        kicker="Hub receive"
        title="Incoming dispatch batches"
        subtitle="IOG Hospital, Egmore"
        right={<button className="btn secondary" onClick={load}><RefreshCcw size={18} aria-hidden="true" />Refresh</button>}
      />
      <div className="grid four">
        <StatCard label="Collected" value={stats?.totalSamples ?? '-'} />
        <StatCard label="Dispatched" value={stats?.inTransit ?? '-'} />
        <StatCard label="Received" value={stats?.receivedAtHub ?? '-'} />
        <StatCard label="Reported" value={stats?.reported ?? '-'} />
      </div>

      <div className="grid two" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Batches</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Batch</th><th>Source</th><th>Count</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td><strong>{batch.batchId}</strong></td>
                    <td>{batch.sourceCenterName}</td>
                    <td>{batch.sampleCount}</td>
                    <td><span className="badge warn">{statusLabel(batch.status)}</span></td>
                    <td><button className="btn secondary" onClick={() => setActiveBatch(batch)}>Open</button></td>
                  </tr>
                ))}
                {!batches.length && <tr><td colSpan={5} className="mini">No batches dispatched yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Receive batch</h2>
          {!activeBatch && <p className="mini">Open a batch to confirm samples.</p>}
          {activeBatch && (
            <div className="form">
              <div className="toast">
                <strong>{activeBatch.batchId}</strong><br />
                {activeBatch.sourceCenterName} / {activeBatch.sampleCount} samples
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Sample</th><th>Patient</th><th>Missing</th><th>Damaged</th></tr></thead>
                  <tbody>
                    {(activeBatch.samples || []).map((row: any) => {
                      const id = row.id || row.sampleId || row.sample?.id;
                      return (
                        <tr key={id}>
                          <td><strong>{row.sampleId || row.sample?.sampleId}</strong></td>
                          <td>{row.patientName || row.sample?.patientName || '-'}</td>
                          <td><input type="checkbox" checked={missing.includes(id)} onChange={() => toggle(missing, setMissing, id)} /></td>
                          <td><input type="checkbox" checked={damaged.includes(id)} onChange={() => toggle(damaged, setDamaged, id)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button className="btn" onClick={receive}>
                <PackageCheck size={18} aria-hidden="true" />
                Confirm receipt
              </button>
            </div>
          )}
          {message && <div className={`toast ${message.type}`} style={{ marginTop: 14 }}>{message.text}</div>}
        </div>
      </div>
    </>
  );
}
