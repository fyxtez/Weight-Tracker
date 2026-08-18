export type AuthUser = { id: string; email: string; displayName: string | null };
type Tokens = { accessToken: string; refreshToken: string; tokenType: "Bearer"; expiresIn: number };
export type ServerDay<T> = { id: string; localDate: string; payload: T; revision: number; updatedAt: string };

// Feature: Build-time configuration supports localhost desktop development and a LAN/HTTPS URL for Android builds.
const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8585").replace(/\/$/, "");
const REFRESH_TOKEN_KEY = "fyxtez-weight-tracker-refresh-token-v1";

class ApiClient {
  private accessToken: string | null = null;
  // Feature: Persist only the rotating refresh token so restarting the app does not require another login during the 30-day session.
  private refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_KEY);
  private refreshPromise: Promise<void> | null = null;
  private dayMutationQueue: Promise<unknown> = Promise.resolve();

  async login(email: string, password: string): Promise<AuthUser> {
    const tokens = await this.publicRequest<Tokens>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    this.setTokens(tokens);
    return this.request<AuthUser>("/api/v1/auth/me");
  }

  async register(email: string, password: string): Promise<AuthUser> {
    // Feature: Successful registration returns a session immediately, avoiding a redundant second credential submission.
    const tokens = await this.publicRequest<Tokens>("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
    this.setTokens(tokens);
    return this.request<AuthUser>("/api/v1/auth/me");
  }

  async restoreSession(): Promise<AuthUser | null> {
    if (!this.refreshToken) return null;
    try { await this.refresh(); return await this.request<AuthUser>("/api/v1/auth/me"); }
    catch (reason) {
      // Fix: A temporary offline start keeps the month-long session; only an explicit 401 removes an expired/revoked token.
      if (reason instanceof ApiError && reason.status === 401) this.clearTokens();
      return null;
    }
  }

  async logout(): Promise<void> {
    try { if (this.accessToken) await this.request<void>("/api/v1/auth/logout", { method: "POST" }, false); } finally { this.clearTokens(); }
  }

  async listDays<T>(): Promise<Array<ServerDay<T>>> { return this.request<Array<ServerDay<T>>>("/api/v1/days?limit=366"); }
  async putDay<T>(date: string, payload: T): Promise<ServerDay<T>> {
    // Fix: One mutation queue preserves tap order when autosave receives several rapid food or training changes.
    return this.enqueueDayMutation(() => this.request<ServerDay<T>>(`/api/v1/days/${date}`, { method: "PUT", body: JSON.stringify(payload) }));
  }

  async deleteDay(date: string): Promise<void> {
    // Fix: Deleting an already-empty day is an idempotent success and must not falsely mark the app offline.
    await this.enqueueDayMutation(async () => {
      try { await this.request<void>(`/api/v1/days/${date}`, { method: "DELETE" }); }
      catch (reason) { if (!(reason instanceof ApiError) || reason.status !== 404) throw reason; }
    });
  }

  private enqueueDayMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const result = this.dayMutationQueue.then(mutation, mutation);
    this.dayMutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private setTokens(tokens: Tokens) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private async refresh(): Promise<void> {
    if (!this.refreshToken) throw new Error("Sesija je istekla. Prijavi se ponovo.");
    if (!this.refreshPromise) {
      // Feature: Concurrent 401 responses share one rotating-refresh request so an old refresh token is never reused.
      this.refreshPromise = this.publicRequest<Tokens>("/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: this.refreshToken }) })
        .then((tokens) => this.setTokens(tokens)).finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "content-type": "application/json", ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}), ...init.headers } });
    if (response.status === 401 && retry && this.refreshToken) { await this.refresh(); return this.request<T>(path, init, false); }
    return parseResponse<T>(response);
  }

  private async publicRequest<T>(path: string, init: RequestInit): Promise<T> {
    return parseResponse<T>(await fetch(`${API_URL}${path}`, { ...init, headers: { "content-type": "application/json", ...init.headers } }));
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const body = await response.json().catch(() => null) as { message?: string } | null;
  throw new ApiError(response.status, body?.message || `Server je vratio ${response.status}.`);
}

class ApiError extends Error {
  // Feature: Typed HTTP errors let callers handle expected statuses without hiding real connectivity failures.
  constructor(readonly status: number, message: string) { super(message); this.name = "ApiError"; }
}

export const api = new ApiClient();
