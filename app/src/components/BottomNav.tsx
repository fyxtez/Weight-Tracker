import type { Tab } from "../domain/types";
import "./BottomNav.css";
const items: Array<{
    id: Tab;
    label: string;
    icon: string;
}> = [{ id: "today", label: "Danas", icon: "⌂" }, { id: "food", label: "Hrana", icon: "◉" }, { id: "report", label: "Izveštaj", icon: "▥" }];
export function BottomNav({ tab, onChange }: {
    tab: Tab;
    onChange: (tab: Tab) => void;
}) { return <nav className="bottom-nav" aria-label="Glavna navigacija">{items.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => onChange(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>; }
