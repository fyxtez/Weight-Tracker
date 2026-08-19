import type { FoodDefinition } from "../domain/types";
import { FoodIcon } from "./FoodIcon";
import "./FoodCard.css";
type Props = {
    food: FoodDefinition;
    selectedAmount?: number;
    common: boolean;
    pendingHide: boolean;
    onSelect: (foodId: string, amount: number) => void;
    onCommon: (foodId: string) => void;
};
export function FoodCard({ food, selectedAmount, common, pendingHide, onSelect, onCommon }: Props) { return <section className={`card food-card ${common ? "common-food" : ""}`}><div className="food-title"><div className="food-icon"><FoodIcon food={food}/></div><div className="food-copy"><h2>{food.name}</h2><p>{food.detail}</p></div><button className={`common-button ${common ? "active" : ""}`} onClick={() => onCommon(food.id)} aria-label={common ? `Vrati ${food.name} u originalnu kategoriju` : `Premesti ${food.name} u Osnovno`} title={common ? "Vrati u originalnu kategoriju" : "Premesti u Osnovno"}>★</button></div><div className="amount-grid">{food.amounts.map((amount) => <button key={amount} className={`chip amount-chip ${selectedAmount === amount ? "selected" : ""}`} onClick={() => onSelect(food.id, amount)}>{amount}{food.unit === "šejk" ? "" : ` ${food.unit}`}</button>)}</div>{pendingHide && <div className="hide-progress" aria-label="Namirnica će se sakriti za sedam sekundi"/>}</section>; }
