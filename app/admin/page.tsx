import PageHeader from '@/components/PageHeader';

const centers = [
  ['Hub', 'IOG Hospital, Egmore'],
  ['Spoke', 'Stanley'],
  ['Spoke', 'KMC'],
  ['Spoke', 'KGH / Omandurar Hospital'],
  ['Spoke', 'PHC / CHC centers']
];

const checks = [
  'DATABASE_URL points to Neon Postgres',
  'SESSION_SECRET is a long random value',
  'IDENTIFIER_PEPPER is a long random value',
  'NEXT_PUBLIC_DEMO_MODE=false in Vercel',
  'npm run db:init completed',
  'npm run db:seed completed',
  'Demo passwords changed before live patient use',
  'Aadhaar/ABHA consent text approved locally',
  'Backup, retention, and incident response SOP approved'
];

export default function AdminPage() {
  return (
    <>
      <PageHeader kicker="Admin" title="Configuration" subtitle="Program setup, seeded users, and deployment checks." />
      <div className="grid two">
        <div className="card">
          <h2>Centers</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Type</th><th>Name</th></tr></thead>
              <tbody>{centers.map(([type, name]) => <tr key={name}><td>{type}</td><td>{name}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Seeded users</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Username</th><th>Role</th></tr></thead>
              <tbody>
                <tr><td>admin</td><td>admin</td></tr>
                <tr><td>hub</td><td>hub</td></tr>
                <tr><td>lab</td><td>lab</td></tr>
                <tr><td>stanley</td><td>spoke</td></tr>
                <tr><td>kmc</td><td>spoke</td></tr>
                <tr><td>kgh</td><td>spoke</td></tr>
                <tr><td>phc</td><td>spoke</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mini">Seed password: welcome@123</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Deployment checklist</h2>
        <div className="grid three">
          {checks.map((item) => (
            <label className="step" key={item}>
              <input type="checkbox" /> <strong>{item}</strong>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
