import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { shareFile } from "@choochmeque/tauri-plugin-sharekit-api";
import { api } from "../api";
import { AUTO_HIDE_DELAY_MS, COMMON_FOODS_KEY, DEFAULT_WALKING_STEPS, FOODS, STORAGE_KEY, WORKOUT_COOLDOWN_DAYS, WORKOUTS } from "../domain/constants";
import { calculateNutrition, daysAgoKey, emptyRecord, hasRecordContent, round, todayKey } from "../domain/tracker";
import type { DayRecord, FoodView, OneTimeField, SyncStatus, Tab } from "../domain/types";
// The controller owns synchronization, persistence, timers and derived state; visual components only render and dispatch actions.
export function useTrackerController() {
    const [tab, setTab] = useState<Tab>("today");
    const [records, setRecords] = useState<DayRecord[]>(() => {
        // Feature: Local persistence makes the personal tracker fully usable offline inside Tauri.
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Array<Omit<DayRecord, "workout"> & {
                workout?: string | string[];
                note?: string;
                customTags?: string[];
            }>;
            // Fix: Existing single-workout records are migrated to arrays so multi-select training remains backward compatible.
            return stored.map((record) => {
                // Fix: Obsolete note/tag fields are discarded when loading because deviation tracking was removed completely.
                const { customTags: _customTags, note: _note, ...baseRecord } = record;
                return ({
                    ...baseRecord,
                    workout: Array.isArray(record.workout) ? record.workout : record.workout ? [record.workout] : [],
                    // Fix: Older whey scoop selections represent one complete shake and are migrated without losing saved days.
                    foods: record.foods.map((food) => food.foodId === "whey" ? { foodId: "anabolic-shake", amount: 1 } : food),
                });
            })
                // Fix: Legacy empty days are removed so they cannot lower calorie averages or create blank CSV rows.
                .filter(hasRecordContent);
        }
        catch {
            return [];
        }
    });
    const [draft, setDraft] = useState<DayRecord>(() => records.find((item) => item.date === todayKey()) ?? emptyRecord(todayKey()));
    const [weightInput, setWeightInput] = useState(draft.weight?.toString() ?? "");
    const [notice, setNotice] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<FoodView | null>(null);
    const [hiddenFoods, setHiddenFoods] = useState<string[]>(() => draft.foods.filter((food) => food.foodId !== "anabolic-shake").map((food) => food.foodId));
    const [pendingHideFoods, setPendingHideFoods] = useState<string[]>([]);
    const [showTodayFoods, setShowTodayFoods] = useState(false);
    const [pendingHideWorkouts, setPendingHideWorkouts] = useState<string[]>([]);
    const [showExportActions, setShowExportActions] = useState(false);
    const [showReportPreview, setShowReportPreview] = useState(false);
    const [collapsedOneTimeFields, setCollapsedOneTimeFields] = useState<Record<OneTimeField, boolean>>({ weight: draft.weight !== null, sleep: Boolean(draft.sleep) });
    const [oneTimeCountdowns, setOneTimeCountdowns] = useState<Record<OneTimeField, number>>({ weight: 0, sleep: 0 });
    const [serverReady, setServerReady] = useState(false);
    const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "saved" | "offline">("loading");
    const [commonFoods, setCommonFoods] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem(COMMON_FOODS_KEY) ?? "[]") as string[];
        }
        catch {
            return [];
        }
    });
    const autosaveReady = useRef(false);
    const hideTimers = useRef<Record<string, number>>({});
    const oneTimeTimers = useRef<Partial<Record<OneTimeField, number>>>({});
    const workoutHideTimers = useRef<Record<string, number>>({});
    useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }, [records]);
    useEffect(() => { localStorage.setItem(COMMON_FOODS_KEY, JSON.stringify(commonFoods)); }, [commonFoods]);
    useEffect(() => {
        if (!serverReady)
            return;
        // Feature: Every meaningful draft change is committed locally and remotely without a redundant save button.
        if (!autosaveReady.current) {
            autosaveReady.current = true;
            return;
        }
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
            setRecords(loaded);
            const today = loaded.find((record) => record.date === todayKey()) ?? emptyRecord(todayKey());
            setDraft(today);
            setWeightInput(today.weight?.toString() ?? "");
            // Fix: Server-loaded foods must start hidden in category lists just like locally restored foods, except the always-visible shake.
            setHiddenFoods(today.foods.filter((food) => food.foodId !== "anabolic-shake").map((food) => food.foodId));
            // Feature: Already completed morning fields load in their compact state instead of occupying the whole Today screen again.
            setCollapsedOneTimeFields({ weight: today.weight !== null, sleep: Boolean(today.sleep) });
            setOneTimeCountdowns({ weight: 0, sleep: 0 });
            setServerReady(true);
            setSyncStatus("saved");
        }).catch(() => { setServerReady(true); setSyncStatus("offline"); });
    }, []);
    useEffect(() => () => {
        // Fix: Pending hide timers are cleared on unmount so they cannot update a closed Tauri view.
        Object.values(hideTimers.current).forEach((timerId) => window.clearTimeout(timerId));
        Object.values(oneTimeTimers.current).forEach((timerId) => window.clearTimeout(timerId));
        // Fix: Workout grace-period timers are also cleared when the Tauri view closes.
        Object.values(workoutHideTimers.current).forEach((timerId) => window.clearTimeout(timerId));
    }, []);
    useEffect(() => {
        if (!showExportActions)
            return;
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
                if (current.date === currentDate)
                    return current;
                // Fix: On a Belgrade date change, daily inputs reset while persistent Common preferences remain untouched.
                let storedRecords: DayRecord[] = [];
                try {
                    storedRecords = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as DayRecord[];
                }
                catch { /* A corrupt cache safely falls back to an empty day. */ }
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
                // Fix: A new day clears temporary workout visibility; persisted history alone decides the next cooldown state.
                Object.values(workoutHideTimers.current).forEach((timerId) => window.clearTimeout(timerId));
                workoutHideTimers.current = {};
                setPendingHideWorkouts([]);
                setHiddenFoods(next.foods.filter((food) => food.foodId !== "anabolic-shake").map((food) => food.foodId));
                setShowTodayFoods(false);
                return next;
            });
        }
        // Feature: A short foreground check plus focus/visibility events also catches midnight while Android suspended the app.
        const intervalId = window.setInterval(rollOverToSerbiaDay, 15000);
        const handleVisibility = () => { if (document.visibilityState === "visible")
            rollOverToSerbiaDay(); };
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
    // Feature: "Šta sam danas jeo" is global, so every open category can reveal all foods recorded for the current day.
    const todayFoods = useMemo(() => draft.foods
        .map((selection) => FOODS.find((food) => food.id === selection.foodId))
        .filter((food): food is NonNullable<typeof food> => Boolean(food)), [draft.foods]);
    const availableWorkouts = useMemo(() => {
        const cutoff = daysAgoKey(draft.date, WORKOUT_COOLDOWN_DAYS - 1);
        // Fix: The live draft replaces today's possibly stale saved record so a just-edited workout cannot be counted twice.
        const recentRecords = [...records.filter((record) => record.date !== draft.date), draft]
            .filter((record) => record.date >= cutoff && record.date <= draft.date);
        const blocked = new Set(recentRecords.flatMap((record) => record.workout));
        return WORKOUTS.filter((workout) => {
            // Feature: A newly checked activity remains visible only during its seven-second correction window.
            if (pendingHideWorkouts.includes(workout))
                return true;
            if (workout === "Šetnja")
                return !draft.workout.includes(workout);
            return !blocked.has(workout);
        });
    }, [draft, pendingHideWorkouts, records]);
    function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2200); }
    function scheduleOneTimeHide(field: OneTimeField) {
        if (oneTimeTimers.current[field])
            window.clearTimeout(oneTimeTimers.current[field]);
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
        if (oneTimeTimers.current[field])
            window.clearTimeout(oneTimeTimers.current[field]);
        delete oneTimeTimers.current[field];
        setOneTimeCountdowns((current) => ({ ...current, [field]: 0 }));
        setCollapsedOneTimeFields((current) => ({ ...current, [field]: false }));
    }
    function updateWeight(value: string) {
        setWeightInput(value);
        // Feature: Clearing the field also clears the saved weight instead of silently retaining the previous value.
        if (!value.trim()) {
            setDraft((current) => ({ ...current, weight: null }));
            revealOneTimeField("weight");
            return;
        }
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
        if (foodId === "anabolic-shake")
            return;
        if (hideTimers.current[foodId])
            window.clearTimeout(hideTimers.current[foodId]);
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
        const selected = draft.workout.includes(workout);
        if (workoutHideTimers.current[workout])
            window.clearTimeout(workoutHideTimers.current[workout]);
        delete workoutHideTimers.current[workout];
        setPendingHideWorkouts((current) => current.filter((item) => item !== workout));
        if (selected) {
            // Fix: Tapping again during the grace period cancels the workout and immediately restores it to the available choices.
            setDraft((current) => ({ ...current, workout: current.workout.filter((item) => item !== workout) }));
            return;
        }
        // Feature: Training selections autosave immediately but remain visible for seven seconds so accidental taps can be undone.
        setDraft((current) => ({ ...current, workout: [...current.workout, workout] }));
        setPendingHideWorkouts((current) => [...current.filter((item) => item !== workout), workout]);
        workoutHideTimers.current[workout] = window.setTimeout(() => {
            setPendingHideWorkouts((current) => current.filter((item) => item !== workout));
            delete workoutHideTimers.current[workout];
        }, AUTO_HIDE_DELAY_MS);
    }
    function toggleCommonFood(foodId: string) {
        // Feature: The star moves a food between Common and its original category while keeping daily selections untouched.
        setCommonFoods((current) => current.includes(foodId) ? current.filter((id) => id !== foodId) : [...current, foodId]);
    }
    function openFoodCategory(category: FoodView) {
        // Feature: A lightweight browser-history entry lets Android WebView translate its native Back action into in-app navigation.
        window.history.pushState({ ...window.history.state, weightTrackerLayer: "food-category" }, "");
        setShowTodayFoods(false);
        setSelectedCategory(category);
    }
    function closeFoodCategory() {
        // Fix: The visible back control consumes the same temporary history entry as Android Back, keeping both paths synchronized.
        if (window.history.state?.weightTrackerLayer === "food-category")
            window.history.back();
        else
            setSelectedCategory(null);
    }
    function buildReportFile() {
        // Feature: CSV is compact, human-readable, and directly analyzable when shared in chat.
        const header = ["datum", "tezina_kg", "san", "trening", "koraci", "namirnice_i_doprinos", "kcal_ukupno", "protein_g", "masti_g", "uh_ukupno_g", "vlakna_g", "neto_uh_g"];
        const rows = sortedRecords.map((record) => {
            const totals = calculateNutrition(record);
            // Feature: Every food carries its own calorie, carbohydrate, and fiber contribution inside the exported day.
            const foods = record.foods.map((selection) => {
                const food = FOODS.find((item) => item.id === selection.foodId);
                if (!food)
                    return selection.foodId;
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
        }
        catch {
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
        }
        catch {
            // Fix: Browser preview retains a normal download fallback while the packaged app uses the reliable native path above.
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([built.csv], { type: "text/csv;charset=utf-8" }));
            link.download = built.fileName;
            link.click();
            URL.revokeObjectURL(link.href);
            flash(`Preuzeto kao: ${built.fileName}`);
        }
    }
    return {
        tab, setTab, records, draft, weightInput, notice, selectedCategory, pendingHideFoods, pendingHideWorkouts,
        showTodayFoods, setShowTodayFoods, showExportActions, setShowExportActions,
        showReportPreview, setShowReportPreview, collapsedOneTimeFields, oneTimeCountdowns, syncStatus: syncStatus as SyncStatus,
        commonFoods, nutrition, sortedRecords, reportRecords, averageWeight, weightChange, averageCalories, categoryFoods, todayFoods, availableWorkouts,
        revealOneTimeField, updateWeight, updateSleep, selectFood, toggleWorkout, toggleCommonFood, openFoodCategory, closeFoodCategory, shareReport, saveReport
    };
}
export type TrackerController = ReturnType<typeof useTrackerController>;
