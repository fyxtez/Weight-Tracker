import "./CompletedDailyField.css";
export function CompletedDailyField({ label, value, onEdit }: {
    label: string;
    value: string;
    onEdit: () => void;
}) { return <section className="card completed-daily-field"><div><span>{label}</span><strong>{value}</strong></div><button onClick={onEdit}>Izmeni</button></section>; }
