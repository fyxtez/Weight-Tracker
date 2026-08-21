export type Tab = "today" | "food" | "report";
// Feature: Dedicated nut/seed and carb categories keep Ostalo limited to true miscellaneous foods.
export type CategoryId = "meat" | "fish" | "salad" | "dairy" | "nuts" | "carbs" | "rare";
export type FoodView = CategoryId | "common";
export type Nutrition = {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number;
};
export type FoodDefinition = Nutrition & {
    id: string;
    name: string;
    detail: string;
    icon: string;
    category: CategoryId;
    unit: "g" | "ml" | "kom" | "šejk";
    amounts: number[];
    per: number;
};
export type FoodSelection = {
    foodId: string;
    amount: number;
};
export type DayRecord = {
    date: string;
    weight: number | null;
    sleep: string;
    workout: string[];
    foods: FoodSelection[];
    savedAt: string;
};
export type OneTimeField = "weight" | "sleep";
export type SyncStatus = "loading" | "saving" | "saved" | "offline";
