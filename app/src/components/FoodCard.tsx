import { useEffect, useState } from "react";
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
export function FoodCard({ food, selectedAmount, common, pendingHide, onSelect, onCommon }: Props) {
    const supportsCustomAmount = food.id === "pumpkin-seeds";
    const [customAmount, setCustomAmount] = useState("");

    useEffect(() => {
        // Feature: If pumpkin seeds were saved with a non-preset gram value, show that exact value when the card is reopened.
        if (supportsCustomAmount && selectedAmount !== undefined && !food.amounts.includes(selectedAmount))
            setCustomAmount(String(selectedAmount));
    }, [food.amounts, selectedAmount, supportsCustomAmount]);

    function submitCustomAmount() {
        const amount = Number(customAmount.replace(",", "."));
        // Fix: Reject empty/invalid custom grams so a malformed input can never enter nutrition totals or server history.
        if (!Number.isFinite(amount) || amount <= 0 || amount > 500)
            return;
        onSelect(food.id, Math.round(amount * 10) / 10);
    }

    return <section className={`card food-card ${common ? "common-food" : ""}`}><div className="food-title"><div className="food-icon"><FoodIcon food={food}/></div><div className="food-copy"><h2>{food.name}</h2><p>{food.detail}</p></div><button className={`common-button ${common ? "active" : ""}`} onClick={() => onCommon(food.id)} aria-label={common ? `Vrati ${food.name} u originalnu kategoriju` : `Premesti ${food.name} u Osnovno`} title={common ? "Vrati u originalnu kategoriju" : "Premesti u Osnovno"}>★</button></div><div className="amount-grid">{food.amounts.map((amount) => <button key={amount} className={`chip amount-chip ${selectedAmount === amount ? "selected" : ""}`} onClick={() => onSelect(food.id, amount)}>{amount}{food.unit === "šejk" ? "" : ` ${food.unit}`}</button>)}</div>{supportsCustomAmount && <div className="custom-amount-row">{/* Feature: Exact pumpkin-seed grams feed the same FoodSelection amount used by calculateNutrition, so partial portions count correctly. */}<input aria-label="Custom gramaža bundevinih semenki" inputMode="decimal" type="number" min="0.1" max="500" step="0.1" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitCustomAmount(); }} placeholder="Custom g"/><button className="custom-amount-button" onClick={submitCustomAmount}>Unesi</button></div>}{pendingHide && <div className="hide-progress" aria-label="Namirnica će se sakriti za sedam sekundi"/>}</section>;
}
