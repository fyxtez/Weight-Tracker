import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { shareFile } from "@choochmeque/tauri-plugin-sharekit-api";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./App.css";
import { api, type AuthUser } from "./api";

type Tab = "today" | "food" | "report";
type CategoryId = "meat" | "fish" | "salad" | "dairy" | "rare";
type FoodView = CategoryId | "common";
type Nutrition = { kcal: number; protein: number; fat: number; carbs: number; fiber: number };
type FoodDefinition = Nutrition & { id: string; name: string; detail: string; icon: string; category: CategoryId; unit: "g" | "ml" | "kom" | "šejk"; amounts: number[]; per: number };
type FoodSelection = { foodId: string; amount: number };
type DayRecord = { date: string; weight: number | null; sleep: string; workout: string[]; foods: FoodSelection[]; savedAt: string };
type OneTimeField = "weight" | "sleep";

// Feature: A new cache namespace intentionally gives the authenticated app a clean start without importing legacy local-only records.
const STORAGE_KEY = "fyxtez-weight-tracker-authenticated-v2";
const SERBIA_TIME_ZONE = "Europe/Belgrade";
// Feature: Selecting walking records a conservative baseline for later analysis without adding another manual field.
const DEFAULT_WALKING_STEPS = 6_000;
// Fix: Keep the old storage key so existing pins migrate into Common without losing the user's choices.
const COMMON_FOODS_KEY = "fyxtez-weight-tracker-pinned-foods-v1";
// Feature: Seven seconds leaves a calmer correction window before completed one-time inputs and foods collapse.
const AUTO_HIDE_DELAY_MS = 7_000;

// Feature: Primary categories use larger radial controls while infrequent foods stay behind a smaller Rare entry.
const CATEGORIES: Array<{ id: CategoryId; name: string; icon: string; rare?: boolean }> = [
  { id: "meat", name: "Meso", icon: "🥩" },
  { id: "fish", name: "Riba", icon: "🐟" },
  { id: "salad", name: "Salate", icon: "🥗" },
  { id: "dairy", name: "Mlečno", icon: "🥛" },
  { id: "rare", name: "Ostalo", icon: "✦", rare: true },
];

// Feature: Centralized definitions keep every one-tap amount deterministic and make later nutrition edits safe.
const FOODS: FoodDefinition[] = [
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
];

// Fix: Day boundaries use Serbia's civil time instead of UTC, including daylight-saving changes.
const todayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: SERBIA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const emptyRecord = (date: string): DayRecord => ({ date, weight: null, sleep: "", workout: [], foods: [], savedAt: new Date().toISOString() });
const round = (value: number, decimals = 0) => Number(value.toFixed(decimals));
const formatDate = (date: string) => new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: SERBIA_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`));
const hasRecordContent = (record: DayRecord) => record.weight !== null || Boolean(record.sleep) || record.workout.length > 0 || record.foods.length > 0;

// Feature: Nutrition is derived from preset portions, so reports never depend on repeated manual calorie entry.
function calculateNutrition(record: DayRecord): Nutrition {
  return record.foods.reduce((total, selection) => {
    const food = FOODS.find((item) => item.id === selection.foodId);
    if (!food) return total;
    const ratio = selection.amount / food.per;
    return { kcal: total.kcal + food.kcal * ratio, protein: total.protein + food.protein * ratio, fat: total.fat + food.fat * ratio, carbs: total.carbs + food.carbs * ratio, fiber: total.fiber + food.fiber * ratio };
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 });
}

function App() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => {
    // Feature: A persisted rotating refresh session restores the account automatically after an app restart.
    void api.restoreSession().then(setUser);
  }, []);
  if (user === undefined) return <main className="auth-shell"><div className="auth-mark auth-loading">W</div></main>;
  return user ? <TrackerApp/> : <LoginScreen onLogin={setUser}/>;
}

function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    if (mode === "register" && password !== confirmPassword) { setError("Lozinke se ne podudaraju."); setLoading(false); return; }
    try { onLogin(mode === "login" ? await api.login(email, password) : await api.register(email, password)); } catch (reason) { setError(reason instanceof Error ? reason.message : mode === "login" ? "Prijava nije uspela." : "Nalog nije napravljen."); } finally { setLoading(false); }
  }
  return <main className="auth-shell"><section className="auth-card card">
    <div className="auth-mark">W</div><span className="eyebrow">WEIGHT CUT TRACKER</span><h1>{mode === "login" ? "Dobrodošao nazad" : "Napravi nalog"}</h1><p>{mode === "login" ? "Prijavi se da bi tvoji podaci bili dostupni na telefonu i desktopu." : "Izaberi email i lozinku za sinhronizaciju svojih podataka."}</p>
    <form onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></label><label>Lozinka<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required/></label>{mode === "register" && <label>Potvrdi lozinku<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/></label>}{error && <div className="auth-error" role="alert">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Molim sačekaj…" : mode === "login" ? "Prijavi se" : "Napravi nalog"}</button></form>
    <button className="auth-mode-button" onClick={() => { setMode((current) => current === "login" ? "register" : "login"); setError(""); setConfirmPassword(""); }}>{mode === "login" ? "Nemaš nalog? Registruj se" : "Već imaš nalog? Prijavi se"}</button>
    <small>Prijava ostaje aktivna do 30 dana.</small>
  </section></main>;
}

function TrackerApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [records, setRecords] = useState<DayRecord[]>(() => {
    // Feature: Local persistence makes the personal tracker fully usable offline inside Tauri.
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Array<Omit<DayRecord, "workout"> & { workout?: string | string[]; note?: string; customTags?: string[] }>;
      // Fix: Existing single-workout records are migrated to arrays so multi-select training remains backward compatible.
      return stored.map((record) => {
        // Fix: Obsolete note/tag fields are discarded when loading because deviation tracking was removed completely.
        const { customTags: _customTags, note: _note, ...baseRecord } = record;
        return ({
        ...baseRecord,
        workout: Array.isArray(record.workout) ? record.workout : record.workout ? [record.workout] : [],
        // Fix: Older whey scoop selections represent one complete shake and are migrated without losing saved days.
        foods: record.foods.map((food) => food.foodId === "whey" ? { foodId: "anabolic-shake", amount: 1 } : food),
      }); })
        // Fix: Legacy empty days are removed so they cannot lower calorie averages or create blank CSV rows.
        .filter(hasRecordContent);
    } catch { return []; }
  });
  const [draft, setDraft] = useState<DayRecord>(() => records.find((item) => item.date === todayKey()) ?? emptyRecord(todayKey()));
  const [weightInput, setWeightInput] = useState(draft.weight?.toString() ?? "");
  const [notice, setNotice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FoodView | null>(null);
  const [hiddenFoods, setHiddenFoods] = useState<string[]>(() => draft.foods.filter((food) => food.foodId !== "anabolic-shake").map((food) => food.foodId));
  const [pendingHideFoods, setPendingHideFoods] = useState<string[]>([]);
  const [showHiddenFoods, setShowHiddenFoods] = useState(false);
  const [showTodayFoods, setShowTodayFoods] = useState(false);
  const [showExportActions, setShowExportActions] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [collapsedOneTimeFields, setCollapsedOneTimeFields] = useState<Record<OneTimeField, boolean>>({ weight: draft.weight !== null, sleep: Boolean(draft.sleep) });
  const [oneTimeCountdowns, setOneTimeCountdowns] = useState<Record<OneTimeField, number>>({ weight: 0, sleep: 0 });
  const [serverReady, setServerReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "saved" | "offline">("loading");
  const [commonFoods, setCommonFoods] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(COMMON_FOODS_KEY) ?? "[]") as string[]; } catch { return []; }
  });
  const autosaveReady = useRef(false);
  const hideTimers = useRef<Record<string, number>>({});
  const oneTimeTimers = useRef<Partial<Record<OneTimeField, number>>>({});

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }, [records]);
  useEffect(() => { localStorage.setItem(COMMON_FOODS_KEY, JSON.stringify(commonFoods)); }, [commonFoods]);
  useEffect(() => {
    if (!serverReady) return;
    // Feature: Every meaningful draft change is committed locally and remotely without a redundant save button.
    if (!autosaveReady.current) { autosaveReady.current = true; return; }
    // Fix: A freshly reset day stays out of history until the user actually enters something.
    if (!hasRecordContent(draft)) {
      setRecords((current) => current.filter((item) => item.date !== draft.date));
      setSyncStatus("saving");
      void api.deleteDay(draft.date).then(() => setSyncStatus("saved")).catch(() => setSyncStatus("offline"));
      return;
    }
    const saved = { ...draft, savedAt: new Date().toISOString() };
    setRecords((current) => [saved, ...current.filter((item) => item.date !== saved.date)]);
    setSyncStatus("saving");
    void api.putDay(saved.date, { weight: saved.weight, sleep: saved.sleep, workout: saved.workout, foods: saved.foods }).then(() => setSyncStatus("saved")).catch(() => setSyncStatus("offline"));
  }, [draft, serverReady]);
  useEffect(() => {
    // Feature: The authenticated server is authoritative on login; the clean local cache is replaced with this user's history.
    void api.listDays<Omit<DayRecord, "date" | "savedAt">>().then((days) => {
      const loaded = days.map((day) => ({ ...day.payload, date: day.localDate, savedAt: day.updatedAt }));
      setRecords(loaded); const today = loaded.find((record) => record.date === todayKey()) ?? emptyRecord(todayKey());
      setDraft(today); setWeightInput(today.weight?.toString() ?? "");
      // Feature: Already completed morning fields load in their compact state instead of occupying the whole Today screen again.
      setCollapsedOneTimeFields({ weight: today.weight !== null, sleep: Boolean(today.sleep) });
      setOneTimeCountdowns({ weight: 0, sleep: 0 });
      setServerReady(true); setSyncStatus("saved");
    }).catch(() => { setServerReady(true); setSyncStatus("offline"); });
  }, []);
  useEffect(() => () => {
    // Fix: Pending hide timers are cleared on unmount so they cannot update a closed Tauri view.
    Object.values(hideTimers.current).forEach((timerId) => window.clearTimeout(timerId));
    Object.values(oneTimeTimers.current).forEach((timerId) => window.clearTimeout(timerId));
  }, []);
  useEffect(() => {
    if (!showExportActions) return;
    // Feature: Opening report actions scrolls to the absolute page end so every option is visible on mobile.
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [showExportActions]);
  useEffect(() => {
    // Feature: Android's system Back button and edge-back gesture close an open food category before the app can exit.
    const handleSystemBack = () => setSelectedCategory(null);
    window.addEventListener("popstate", handleSystemBack);
    return () => window.removeEventListener("popstate", handleSystemBack);
  }, []);
  useEffect(() => {
    function rollOverToSerbiaDay() {
      const currentDate = todayKey();
      setDraft((current) => {
        if (current.date === currentDate) return current;
        // Fix: On a Belgrade date change, daily inputs reset while persistent Common preferences remain untouched.
        let storedRecords: DayRecord[] = [];
        try { storedRecords = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as DayRecord[]; } catch { /* A corrupt cache safely falls back to an empty day. */ }
        const next = storedRecords.find((record) => record.date === currentDate) ?? emptyRecord(currentDate);
        Object.values(hideTimers.current).forEach((timerId) => window.clearTimeout(timerId));
        hideTimers.current = {};
        Object.values(oneTimeTimers.current).forEach((timerId) => window.clearTimeout(timerId));
        oneTimeTimers.current = {};
        setWeightInput(next.weight?.toString() ?? "");
        setCollapsedOneTimeFields({ weight: next.weight !== null, sleep: Boolean(next.sleep) });
        setOneTimeCountdowns({ weight: 0, sleep: 0 });
        setSelectedCategory(null);
        setPendingHideFoods([]);
        setHiddenFoods(next.foods.filter((food) => food.foodId !== "anabolic-shake").map((food) => food.foodId));
        setShowHiddenFoods(false);
        return next;
      });
    }

    // Feature: A short foreground check plus focus/visibility events also catches midnight while Android suspended the app.
    const intervalId = window.setInterval(rollOverToSerbiaDay, 15_000);
    const handleVisibility = () => { if (document.visibilityState === "visible") rollOverToSerbiaDay(); };
    window.addEventListener("focus", rollOverToSerbiaDay);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", rollOverToSerbiaDay);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const nutrition = useMemo(() => calculateNutrition(draft), [draft]);
  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);
  const reportRecords = sortedRecords.slice(0, 7);
  const weightedRecords = reportRecords.filter((record) => record.weight !== null);
  const averageWeight = weightedRecords.length ? weightedRecords.reduce((sum, record) => sum + (record.weight ?? 0), 0) / weightedRecords.length : null;
  const weightChange = weightedRecords.length > 1 ? (weightedRecords[0].weight ?? 0) - (weightedRecords[weightedRecords.length - 1].weight ?? 0) : null;
  const averageCalories = reportRecords.length ? reportRecords.reduce((sum, record) => sum + calculateNutrition(record).kcal, 0) / reportRecords.length : 0;
  // Feature: Common owns starred foods, so the same item never appears in Common and its original category simultaneously.
  const categoryFoods = useMemo(() => {
    const categoryItems = selectedCategory === "common"
      ? FOODS.filter((food) => commonFoods.includes(food.id))
      : selectedCategory
        ? FOODS.filter((food) => food.category === selectedCategory && !commonFoods.includes(food.id))
        : [];
    // Fix: The primary category list never changes order when hidden foods are revealed in their dedicated section.
    return categoryItems.filter((food) => !hiddenFoods.includes(food.id));
  }, [commonFoods, hiddenFoods, selectedCategory]);
  const hiddenCategoryFoods = useMemo(() => {
    const categoryItems = selectedCategory === "common"
      ? FOODS.filter((food) => commonFoods.includes(food.id))
      : selectedCategory
        ? FOODS.filter((food) => food.category === selectedCategory && !commonFoods.includes(food.id))
        : [];
    return categoryItems.filter((food) => hiddenFoods.includes(food.id));
  }, [commonFoods, hiddenFoods, selectedCategory]);

  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2200); }

  function scheduleOneTimeHide(field: OneTimeField) {
    if (oneTimeTimers.current[field]) window.clearTimeout(oneTimeTimers.current[field]);
    setCollapsedOneTimeFields((current) => ({ ...current, [field]: false }));
    // Feature: Incrementing the countdown key restarts the visual bar when a value is corrected during its grace period.
    setOneTimeCountdowns((current) => ({ ...current, [field]: current[field] + 1 }));
    oneTimeTimers.current[field] = window.setTimeout(() => {
      setCollapsedOneTimeFields((current) => ({ ...current, [field]: true }));
      setOneTimeCountdowns((current) => ({ ...current, [field]: 0 }));
      delete oneTimeTimers.current[field];
    }, AUTO_HIDE_DELAY_MS);
  }

  function revealOneTimeField(field: OneTimeField) {
    // Feature: Compact completed values remain editable through an explicit reveal action.
    if (oneTimeTimers.current[field]) window.clearTimeout(oneTimeTimers.current[field]);
    delete oneTimeTimers.current[field];
    setOneTimeCountdowns((current) => ({ ...current, [field]: 0 }));
    setCollapsedOneTimeFields((current) => ({ ...current, [field]: false }));
  }

  function updateWeight(value: string) {
    setWeightInput(value);
    // Feature: Clearing the field also clears the saved weight instead of silently retaining the previous value.
    if (!value.trim()) { setDraft((current) => ({ ...current, weight: null })); revealOneTimeField("weight"); return; }
    const weight = Number(value.replace(",", "."));
    // Feature: A complete valid weight autosaves while partial typing remains editable without corrupting the record.
    if (Number.isFinite(weight) && weight >= 40 && weight <= 250) {
      setDraft((current) => ({ ...current, weight: round(weight, 1) }));
      scheduleOneTimeHide("weight");
    }
  }

  function updateSleep(sleep: string) {
    // Feature: Sleep is a once-per-day value, so selection autosaves and then collapses after the shared grace period.
    setDraft((current) => ({ ...current, sleep }));
    scheduleOneTimeHide("sleep");
  }

  function selectFood(foodId: string, amount: number) {
    // Feature: One amount per food is active; selecting it again removes the food for quick correction.
    const existing = draft.foods.find((item) => item.foodId === foodId);
    const removing = existing?.amount === amount;
    setDraft((current) => {
      const foods = existing?.amount === amount ? current.foods.filter((item) => item.foodId !== foodId) : [...current.foods.filter((item) => item.foodId !== foodId), { foodId, amount }];
      return { ...current, foods };
    });
    if (foodId === "anabolic-shake") return;

    if (hideTimers.current[foodId]) window.clearTimeout(hideTimers.current[foodId]);
    delete hideTimers.current[foodId];
    setPendingHideFoods((current) => current.filter((id) => id !== foodId));
    if (removing) {
      // Fix: Correcting a selected portion immediately restores the food and cancels its pending auto-hide.
      setHiddenFoods((current) => current.filter((id) => id !== foodId));
      return;
    }

    setHiddenFoods((current) => current.filter((id) => id !== foodId));
    setPendingHideFoods((current) => [...current.filter((id) => id !== foodId), foodId]);
    // Feature: A seven-second undo window keeps accidental portion taps visible before the card is hidden.
    hideTimers.current[foodId] = window.setTimeout(() => {
      setPendingHideFoods((current) => current.filter((id) => id !== foodId));
      setHiddenFoods((current) => current.includes(foodId) ? current : [...current, foodId]);
      delete hideTimers.current[foodId];
    }, AUTO_HIDE_DELAY_MS);
  }

  function toggleWorkout(workout: string) {
    // Feature: Muscle groups are independently toggleable because one session commonly trains several groups.
    setDraft((current) => ({
      ...current,
      workout: current.workout.includes(workout)
        ? current.workout.filter((item) => item !== workout)
        : [...current.workout, workout],
    }));
  }

  function toggleCommonFood(foodId: string) {
    // Feature: The star moves a food between Common and its original category while keeping daily selections untouched.
    setCommonFoods((current) => current.includes(foodId) ? current.filter((id) => id !== foodId) : [...current, foodId]);
  }

  function openFoodCategory(category: FoodView) {
    // Feature: A lightweight browser-history entry lets Android WebView translate its native Back action into in-app navigation.
    window.history.pushState({ ...window.history.state, weightTrackerLayer: "food-category" }, "");
    setShowHiddenFoods(false);
    setSelectedCategory(category);
  }

  function closeFoodCategory() {
    // Fix: The visible back control consumes the same temporary history entry as Android Back, keeping both paths synchronized.
    if (window.history.state?.weightTrackerLayer === "food-category") window.history.back();
    else setSelectedCategory(null);
  }

  function buildReportFile() {
    // Feature: CSV is compact, human-readable, and directly analyzable when shared in chat.
    const header = ["datum", "tezina_kg", "san", "trening", "koraci", "namirnice_i_doprinos", "kcal_ukupno", "protein_g", "masti_g", "uh_ukupno_g", "vlakna_g", "neto_uh_g"];
    const rows = sortedRecords.map((record) => {
      const totals = calculateNutrition(record);
      // Feature: Every food carries its own calorie, carbohydrate, and fiber contribution inside the exported day.
      const foods = record.foods.map((selection) => {
        const food = FOODS.find((item) => item.id === selection.foodId);
        if (!food) return selection.foodId;
        const ratio = selection.amount / food.per;
        const amount = `${selection.amount}${food.unit === "g" ? " g" : ` ${food.unit}`}`;
        return `${food.name} ${amount}: ${round(food.kcal * ratio)} kcal, ${round(food.carbs * ratio, 1)} g UH, ${round(food.fiber * ratio, 1)} g vlakana`;
      }).join(" | ");
      const walkingSteps = record.workout.includes("Šetnja") ? DEFAULT_WALKING_STEPS : 0;
      return [record.date, record.weight ?? "", record.sleep, record.workout.join(" | "), walkingSteps, foods, round(totals.kcal), round(totals.protein, 1), round(totals.fat, 1), round(totals.carbs, 1), round(totals.fiber, 1), round(Math.max(0, totals.carbs - totals.fiber), 1)];
    });
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const fileName = `weight-cut-report-${todayKey()}.csv`;
    return { csv, fileName };
  }

  async function shareReport() {
    const { csv, fileName } = buildReportFile();
    try {
      // Fix: Native ShareKit uses Android ACTION_SEND, producing a real chooser with Telegram, WhatsApp, Bluetooth and other targets.
      const savedPath = await invoke<string>("export_report", { csv, fileName });
      const fileUrl = `file://${savedPath.startsWith("/") ? "" : "/"}${savedPath}`;
      await shareFile(fileUrl, { mimeType: "text/csv", title: fileName });
    } catch {
      flash("Deljenje nije uspelo. Proveri da li je instalirana aplikacija za deljenje fajlova.");
    }
  }

  async function saveReport(existingCsv?: string, existingFileName?: string) {
    const built = existingCsv && existingFileName ? { csv: existingCsv, fileName: existingFileName } : buildReportFile();
    try {
      // Fix: Tauri writes through Rust and returns the real destination instead of claiming an invisible browser download succeeded.
      await invoke<string>("export_report", { csv: built.csv, fileName: built.fileName });
      // Fix: A short human label replaces the long technical path that overflowed the mobile toast.
      flash(`Sačuvano u Downloads: ${built.fileName}`);
    } catch {
      // Fix: Browser preview retains a normal download fallback while the packaged app uses the reliable native path above.
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([built.csv], { type: "text/csv;charset=utf-8" }));
      link.download = built.fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      flash(`Preuzeto kao: ${built.fileName}`);
    }
  }

  return <main className="app-shell">
    <header className="topbar"><div><span className="eyebrow">WEIGHT CUT TRACKER</span><h1>{tab === "today" ? "Danas" : tab === "food" ? "Hrana" : "Izveštaj"}</h1></div>{syncStatus !== "saved" && <span className={`sync-state ${syncStatus}`}>{syncStatus === "loading" ? "Učitavanje" : syncStatus === "saving" ? "Čuvanje" : "Offline"}</span>}</header>
    <section className="content">
      {tab === "today" && <div className="screen-grid">
        {collapsedOneTimeFields.weight ? <CompletedDailyField label="Jutarnja težina" value={`${draft.weight?.toFixed(1) ?? "—"} kg`} onEdit={() => revealOneTimeField("weight")}/> : <section className="card weight-card daily-entry-card"><span className="section-label">Jutarnja težina</span><div className="weight-entry"><input aria-label="Jutarnja težina" inputMode="decimal" value={weightInput} onChange={(event) => updateWeight(event.target.value)} placeholder="104.6"/><span>kg</span></div>{oneTimeCountdowns.weight > 0 && <div key={`weight-${oneTimeCountdowns.weight}`} className="hide-progress daily-hide-progress" aria-label="Jutarnja težina će se sklopiti za sedam sekundi"/>}</section>}
        {collapsedOneTimeFields.sleep ? <CompletedDailyField label="San protekle noći" value={draft.sleep || "—"} onEdit={() => revealOneTimeField("sleep")}/> : <section className="card compact-card daily-entry-card"><span className="section-label">San protekle noći</span><div className="chip-row">{["<6h", "6h", "7h", "8h+"].map((sleep) => <button key={sleep} className={`chip ${draft.sleep === sleep ? "selected" : ""}`} onClick={() => updateSleep(sleep)}>{sleep}</button>)}</div>{oneTimeCountdowns.sleep > 0 && <div key={`sleep-${oneTimeCountdowns.sleep}`} className="hide-progress daily-hide-progress" aria-label="San protekle noći će se sklopiti za sedam sekundi"/>}</section>}
        {/* Fix: Workouts belong to the current day and remain open because multiple sessions can be recorded throughout it. */}
        <section className="card compact-card"><div className="section-heading"><span className="section-label">Trening danas</span><span className="helper-inline">izaberi više</span></div><div className="chip-row workout-row">{["Šetnja", "Ramena", "Trapezius", "Grudi", "Leđa", "Biceps", "Triceps", "Podlaktica", "Stomak", "Noge", "Gluteus"].map((workout) => <button key={workout} className={`chip ${draft.workout.includes(workout) ? "selected" : ""}`} onClick={() => toggleWorkout(workout)}>{workout}</button>)}</div></section>
        <section className="card summary-card"><div className="card-heading"><span className="section-label">Sažetak danas</span><button className="text-button" onClick={() => setTab("food")}>Dodaj hranu →</button></div><div className="stats-grid"><Stat label="Namirnice" value={draft.foods.length.toString()} suffix="stavki"/><Stat label="Kalorije" value={round(nutrition.kcal).toLocaleString("sr-RS")} suffix="kcal"/><Stat label="Protein" value={round(nutrition.protein).toString()} suffix="g"/></div></section>
      </div>}
      {tab === "food" && <div className="food-screen">
        {selectedCategory === null ? <>
          {/* Fix: The wheel is self-explanatory, so redundant category labels were removed to keep the food screen compact. */}
          <section className="category-section"><CategoryWheel onSelect={openFoodCategory}/></section>
        </> : <>
          <div className="category-header"><button className="back-button" onClick={closeFoodCategory}>← Kategorije</button><div><span className="eyebrow">OTVORENO</span><h2>{selectedCategory === "common" ? "Osnovno" : CATEGORIES.find((category) => category.id === selectedCategory)?.name}</h2></div></div>
          {categoryFoods.length > 0 ? <div className="food-list">{categoryFoods.map((food) => <FoodCard key={food.id} food={food} selectedAmount={draft.foods.find((item) => item.foodId === food.id)?.amount} common={commonFoods.includes(food.id)} pendingHide={pendingHideFoods.includes(food.id)} onSelect={selectFood} onCommon={toggleCommonFood}/>)}</div> : <div className="card common-empty">{selectedCategory === "common" && commonFoods.length === 0 ? "Označi zvezdicom namirnice koje želiš u Osnovno." : "U ovoj kategoriji nema vidljivih namirnica."}</div>}
          {/* Feature: Completed foods open below the active list in a dedicated section, preserving the original category order. */}
          {hiddenCategoryFoods.length > 0 && <section className={`hidden-food-section ${showHiddenFoods ? "open" : ""}`}>
            <button className={`hidden-food-toggle ${showHiddenFoods ? "active" : ""}`} onClick={() => setShowHiddenFoods((current) => !current)} aria-expanded={showHiddenFoods}>{showHiddenFoods ? "Sakrij završene" : `Prikaži skrivene (${hiddenCategoryFoods.length})`}</button>
            {showHiddenFoods && <div className="hidden-food-panel"><div className="hidden-food-heading"><span className="eyebrow">SKRIVENO DANAS</span><strong>Već unete namirnice</strong></div><div className="food-list">{hiddenCategoryFoods.map((food) => <FoodCard key={food.id} food={food} selectedAmount={draft.foods.find((item) => item.foodId === food.id)?.amount} common={commonFoods.includes(food.id)} pendingHide={false} onSelect={selectFood} onCommon={toggleCommonFood}/>)}</div></div>}
          </section>}
        </>}
        <div className="food-totals"><strong>{round(nutrition.kcal).toLocaleString("sr-RS")} kcal</strong><span>{round(nutrition.protein)} g proteina</span></div>
        {/* Feature: An expandable daily-food receipt confirms every autosaved choice without crowding the category flow. */}
        <section className={`card today-foods ${showTodayFoods ? "open" : ""}`}>
          <button className="today-foods-trigger" onClick={() => setShowTodayFoods((current) => !current)} aria-expanded={showTodayFoods}>
            <div><span>DANAŠNJI UNOS</span><strong>{draft.foods.length ? `${draft.foods.length} ${draft.foods.length === 1 ? "namirnica" : draft.foods.length < 5 ? "namirnice" : "namirnica"}` : "Još nema hrane"}</strong></div><b aria-hidden="true">⌄</b>
          </button>
          <div className="today-foods-reveal"><div className="today-foods-list">{draft.foods.map((selection) => {
            const food = FOODS.find((item) => item.id === selection.foodId);
            if (!food) return null;
            const amount = food.unit === "šejk" ? `${selection.amount}×` : `${selection.amount} ${food.unit}`;
            return <div className="today-food-row" key={food.id}><span className="today-food-icon"><FoodIcon food={food}/></span><strong>{food.name}</strong><span>{amount}</span></div>;
          })}</div></div>
        </section>
      </div>}
      {tab === "report" && <div className="report-screen">
        <section className="card chart-card"><div className="card-heading"><div><span className="section-label">Težina</span><h2>Poslednjih 7 merenja</h2></div><span className="trend-label">7d prosek</span></div><WeightChart records={reportRecords}/></section>
        <div className="report-stats"><StatCard label="7d prosek" value={averageWeight === null ? "—" : averageWeight.toFixed(1)} suffix="kg"/><StatCard label="Promena" value={weightChange === null ? "—" : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)}`} suffix="kg" positive={weightChange !== null && weightChange < 0}/><StatCard label="Prosek" value={round(averageCalories).toLocaleString("sr-RS")} suffix="kcal"/></div>
        <section className="card table-card"><div className="card-heading"><span className="section-label">Poslednjih 7 dana</span><span className="muted">prevuci tabelu →</span></div>{reportRecords.length === 0 ? <div className="empty-state">Unesi prvi podatak da bi se ovde pojavio trend.</div> : <div className="table-scroll"><table><thead><tr><th>Datum</th><th>Težina</th><th>Kcal</th><th>Protein</th><th>UH / vlakna</th><th>Trening</th></tr></thead><tbody>{reportRecords.map((record) => { const totals = calculateNutrition(record); return <tr key={record.date}><td>{formatDate(record.date)}</td><td>{record.weight?.toFixed(1) ?? "—"} kg</td><td>{round(totals.kcal).toLocaleString("sr-RS")}</td><td>{round(totals.protein)} g</td><td>{round(totals.carbs, 1)} / {round(totals.fiber, 1)} g</td><td>{record.workout.join(", ") || "—"}</td></tr>; })}</tbody></table></div>}</section>
        <button className={`primary-button export-button ${records.length === 0 ? "visually-disabled" : ""}`} onClick={records.length ? () => setShowExportActions((current) => !current) : undefined} aria-disabled={records.length === 0}>↗ Izveštaj opcije</button>
        {showExportActions && <section className="card export-actions" aria-label="Opcije izveštaja">
          {/* Feature: Report actions separate preview, sharing and destination choice so the exported file is never a mystery. */}
          <button onClick={() => { setShowReportPreview(true); setShowExportActions(false); }}><span>◉</span><strong>Otvori</strong><small>pregledaj unutar aplikacije</small></button>
          <button onClick={() => { void shareReport(); setShowExportActions(false); }}><span>↗</span><strong>Podeli</strong><small>Telegram, WhatsApp, Bluetooth…</small></button>
          <button onClick={() => { void saveReport(); setShowExportActions(false); }}><span>↓</span><strong>Sačuvaj kao…</strong><small>preuzmi u Downloads</small></button>
        </section>}
      </div>}
    </section>
    <nav className="bottom-nav" aria-label="Glavna navigacija"><NavButton active={tab === "today"} label="Danas" icon="⌂" onClick={() => setTab("today")}/><NavButton active={tab === "food"} label="Hrana" icon="◉" onClick={() => setTab("food")}/><NavButton active={tab === "report"} label="Izveštaj" icon="▥" onClick={() => setTab("report")}/></nav>
    {showReportPreview && <div className="report-preview-backdrop" role="presentation" onClick={() => setShowReportPreview(false)}><section className="report-preview" role="dialog" aria-modal="true" aria-label="Pregled izveštaja" onClick={(event) => event.stopPropagation()}>
      <header><div><span className="eyebrow">IZVEZENI PODACI</span><h2>Pregled izveštaja</h2></div><button onClick={() => setShowReportPreview(false)} aria-label="Zatvori pregled">×</button></header>
      <div className="report-preview-days">{sortedRecords.map((record) => { const totals = calculateNutrition(record); return <article key={record.date}><div className="preview-day-heading"><strong>{formatDate(record.date)}</strong><span>{record.weight?.toFixed(1) ?? "—"} kg · {round(totals.kcal)} kcal</span></div><div className="preview-meta"><span>{record.sleep ? `San ${record.sleep}` : "San —"}</span><span>{record.workout.join(", ") || "Bez treninga"}</span>{record.workout.includes("Šetnja") && <span>{DEFAULT_WALKING_STEPS.toLocaleString("sr-RS")} koraka</span>}</div><div className="preview-foods">{record.foods.map((selection) => { const food = FOODS.find((item) => item.id === selection.foodId); if (!food) return null; return <span key={food.id}>{food.icon} {food.name} · {food.unit === "šejk" ? `${selection.amount}×` : `${selection.amount} ${food.unit}`}</span>; })}</div></article>; })}</div>
      <button className="primary-button" onClick={() => setShowReportPreview(false)}>Zatvori</button>
    </section></div>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) { return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{suffix}</small></div>; }
function StatCard({ label, value, suffix, positive = false }: { label: string; value: string; suffix: string; positive?: boolean }) { return <div className="card stat-card"><span>{label}</span><div className={positive ? "positive" : ""}><strong>{value}</strong><small>{suffix}</small></div></div>; }
function CompletedDailyField({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  // Feature: A compact completed row keeps the value visible while returning most of the Today screen to active tasks.
  return <section className="card completed-daily-field"><div><span>{label}</span><strong>{value}</strong></div><button onClick={onEdit}>Izmeni</button></section>;
}
function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><span aria-hidden="true">{icon}</span>{label}</button>; }

function FoodCard({ food, selectedAmount, common, pendingHide, onSelect, onCommon }: { food: FoodDefinition; selectedAmount?: number; common: boolean; pendingHide: boolean; onSelect: (foodId: string, amount: number) => void; onCommon: (foodId: string) => void }) {
  // Feature: One shared card keeps portions and Common behavior identical in every category view.
  return <section className={`card food-card ${common ? "common-food" : ""}`}>
    <div className="food-title"><div className="food-icon"><FoodIcon food={food}/></div><div className="food-copy"><h2>{food.name}</h2><p>{food.detail}</p></div><button className={`common-button ${common ? "active" : ""}`} onClick={() => onCommon(food.id)} aria-label={common ? `Vrati ${food.name} u originalnu kategoriju` : `Premesti ${food.name} u Osnovno`} title={common ? "Vrati u originalnu kategoriju" : "Premesti u Osnovno"}>★</button></div>
    {/* Fix: Shake quantity buttons show only 1/2 because the card title already communicates the unit. */}
    <div className="amount-grid">{food.amounts.map((amount) => <button key={amount} className={`chip amount-chip ${selectedAmount === amount ? "selected" : ""}`} onClick={() => onSelect(food.id, amount)}>{amount}{food.unit === "šejk" ? "" : ` ${food.unit}`}</button>)}</div>
    {pendingHide && <div className="hide-progress" aria-label="Namirnica će se sakriti za sedam sekundi"/>}
  </section>;
}

function CategoryWheel({ onSelect }: { onSelect: (category: FoodView) => void }) {
  // Feature: Polar coordinates distribute every category evenly, so the circular menu adapts automatically when categories change.
  return <div className="category-wheel">
    <button className="category-core" onClick={() => onSelect("common")}><span aria-hidden="true">★</span><strong>Osnovno</strong></button>
    {CATEGORIES.map((category, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / CATEGORIES.length;
      const left = 50 + Math.cos(angle) * 36;
      const top = 50 + Math.sin(angle) * 36;
      return <button key={category.id} className={`category-button ${category.rare ? "rare" : ""}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => onSelect(category.id)}>
        <span aria-hidden="true">{category.icon}</span><strong>{category.name}</strong>
      </button>;
    })}
  </div>;
}

function FoodIcon({ food }: { food: FoodDefinition }) {
  // Fix: Frequent foods use consistent, recognizable vector illustrations instead of ambiguous platform-dependent emoji.
  if (food.id === "pumpkin-seeds") {
    return <svg className="food-svg pumpkin-icon" viewBox="0 0 48 48"><path d="M9 27c0-9 6-16 15-16s15 7 15 16-6 14-15 14S9 36 9 27Z"/><path d="M24 11c0-4 2-6 6-7M17 13c-4 7-4 19 1 26M31 13c4 7 4 19-1 26M24 12v28"/><ellipse cx="24" cy="27" rx="4" ry="8"/></svg>;
  }
  if (food.id === "tuna") return <svg className="food-svg fish-svg tuna-icon" viewBox="0 0 48 48"><path d="M8 25c8-12 23-13 32-3l5-6-1 14-7-4C26 35 15 33 8 25Z"/><path d="m22 16 5-7 5 8M23 33l5 6 4-8"/><circle cx="16" cy="23" r="1.6"/></svg>;
  if (food.id === "sardines") return <svg className="food-svg fish-svg sardine-icon" viewBox="0 0 48 48"><path d="M7 25c7-8 21-9 31-2l6-5-1 12-6-4c-9 7-23 6-30-1Z"/><path d="M17 20c5 2 10 3 17 3M17 28c5-2 10-2 17-2"/><circle cx="13" cy="24" r="1.4"/></svg>;
  if (food.id === "hake") return <svg className="food-svg fish-svg hake-icon" viewBox="0 0 48 48"><path d="M6 25c9-9 24-12 34-4l5-7-1 16-7-5C27 34 15 34 6 25Z"/><path d="M19 18c6-5 11-7 16-6M20 32c7 3 12 3 16 1"/><circle cx="13" cy="24" r="1.5"/></svg>;
  if (food.id === "spinach") {
    return <svg className="food-svg spinach-icon" viewBox="0 0 48 48"><path d="M24 39C8 34 7 18 13 8c11 0 25 6 25 18 0 8-6 13-14 13Z"/><path d="M16 31c7-5 12-10 17-17M21 26l-1-9M26 22l8 1M17 35l-4 7"/></svg>;
  }
  return <>{food.icon}</>;
}

function WeightChart({ records }: { records: DayRecord[] }) {
  const points = [...records].reverse().filter((record) => record.weight !== null);
  if (points.length < 2) return <div className="empty-chart">Potrebna su najmanje dva merenja za grafikon.</div>;
  const weights = points.map((record) => record.weight as number), min = Math.min(...weights) - .3, max = Math.max(...weights) + .3, range = max - min || 1;
  const coords = points.map((record, index) => ({ x: 28 + (index * 344) / Math.max(points.length - 1, 1), y: 155 - (((record.weight as number) - min) / range) * 115, record }));
  // Feature: A dependency-free SVG chart keeps the Android bundle small while exposing exact measured values.
  return <svg className="weight-chart" viewBox="0 0 400 190" role="img" aria-label="Kretanje težine"><line x1="28" y1="40" x2="372" y2="40"/><line x1="28" y1="98" x2="372" y2="98"/><line x1="28" y1="155" x2="372" y2="155"/><polyline points={coords.map((point) => `${point.x},${point.y}`).join(" ")}/>{coords.map((point) => <g key={point.record.date}><circle cx={point.x} cy={point.y} r="4"/><text x={point.x} y={point.y - 11}>{point.record.weight?.toFixed(1)}</text><text className="date-label" x={point.x} y="180">{formatDate(point.record.date)}</text></g>)}</svg>;
}

export default App;
