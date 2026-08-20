import type { CategoryId, FoodDefinition } from "./types";
// Persistence and day-boundary constants stay centralized so storage migrations are explicit.
export const STORAGE_KEY = "fyxtez-weight-tracker-authenticated-v2";
export const SERBIA_TIME_ZONE = "Europe/Belgrade";
// Feature: Walking is reported as a 7,000+ daily target instead of the old 6,000-step baseline.
export const DEFAULT_WALKING_STEPS = 7000;
export const COMMON_FOODS_KEY = "fyxtez-weight-tracker-pinned-foods-v1";
export const AUTO_HIDE_DELAY_MS = 7000;
// Feature: Muscle groups stay out of the picker for four calendar days, while walking remains a daily-only activity.
export const WORKOUT_COOLDOWN_DAYS = 4;
// Feature: Rest day is a first-class daily training status so recovery days are visible in monthly history instead of looking like missing data.
export const WORKOUTS = ["Rest day", "Šetnja", "Ramena", "Trapezius", "Grudi", "Leđa", "Biceps", "Triceps", "Podlaktica", "Stomak", "Noge", "Gluteus"] as const;
export const CATEGORIES: Array<{
    id: CategoryId;
    name: string;
    icon: string;
    rare?: boolean;
}> = [
    { id: "meat", name: "Meso", icon: "🥩" },
    { id: "fish", name: "Riba", icon: "🐟" },
    { id: "salad", name: "Salate", icon: "🥗" },
    { id: "dairy", name: "Mlečno", icon: "🥛" },
    { id: "rare", name: "Ostalo", icon: "✦", rare: true },
];
// Nutrition presets are data, not component state, so they live in the domain layer.
export const FOODS: FoodDefinition[] = [
    { id: "pork", name: "Crveno svinjsko meso", detail: "air fryer, bez ulja", icon: "🥩", category: "meat", unit: "g", amounts: [100, 150, 200, 250], per: 100, kcal: 242, protein: 27.3, fat: 13.9, carbs: 0, fiber: 0 },
    { id: "smoked-red-meat", name: "Crveno dimljeno/suvo meso", detail: "prosečna vrednost", icon: "🥓", category: "meat", unit: "g", amounts: [50, 100, 150, 200], per: 100, kcal: 250, protein: 30, fat: 14, carbs: 2, fiber: 0 },
    { id: "chicken", name: "Pileće meso", detail: "air fryer, bez ulja", icon: "🍗", category: "meat", unit: "g", amounts: [100, 200, 300], per: 100, kcal: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0 },
    { id: "turkey", name: "Ćureće meso", detail: "air fryer, bez ulja", icon: "🦃", category: "meat", unit: "g", amounts: [100, 200, 300], per: 100, kcal: 135, protein: 29, fat: 1.6, carbs: 0, fiber: 0 },
    { id: "eggs", name: "Jaja", detail: "kuvana", icon: "🥚", category: "meat", unit: "kom", amounts: [2, 3, 4, 5, 6], per: 1, kcal: 78, protein: 6.3, fat: 5.3, carbs: 0.6, fiber: 0 },
    { id: "salmon", name: "Losos", detail: "air fryer, bez ulja", icon: "🐟", category: "fish", unit: "g", amounts: [100, 150, 200], per: 100, kcal: 208, protein: 20, fat: 13, carbs: 0, fiber: 0 },
    { id: "tuna", name: "Tuna", detail: "oceđena, u vodi", icon: "🐟", category: "fish", unit: "g", amounts: [100, 150, 200], per: 100, kcal: 116, protein: 25.5, fat: 0.8, carbs: 0, fiber: 0 },
    { id: "sardines", name: "Sardina", detail: "oceđena", icon: "🐠", category: "fish", unit: "g", amounts: [100, 150, 200], per: 100, kcal: 208, protein: 24.6, fat: 11.5, carbs: 0, fiber: 0 },
    { id: "hake", name: "Oslić", detail: "air fryer, bez ulja", icon: "🐟", category: "fish", unit: "g", amounts: [100, 200, 300], per: 100, kcal: 90, protein: 18.3, fat: 1.3, carbs: 0, fiber: 0 },
    { id: "spinach", name: "Spanać", detail: "bez dodataka", icon: "🥬", category: "salad", unit: "g", amounts: [100, 150, 200], per: 100, kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2 },
    { id: "green-salad", name: "Zelena salata", detail: "bez ulja", icon: "🥗", category: "salad", unit: "g", amounts: [50, 100, 150], per: 100, kcal: 15, protein: 1.4, fat: 0.2, carbs: 2.9, fiber: 1.3 },
    { id: "broccoli", name: "Brokoli", detail: "bez ulja", icon: "🥦", category: "salad", unit: "g", amounts: [50, 100, 150, 200], per: 100, kcal: 34, protein: 2.8, fat: 0.4, carbs: 6.6, fiber: 2.6 },
    { id: "cauliflower", name: "Karfiol", detail: "bez ulja", icon: "☁️", category: "salad", unit: "g", amounts: [50, 100, 150, 200], per: 100, kcal: 25, protein: 1.9, fat: 0.3, carbs: 5, fiber: 2 },
    { id: "cucumber", name: "Krastavac", detail: "svež", icon: "🥒", category: "salad", unit: "g", amounts: [50, 100, 150, 200], per: 100, kcal: 15, protein: 0.7, fat: 0.1, carbs: 3.6, fiber: 0.5 },
    { id: "blue-cheese", name: "Plavi sir", detail: "punomasni", icon: "🧀", category: "dairy", unit: "g", amounts: [25, 33, 50, 75, 100], per: 100, kcal: 353, protein: 21.4, fat: 28.7, carbs: 2.3, fiber: 0 },
    { id: "imlek-yogurt", name: "Imlek jogurt", detail: "2.8% mlečne masti", icon: "🥛", category: "dairy", unit: "ml", amounts: [200, 300, 400, 500], per: 100, kcal: 55, protein: 3.1, fat: 2.8, carbs: 4.2, fiber: 0 },
    // Fix: The shake remains available under Rare after removing the redundant Routine category and can still be moved to Common.
    // Feature: Three shake portions cover unusually demanding training days without repeated manual entry.
    { id: "anabolic-shake", name: "Anabolički šejk", detail: "whey, kreatin, leucin, kakao", icon: "🥤", category: "rare", unit: "šejk", amounts: [1, 2, 3], per: 1, kcal: 205, protein: 42.5, fat: 2, carbs: 4.5, fiber: 1.7 },
    // Feature: Rare foods stay available for accurate exceptional days without crowding the primary menu.
    // Feature: Pumpkin seeds keep quick presets but also accept exact custom grams in the food card.
    { id: "pumpkin-seeds", name: "Bundevine semenke", detail: "orašasti i semenke", icon: "🌰", category: "rare", unit: "g", amounts: [10, 20, 30, 40], per: 100, kcal: 559, protein: 30.2, fat: 49, carbs: 10.7, fiber: 6 },
    { id: "pecans", name: "Pekani", detail: "orašasti i semenke", icon: "🥜", category: "rare", unit: "g", amounts: [10, 20, 30, 50], per: 100, kcal: 691, protein: 9.2, fat: 72, carbs: 13.9, fiber: 9.6 },
    { id: "walnuts", name: "Orasi", detail: "orašasti i semenke", icon: "🌰", category: "rare", unit: "g", amounts: [10, 20, 30, 50], per: 100, kcal: 654, protein: 15.2, fat: 65.2, carbs: 13.7, fiber: 6.7 },
    { id: "mixed-seeds", name: "Semenke", detail: "mešane", icon: "🌱", category: "rare", unit: "g", amounts: [10, 20, 30, 50], per: 100, kcal: 550, protein: 24, fat: 45, carbs: 18, fiber: 9 },
    { id: "pistachios", name: "Pistaći", detail: "orašasti i semenke", icon: "🟢", category: "rare", unit: "g", amounts: [10, 20, 30, 50], per: 100, kcal: 562, protein: 20.2, fat: 45.3, carbs: 27.2, fiber: 10.6 },
    { id: "blueberries", name: "Borovnice", detail: "sveže", icon: "🫐", category: "rare", unit: "g", amounts: [30, 50, 100, 200], per: 100, kcal: 57, protein: 0.7, fat: 0.3, carbs: 14.5, fiber: 2.4 },
    { id: "beet-juice", name: "Sok od cvekle", detail: "bez dodatog šećera", icon: "🧃", category: "rare", unit: "ml", amounts: [100, 200, 300, 500], per: 100, kcal: 43, protein: 1, fat: 0.1, carbs: 9.6, fiber: 0 },
    { id: "mushrooms", name: "Pečurke", detail: "bez ulja", icon: "🍄", category: "rare", unit: "g", amounts: [100, 200, 300], per: 100, kcal: 22, protein: 3.1, fat: 0.3, carbs: 3.3, fiber: 1 },
    { id: "shrimp", name: "Škampe", detail: "bez ulja", icon: "🦐", category: "rare", unit: "g", amounts: [100, 200, 300], per: 100, kcal: 99, protein: 24, fat: 0.3, carbs: 0.2, fiber: 0 },
    { id: "potato", name: "Krompir", detail: "kuvan", icon: "🥔", category: "rare", unit: "g", amounts: [100, 200, 300], per: 100, kcal: 87, protein: 1.9, fat: 0.1, carbs: 20.1, fiber: 1.8 },
    { id: "rice", name: "Pirinač", detail: "kuvan", icon: "🍚", category: "rare", unit: "g", amounts: [100, 200, 300], per: 100, kcal: 130, protein: 2.7, fat: 0.3, carbs: 28.2, fiber: 0.4 },
    // Feature: Pirinač čips uses the photographed package label per 100 g, with 50 g steps matching one bag for accurate carb-refeed tracking.
    { id: "rice-chips", name: "Pirinač čips", detail: "BBQ pirinčani krugovi", icon: "🍘", category: "rare", unit: "g", amounts: [50, 100, 150, 200], per: 100, kcal: 441, protein: 6.6, fat: 13.5, carbs: 72, fiber: 2.7 },
];
