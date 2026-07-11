'use client';

import { Download, RefreshCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';

const statuses = [
  ['PENDING_CONTACT', 'Pending contact'],
  ['CONTACTED', 'Contacted'],
  ['APPOINTMENT_GIVEN', 'Appointment given'],
  ['VISITED', 'Visited'],
  ['LOST_TO_FOLLOWUP', 'Lost to follow-up'],
  ['COMPLETED', 'Completed']
];

const resultLabels: Record<string, string> = {
  POSITIVE_HPV_16: 'Positive HPV 16',
  POSITIVE_HPV_18: 'Positive HPV 18',
  POSITIVE_OTHER_HR_HPV: 'Positive Other High-Risk HPV',
  NEGATIVE: 'Negative',
  INVALID_REPEAT_REQUIRED: 'Invalid / Repeat Required'
};

function statusLabel(value?: string) {
  return statuses.find(([key]) => key === value)?.[1] || value?.replaceAll('_', ' ') || '-';
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [status, setStatus] = useState('PENDING_CONTACT');
  const [q, setQ] = useState('');
  const [message, setMessage] = useState<any>(null);

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    const data = await fetch(`/api/referrals?${params.toString()}`).then((r) => r.json());
    setReferrals(data.referrals || []);
  }

  useEffect(() => { load(); }, []);

  function draft(id: string, key: string, value: any) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || {}), [key]: value } }));
  }

  async function save(referral: any) {
    const payload = { id: referral.id, ...(drafts[referral.id] || {}) };
    const res = await fetch('/api/referrals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return setMessage({ type: 'error', text: data.error || 'Could not update referral' });
    setMessage({ type: 'success', text: 'Referral updated.' });
    await load();
  }

  function exportCsv() {
    const header = ['Patient', 'Sample', 'Result', 'Status', 'Follow-up date', 'Notes'];
    const rows = referrals.map((r) => [r.patientName, r.sampleCode, resultLabels[r.result] || r.result, statusLabel(r.followUpStatus), r.followUpDate || '', r.notes || '']);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hpv-referral-worklist.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        kicker="Referrals"
        title="Positive patient follow-up"
        right={<button className="btn secondary" onClick={load}><RefreshCcw size={18} aria-hidden="true" />Refresh</button>}
      />
      {message && <div className={`toast ${message.type}`} style={{ marginBottom: 14 }}>{message.text}</div>}
      <div className="card">
        <div className="actions" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="actions">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 230 }}>
              <option value="">All statuses</option>
              {statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Patient or sample" style={{ width: 260 }} />
            <button className="btn secondary" onClick={load}>Apply</button>
          </div>
          <button className="btn secondary" onClick={exportCsv}><Download size={18} aria-hidden="true" />Export</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Patient</th><th>Sample</th><th>Result</th><th>Referred to</th><th>Status</th><th>Follow-up date</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {referrals.map((referral) => {
                const current = drafts[referral.id] || {};
                return (
                  <tr key={referral.id}>
                    <td><strong>{referral.patientName}</strong></td>
                    <td>{referral.sampleCode}</td>
                    <td><span className="badge danger">{resultLabels[referral.result] || referral.result}</span></td>
                    <td>{referral.referredToCenterName || 'IOG Hospital, Egmore'}</td>
                    <td>
                      <select className="select" value={current.followUpStatus || referral.followUpStatus} onChange={(e) => draft(referral.id, 'followUpStatus', e.target.value)}>
                        {statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="input" type="date" value={current.followUpDate || referral.followUpDate?.slice(0, 10) || ''} onChange={(e) => draft(referral.id, 'followUpDate', e.target.value)} />
                    </td>
                    <td>
                      <input className="input" value={current.notes ?? referral.notes ?? ''} onChange={(e) => draft(referral.id, 'notes', e.target.value)} />
                    </td>
                    <td>
                      <button className="btn secondary" onClick={() => save(referral)}>
                        <Save size={16} aria-hidden="true" />
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!referrals.length && <tr><td colSpan={8} className="mini">No positive referrals yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Queue status</h2>
        <div className="grid three">
          {statuses.map(([key, label]) => (
            <div className="stat" key={key}>
              <div className="num">{referrals.filter((referral) => referral.followUpStatus === key).length}</div>
              <div className="label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
