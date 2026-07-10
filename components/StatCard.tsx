export default function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="stat">
      <div className="num">{value ?? 0}</div>
      <div className="label">{label}</div>
      {tone && <div className="mini" style={{ marginTop: 8 }}>{tone}</div>}
    </div>
  );
}
