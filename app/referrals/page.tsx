'use client';

import { RefreshCcw, Save } from 'lucide-react';
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
  const [message, setMessage] = useState<any>(null);

  async function load() {
    const data = await fetch('/api/referrals').then((r) => r.json());
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

  return (
    <>
      <PageHeader
        kicker="Referrals"
        title="Positive patient follow-up"
        right={<button className="btn secondary" onClick={load}><RefreshCcw size={18} aria-hidden="true" />Refresh</button>}
      />
      {message && <div className={`toast ${message.type}`} style={{ marginBottom: 14 }}>{message.text}</div>}
      <div className="card">
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
