import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./App.css";
import { AuthLoading, AuthScreen } from "./components/AuthScreen";
import { BottomNav } from "./components/BottomNav";
import { FoodScreen } from "./components/FoodScreen";
import { ReportPreview } from "./components/ReportPreview";
import { ReportScreen } from "./components/ReportScreen";
import { Toast } from "./components/Toast";
import { TodayScreen } from "./components/TodayScreen";
import { TopBar } from "./components/TopBar";
import { WorkoutHistory } from "./components/WorkoutHistory";
import { useSession } from "./hooks/useSession";
import { useTrackerController } from "./hooks/useTrackerController";
function TrackerApp() {
    const controller = useTrackerController();
    return <main className="app-shell"><TopBar tab={controller.tab} syncStatus={controller.syncStatus}/><section className="content">{controller.tab === "today" && <TodayScreen controller={controller}/>} {controller.tab === "food" && <FoodScreen controller={controller}/>} {controller.tab === "report" && <ReportScreen controller={controller}/>}</section><BottomNav tab={controller.tab} onChange={controller.setTab}/>{controller.showReportPreview && <ReportPreview records={controller.sortedRecords} onClose={controller.closeReportPreview}/>} {controller.showWorkoutHistory && <WorkoutHistory records={controller.workoutHistoryRecords} monthLabel={controller.workoutHistoryMonthLabel} onClose={controller.closeWorkoutHistory}/>}<Toast message={controller.notice}/></main>;
}
export default function App() {
    const { user, setUser } = useSession();
    if (user === undefined)
        return <AuthLoading />;
    return user ? <TrackerApp /> : <AuthScreen onLogin={setUser}/>;
}
