import { useState, type FormEvent } from "react";
import { api, type AuthUser } from "../api";
import "./AuthScreen.css";
type Props = {
    onLogin: (user: AuthUser) => void;
};
export function AuthScreen({ onLogin }: Props) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    async function submit(event: FormEvent) {
        event.preventDefault();
        setError("");
        setLoading(true);
        if (mode === "register" && password !== confirmPassword) {
            setError("Lozinke se ne podudaraju.");
            setLoading(false);
            return;
        }
        try {
            onLogin(mode === "login" ? await api.login(email, password) : await api.register(email, password));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : mode === "login" ? "Prijava nije uspela." : "Nalog nije napravljen.");
        }
        finally {
            setLoading(false);
        }
    }
    return <main className="auth-shell"><section className="auth-card card">
    <div className="auth-mark">W</div><span className="eyebrow">WEIGHT CUT TRACKER</span><h1>{mode === "login" ? "Dobrodošao nazad" : "Napravi nalog"}</h1><p>{mode === "login" ? "Prijavi se da bi tvoji podaci bili dostupni na telefonu i desktopu." : "Izaberi email i lozinku za sinhronizaciju svojih podataka."}</p>
    <form onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></label><label>Lozinka<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required/></label>{mode === "register" && <label>Potvrdi lozinku<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/></label>}{error && <div className="auth-error" role="alert">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Molim sačekaj…" : mode === "login" ? "Prijavi se" : "Napravi nalog"}</button></form>
    <button className="auth-mode-button" onClick={() => { setMode((current) => current === "login" ? "register" : "login"); setError(""); setConfirmPassword(""); }}>{mode === "login" ? "Nemaš nalog? Registruj se" : "Već imaš nalog? Prijavi se"}</button>
    <small>Prijava ostaje aktivna do 30 dana.</small>
  </section></main>;
}
export function AuthLoading() { return <main className="auth-shell"><div className="auth-mark auth-loading">W</div></main>; }
