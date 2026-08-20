import { SERBIA_TIME_ZONE } from "../domain/constants";
import type { DayRecord } from "../domain/types";
import { WorkoutIcon } from "./WorkoutIcon";
import "./WorkoutHistory.css";

function fullDate(date: string) {
    return new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: SERBIA_TIME_ZONE, weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00Z`));
}

export function WorkoutHistory({ records, monthLabel, onClose }: { records: DayRecord[]; monthLabel: string; onClose: () => void }) {
    return <div className="workout-history-backdrop" role="presentation" onClick={onClose}>
        <section className="workout-history" role="dialog" aria-modal="true" aria-label="Mesečna tabela treninga" onClick={(event) => event.stopPropagation()}>
            <header><div><span className="eyebrow">TRENING PO DANIMA</span><h2>{monthLabel}</h2></div><button className="workout-history-close" onClick={onClose} aria-label="Zatvori tabelu">×</button></header>
            {records.length === 0 ? <div className="workout-history-empty">Još nema upisanog treninga ovog meseca.</div> :
                /* Fix: History uses responsive day rows instead of a wide HTML table, eliminating horizontal scrolling on narrow phones. */
                <div className="workout-history-days">
                    {records.map((record) => <article className="workout-history-day" key={record.date}>
                        <div className="workout-history-date"><span>Dan</span><strong>{fullDate(record.date)}</strong></div>
                        <div className="workout-history-muscles" aria-label={`Trening: ${record.workout.join(", ")}`}>
                            {/* Feature: History reuses the same anatomy icons as today's workout selection so the visual language stays consistent. */}
                            {record.workout.map((workout) => <div className="workout-history-muscle" key={workout}><WorkoutIcon workout={workout} size="small"/><span>{workout}</span></div>)}
                        </div>
                    </article>)}
                </div>}
            <button className="primary-button" onClick={onClose}>Zatvori</button>
        </section>
    </div>;
}
