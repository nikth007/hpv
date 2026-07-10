'use client';

import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/PageHeader';

export default function LabelPage() {
  const params = useParams<{ id: string }>();
  const [sample, setSample] = useState<any>(null);
  const [error, setError] = useState('');
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    fetch(`/api/samples?id=${encodeURIComponent(params.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSample(data.samples?.[0] || null);
      });
  }, [params.id]);

  useEffect(() => {
    if (sample?.sampleId && barcodeRef.current) {
      JsBarcode(barcodeRef.current, sample.sampleId, {
        format: 'CODE128',
        width: 2,
        height: 58,
        displayValue: false,
        margin: 0
      });
    }
  }, [sample?.sampleId]);

  return (
    <>
      <PageHeader
        kicker="Barcode label"
        title="Print sample label"
        right={<button className="btn" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />Print</button>}
      />
      {error && <div className="toast error">{error}</div>}
      {!sample && !error && <div className="card">Loading label...</div>}
      {sample && (
        <div className="card">
          <div className="label-sheet">
            <strong>HPV DNA SCREENING</strong>
            <svg ref={barcodeRef} aria-label={`Barcode ${sample.sampleId}`} />
            <div className="barcode">{sample.sampleId}</div>
            <div>Patient: {sample.patientName}</div>
            <div>Masked ID: Aadhaar ****{sample.aadhaarLast4 || 'NA'}</div>
            <div>Center: {sample.centerName}</div>
            <div>Collected: {sample.collectionDate ? new Date(sample.collectionDate).toLocaleString() : '-'}</div>
          </div>
        </div>
      )}
    </>
  );
}
