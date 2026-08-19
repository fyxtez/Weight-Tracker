import type { FoodDefinition } from "../domain/types";
import "./FoodIcon.css";
export function FoodIcon({ food }: {
    food: FoodDefinition;
}) {
    if (food.id === "pumpkin-seeds")
        return <svg className="food-svg pumpkin-icon" viewBox="0 0 48 48"><path d="M9 27c0-9 6-16 15-16s15 7 15 16-6 14-15 14S9 36 9 27Z"/><path d="M24 11c0-4 2-6 6-7M17 13c-4 7-4 19 1 26M31 13c4 7 4 19-1 26M24 12v28"/><ellipse cx="24" cy="27" rx="4" ry="8"/></svg>;
    if (food.id === "tuna")
        return <svg className="food-svg fish-svg tuna-icon" viewBox="0 0 48 48"><path d="M8 25c8-12 23-13 32-3l5-6-1 14-7-4C26 35 15 33 8 25Z"/><path d="m22 16 5-7 5 8M23 33l5 6 4-8"/><circle cx="16" cy="23" r="1.6"/></svg>;
    if (food.id === "sardines")
        return <svg className="food-svg fish-svg sardine-icon" viewBox="0 0 48 48"><path d="M7 25c7-8 21-9 31-2l6-5-1 12-6-4c-9 7-23 6-30-1Z"/><path d="M17 20c5 2 10 3 17 3M17 28c5-2 10-2 17-2"/><circle cx="13" cy="24" r="1.4"/></svg>;
    if (food.id === "hake")
        return <svg className="food-svg fish-svg hake-icon" viewBox="0 0 48 48"><path d="M6 25c9-9 24-12 34-4l5-7-1 16-7-5C27 34 15 34 6 25Z"/><path d="M19 18c6-5 11-7 16-6M20 32c7 3 12 3 16 1"/><circle cx="13" cy="24" r="1.5"/></svg>;
    if (food.id === "spinach")
        return <svg className="food-svg spinach-icon" viewBox="0 0 48 48"><path d="M24 39C8 34 7 18 13 8c11 0 25 6 25 18 0 8-6 13-14 13Z"/><path d="M16 31c7-5 12-10 17-17M21 26l-1-9M26 22l8 1M17 35l-4 7"/></svg>;
    return <>{food.icon}</>;
}
