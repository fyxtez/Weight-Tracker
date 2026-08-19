import "./Stat.css";
export function Stat({ label, value, suffix }: {
    label: string;
    value: string;
    suffix: string;
}) { return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{suffix}</small></div>; }
export function StatCard({ label, value, suffix, positive = false }: {
    label: string;
    value: string;
    suffix: string;
    positive?: boolean;
}) { return <div className="card stat-card"><span>{label}</span><div className={positive ? "positive" : ""}><strong>{value}</strong><small>{suffix}</small></div></div>; }
