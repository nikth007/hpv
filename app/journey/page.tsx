import PageHeader from '@/components/PageHeader';

const rows = [
  ['Register', 'Search Aadhaar, ABHA, or mobile before creating a patient.'],
  ['Collect', 'Generate a barcode label and link the sample to patient and center.'],
  ['Dispatch', 'Create a digital manifest and mark samples as dispatched.'],
  ['Receive', 'Hub confirms samples and marks missing or damaged items.'],
  ['Report', 'Lab records HPV result and positive results create referrals.'],
  ['Follow up', 'Referral queue tracks contact, appointments, visits, and closure.']
];

export default function JourneyPage() {
  return (
    <>
      <PageHeader kicker="Journey" title="Screening workflow" />
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Stage</th><th>Work</th></tr></thead>
            <tbody>{rows.map(([stage, work]) => <tr key={stage}><td><strong>{stage}</strong></td><td>{work}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
