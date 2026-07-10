'use client';

import { ClipboardList, FlaskConical, PackageCheck, Search, TestTube2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import type { SessionUser } from '@/lib/types';

function statusLabel(value?: string) {
  return value ? value.replaceAll('_', ' ') : '-';
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json())
    ]).then(([dashboard, me]) => {
      if (dashboard.error) setError(dashboard.error);
      else setData(dashboard);
      setUser(me.user);
    });
  }, []);

  const spokeActions = [
    { href: '/register', title: 'Register / Find Patient', text: 'Search Aadhaar, ABHA, or mobile first.', icon: Search },
    { href: '/samples', title: 'Collect Sample', text: 'Create and print the sample barcode.', icon: TestTube2 },
    { href: '/batches', title: 'Create Dispatch Batch', text: 'Select collected samples for IOG hub.', icon: ClipboardList }
  ];

  const hubActions = [
    { href: '/hub', title: 'Receive Batches', text: 'Confirm incoming samples from spokes.', icon: PackageCheck },
    { href: '/referrals', title: 'Referral Follow-up', text: 'Track positive patients to closure.', icon: ClipboardList },
    { href: '/reports', title: 'Reports', text: 'Review reported results and trends.', icon: FlaskConical }
  ];

  const actions = user?.role === 'spoke' ? spokeActions : hubActions;

  return (
    <>
      <PageHeader
        kicker={user?.role === 'spoke' ? 'Spoke desk' : 'Monitoring'}
        title={user?.role === 'spoke' ? 'Today at your center' : 'HPV screening dashboard'}
        subtitle={user?.centerName || 'IOG Hospital, Egmore'}
      />
      {error && <div className="toast error">{error}</div>}

      <div className="action-grid" style={{ marginBottom: 18 }}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} className="action-card" href={action.href}>
              <Icon size={24} aria-hidden="true" />
              <strong>{action.title}</strong>
              <span>{action.text}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid four">
        <StatCard label="Total patients" value={data?.totalPatients ?? '-'} />
        <StatCard label="Unique patients" value={data?.uniquePatients ?? '-'} />
        <StatCard label="Total samples" value={data?.totalSamples ?? '-'} />
        <StatCard label="Pending dispatch" value={data?.pendingDispatch ?? '-'} />
        <StatCard label="In transit" value={data?.inTransit ?? '-'} />
        <StatCard label="Received at hub" value={data?.receivedAtHub ?? '-'} />
        <StatCard label="Pending lab result" value={data?.pendingLabResult ?? '-'} />
        <StatCard label="Positive referral pending" value={data?.referralPending ?? '-'} />
      </div>

      <div className="grid two" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Recent samples</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Sample</th><th>Patient</th><th>Center</th><th>Status</th></tr></thead>
              <tbody>
                {(data?.recentSamples || []).map((s: any) => (
                  <tr key={s.id}>
                    <td><strong>{s.sampleId}</strong></td>
                    <td>{s.patientName || '-'}</td>
                    <td>{s.centerName || '-'}</td>
                    <td><span className="badge">{statusLabel(s.status)}</span></td>
                  </tr>
                ))}
                {!data?.recentSamples?.length && <tr><td colSpan={4} className="mini">No samples yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Latest batches</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Batch</th><th>Source</th><th>Count</th><th>Status</th></tr></thead>
              <tbody>
                {(data?.batches || []).map((b: any) => (
                  <tr key={b.id}>
                    <td><strong>{b.batchId}</strong></td>
                    <td>{b.sourceCenterName || '-'}</td>
                    <td>{b.sampleCount}</td>
                    <td><span className="badge warn">{statusLabel(b.status)}</span></td>
                  </tr>
                ))}
                {!data?.batches?.length && <tr><td colSpan={4} className="mini">No batches yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Samples by center</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Center</th><th>Total</th></tr></thead>
              <tbody>
                {(data?.samplesByCenter || []).map((row: any) => (
                  <tr key={row.centerId}><td>{row.centerName}</td><td>{row.total}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>7 day collection trend</h2>
          <div className="stepper">
            {(data?.dailyTrend || []).map((row: any) => (
              <div className="step" key={row.day}>
                <strong>{row.count}</strong>
                <span>{row.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
