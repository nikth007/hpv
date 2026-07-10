export default function PageHeader({ kicker, title, subtitle, right }: { kicker: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <div className="kicker">{kicker}</div>
        <h1 className="title">{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
