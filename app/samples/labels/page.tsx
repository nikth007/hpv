'use client';

import { Printer, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';

export default function BulkLabelsPage() {
  const [samples, setSamples] = useState<any[]>([]);

  async function load() {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get('ids');
    const url = ids ? `/api/samples?ids=${encodeURIComponent(ids)}` : '/api/samples?status=COLLECTED&today=true';
    const data = await fetch(url).then((r) => r.json());
    setSamples(data.samples || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        kicker="Labels"
        title="Bulk barcode labels"
        right={
          <div className="actions no-print">
            <button className="btn secondary" onClick={load}><RefreshCcw size={18} aria-hidden="true" />Refresh</button>
            <button className="btn" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />Print / save PDF</button>
          </div>
        }
      />
      <div className="label-grid">
        {samples.map((sample) => (
          <div className="label-sheet" key={sample.id}>
            <strong>HPV DNA SAMPLE</strong>
            <div className="barcode">{sample.sampleId}</div>
            <div>Patient: {sample.patientName || '-'}</div>
            <div>Masked ID: Aadhaar ****{sample.aadhaarLast4 || 'NA'}</div>
            <div>Center: {sample.centerName || '-'}</div>
            <div>Collected: {sample.collectionDate ? new Date(sample.collectionDate).toLocaleDateString() : '-'}</div>
          </div>
        ))}
        {!samples.length && <div className="card mini">No labels selected.</div>}
      </div>
    </>
  );
}
