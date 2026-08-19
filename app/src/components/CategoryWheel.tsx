import { CATEGORIES } from "../domain/constants";
import type { FoodView } from "../domain/types";
import "./CategoryWheel.css";
export function CategoryWheel({ onSelect }: {
    onSelect: (category: FoodView) => void;
}) { return <div className="category-wheel"><button className="category-core" onClick={() => onSelect("common")}><span aria-hidden="true">★</span><strong>Osnovno</strong></button>{CATEGORIES.map((category, index) => { const angle = -Math.PI / 2 + (index * 2 * Math.PI) / CATEGORIES.length; const left = 50 + Math.cos(angle) * 36; const top = 50 + Math.sin(angle) * 36; return <button key={category.id} className={`category-button ${category.rare ? "rare" : ""}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => onSelect(category.id)}><span aria-hidden="true">{category.icon}</span><strong>{category.name}</strong></button>; })}</div>; }
