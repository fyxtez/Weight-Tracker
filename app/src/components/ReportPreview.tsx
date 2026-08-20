import { DEFAULT_WALKING_STEPS, FOODS } from "../domain/constants";
import { calculateNutrition, formatDate, round } from "../domain/tracker";
import type { DayRecord } from "../domain/types";
import "./ReportPreview.css";
export function ReportPreview({ records, onClose }: {
    records: DayRecord[];
    onClose: () => void;
}) { return <div className="report-preview-backdrop" role="presentation" onClick={onClose}><section className="report-preview" role="dialog" aria-modal="true" aria-label="Pregled izveštaja" onClick={(event) => event.stopPropagation()}><header><div><span className="eyebrow">IZVEZENI PODACI</span><h2>Pregled izveštaja</h2></div><button onClick={onClose} aria-label="Zatvori pregled">×</button></header><div className="report-preview-days">{records.map((record) => { const totals = calculateNutrition(record); return <article key={record.date}><div className="preview-day-heading"><strong>{formatDate(record.date)}</strong><span>{record.weight?.toFixed(1) ?? "—"} kg · {round(totals.kcal)} kcal</span></div><div className="preview-meta"><span>{record.sleep ? `San ${record.sleep}` : "San —"}</span><span>{record.workout.join(", ") || "Bez treninga"}</span>{record.workout.includes("Šetnja") && <span>{DEFAULT_WALKING_STEPS.toLocaleString("sr-RS")}+ koraka</span>}</div><div className="preview-foods">{record.foods.map((selection) => { const food = FOODS.find((item) => item.id === selection.foodId); if (!food)
    return null; return <span key={food.id}>{food.icon} {food.name} · {food.unit === "šejk" ? `${selection.amount}×` : `${selection.amount} ${food.unit}`}</span>; })}</div></article>; })}</div><button className="primary-button" onClick={onClose}>Zatvori</button></section></div>; }
