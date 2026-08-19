import { FOODS, SERBIA_TIME_ZONE } from "./constants";
import type { DayRecord, Nutrition } from "./types";
// Day boundaries use Serbia civil time, including daylight-saving changes.
export const todayKey = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: SERBIA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return `${value("year")}-${value("month")}-${value("day")}`;
};
export const emptyRecord = (date: string): DayRecord => ({ date, weight: null, sleep: "", workout: [], foods: [], savedAt: new Date().toISOString() });
export const round = (value: number, decimals = 0) => Number(value.toFixed(decimals));

// Feature: Date-only workout cooldowns use stable UTC-noon arithmetic so DST changes cannot shift a Serbia calendar day.
export const daysAgoKey = (dateKey: string, days: number) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
};
export const formatDate = (date: string) => new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: SERBIA_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`));
export const hasRecordContent = (record: DayRecord) => record.weight !== null || Boolean(record.sleep) || record.workout.length > 0 || record.foods.length > 0;
// Nutrition is derived from preset portions so reports never depend on repeated manual calorie entry.
export function calculateNutrition(record: DayRecord): Nutrition {
    return record.foods.reduce((total, selection) => {
        const food = FOODS.find((item) => item.id === selection.foodId);
        if (!food)
            return total;
        const ratio = selection.amount / food.per;
        return { kcal: total.kcal + food.kcal * ratio, protein: total.protein + food.protein * ratio, fat: total.fat + food.fat * ratio, carbs: total.carbs + food.carbs * ratio, fiber: total.fiber + food.fiber * ratio };
    }, { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 });
}
