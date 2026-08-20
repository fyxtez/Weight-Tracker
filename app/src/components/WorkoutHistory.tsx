import { SERBIA_TIME_ZONE } from "../domain/constants";
import type { DayRecord } from "../domain/types";
import "./WorkoutHistory.css";

function fullDate(date: string) {
    return new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: SERBIA_TIME_ZONE, weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00Z`));
}

export function WorkoutHistory({ records, monthLabel, onClose }: { records: DayRecord[]; monthLabel: string; onClose: () => void }) {
    return <div className="workout-history-backdrop" role="presentation" onClick={onClose}><section className="workout-history" role="dialog" aria-modal="true" aria-label="Mesečna tabela treninga" onClick={(event) => event.stopPropagation()}><header><div><span className="eyebrow">TRENING PO DANIMA</span><h2>{monthLabel}</h2></div><button className="workout-history-close" onClick={onClose} aria-label="Zatvori tabelu">×</button></header>{records.length === 0 ? <div className="workout-history-empty">Još nema upisanog treninga ovog meseca.</div> : <div className="workout-history-scroll"><table><thead><tr><th>Dan</th><th>Mišićne grupe / aktivnost</th></tr></thead><tbody>{records.map((record) => <tr key={record.date}><td>{fullDate(record.date)}</td><td>{record.workout.join(", ")}</td></tr>)}</tbody></table></div>}<button className="primary-button" onClick={onClose}>Zatvori</button></section></div>;
}
