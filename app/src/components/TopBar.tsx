import type { SyncStatus, Tab } from "../domain/types";
import "./TopBar.css";
export function TopBar({ tab, syncStatus }: {
    tab: Tab;
    syncStatus: SyncStatus;
}) { return <header className="topbar"><div><span className="eyebrow">WEIGHT CUT TRACKER</span><h1>{tab === "today" ? "Danas" : tab === "food" ? "Hrana" : "Izveštaj"}</h1></div>{syncStatus !== "saved" && <span className={`sync-state ${syncStatus}`}>{syncStatus === "loading" ? "Učitavanje" : syncStatus === "saving" ? "Čuvanje" : "Offline"}</span>}</header>; }
