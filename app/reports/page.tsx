'use client';

import { RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';

const resultLabels: Record<string, string> = {
  NEGATIVE: 'Negative',
  POSITIVE_HPV_16: 'Positive HPV 16',
  POSITIVE_HPV_18: 'Positive HPV 18',
  POSITIVE_OTHER_HR_HPV: 'Positive Other High-Risk HPV',
  INVALID_REPEAT_REQUIRED: 'Invalid / Repeat Required'
};

export default function ReportsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);

  async function load() {
    const [resultRes, referralRes, dashboardRes] = await Promise.all([
      fetch('/api/lab/results').then((r) => r.json()),
      fetch('/api/referrals').then((r) => r.json()),
      fetch('/api/dashboard').then((r) => r.json())
    ]);
    setResults(resultRes.results || []);
    setReferrals(referralRes.referrals || []);
    setDashboard(dashboardRes);
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        kicker="Reports"
        title="Results and follow-up"
        right={<button className="btn secondary" onClick={load}><RefreshCcw size={18} aria-hidden="true" />Refresh</button>}
      />
      <div className="grid four">
        <StatCard label="Reported samples" value={dashboard?.reported ?? '-'} />
        <StatCard label="Positive patients" value={dashboard?.positivePatients ?? '-'} />
        <StatCard label="Referral pending" value={dashboard?.referralPending ?? '-'} />
        <StatCard label="Pending lab result" value={dashboard?.pendingLabResult ?? '-'} />
      </div>

      <div className="grid two" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Lab results</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Sample</th><th>Patient</th><th>Center</th><th>Result</th><th>Reported</th></tr></thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td><strong>{result.sampleCode}</strong></td>
                    <td>{result.patientName}</td>
                    <td>{result.centerName || '-'}</td>
                    <td><span className={`badge ${result.result?.startsWith('POSITIVE') ? 'danger' : 'ok'}`}>{resultLabels[result.result] || result.result}</span></td>
                    <td>{result.reportedAt ? new Date(result.reportedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {!results.length && <tr><td colSpan={5} className="mini">No results yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Referral queue</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Patient</th><th>Sample</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td><strong>{referral.patientName}</strong></td>
                    <td>{referral.sampleCode}</td>
                    <td><span className="badge warn">{referral.followUpStatus?.replaceAll('_', ' ')}</span></td>
                    <td>{referral.followUpDate || '-'}</td>
                  </tr>
                ))}
                {!referrals.length && <tr><td colSpan={4} className="mini">No referrals yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
