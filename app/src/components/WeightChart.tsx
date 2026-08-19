import type { DayRecord } from "../domain/types";
import { formatDate } from "../domain/tracker";
import "./WeightChart.css";
export function WeightChart({ records }: {
    records: DayRecord[];
}) { const points = [...records].reverse().filter((record) => record.weight !== null); if (points.length < 2)
    return <div className="empty-chart">Potrebna su najmanje dva merenja za grafikon.</div>; const weights = points.map((record) => record.weight as number), min = Math.min(...weights) - .3, max = Math.max(...weights) + .3, range = max - min || 1; const coords = points.map((record, index) => ({ x: 28 + (index * 344) / Math.max(points.length - 1, 1), y: 155 - (((record.weight as number) - min) / range) * 115, record })); return <svg className="weight-chart" viewBox="0 0 400 190" role="img" aria-label="Kretanje težine"><line x1="28" y1="40" x2="372" y2="40"/><line x1="28" y1="98" x2="372" y2="98"/><line x1="28" y1="155" x2="372" y2="155"/><polyline points={coords.map((point) => `${point.x},${point.y}`).join(" ")}/>{coords.map((point) => <g key={point.record.date}><circle cx={point.x} cy={point.y} r="4"/><text x={point.x} y={point.y - 11}>{point.record.weight?.toFixed(1)}</text><text className="date-label" x={point.x} y="180">{formatDate(point.record.date)}</text></g>)}</svg>; }
