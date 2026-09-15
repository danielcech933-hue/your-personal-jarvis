const SUPABASE_URL = "https://ntzjirsejfvgvuhmbqvt.supabase.co";
const SUPABASE_KEY = "sb_publishable_h6OPGkq8kd5c1wvqLlQ02g_VdQ9Vjw1";
const AUTH_KEY = "jarvis.auth.v1";

export type AuthSession = { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } };

function headers(token?: string) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token || SUPABASE_KEY}`, "Content-Type": "application/json" };
}

export function saveSession(session: AuthSession) { localStorage.setItem(AUTH_KEY, JSON.stringify(session)); }
export function loadSession(): AuthSession | null { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null") as AuthSession | null; } catch { return null; } }
export function clearSession() { localStorage.removeItem(AUTH_KEY); }

export async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || "Přihlášení se nepodařilo.");
  const session = { ...data, expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600) } as AuthSession;
  saveSession(session); return session;
}

export async function signUp(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || "Registrace se nepodařila.");
  if (data.access_token) saveSession({ ...data, expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600) } as AuthSession);
  return data as AuthSession & { confirmation_sent_at?: string };
}

export async function signOut() {
  const session = loadSession();
  if (session?.access_token) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: headers(session.access_token) }).catch(() => undefined);
  clearSession();
}

export async function refreshSession(): Promise<AuthSession | null> {
  const session = loadSession();
  if (!session?.refresh_token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: headers(), body: JSON.stringify({ refresh_token: session.refresh_token }) });
  if (!res.ok) { clearSession(); return null; }
  const data = await res.json();
  const next = { ...data, expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600) } as AuthSession;
  saveSession(next); return next;
}

export async function ensureSession() {
  let session = loadSession();
  if (!session) return null;
  if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 60) session = await refreshSession();
  return session;
}

export async function loadPrivateProfile(session: AuthSession) {
  const url = `${SUPABASE_URL}/rest/v1/jarvis_profiles?select=user_id,character_name,appearance,preferences&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`;
  const res = await fetch(url, { headers: headers(session.access_token) });
  if (!res.ok) throw new Error("Soukromý profil se nepodařilo načíst.");
  const rows = await res.json(); return rows[0] || null;
}

export async function savePrivateProfile(session: AuthSession, profile: { characterName: string; userName: string; memories: unknown[]; favoriteTopics: string[]; conversationStyle: string; appearance?: unknown }) {
  const payload = { user_id: session.user.id, character_name: profile.characterName, appearance: profile.appearance || {}, preferences: { userName: profile.userName, favoriteTopics: profile.favoriteTopics, conversationStyle: profile.conversationStyle } };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jarvis_profiles?on_conflict=user_id`, { method: "POST", headers: { ...headers(session.access_token), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Profil se nepodařilo uložit.");
}

export async function loadPrivateMemories(session: AuthSession) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jarvis_memories?select=id,memory,created_at&user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc&limit=100`, { headers: headers(session.access_token) });
  if (!res.ok) throw new Error("Paměť se nepodařilo načíst.");
  return await res.json() as { id: string; memory: string; created_at: string }[];
}

export async function loadPrivateNotes(session: AuthSession) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jarvis_notes?select=id,text,created_at&user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.asc&limit=200`, { headers: headers(session.access_token) });
  if (!res.ok) throw new Error("Poznámky se nepodařilo načíst.");
  return await res.json() as { id: string; text: string; created_at: string }[];
}

export async function replacePrivateNotes(session: AuthSession, notes: { id: string; text: string }[]) {
  const deleted = await fetch(`${SUPABASE_URL}/rest/v1/jarvis_notes?user_id=eq.${encodeURIComponent(session.user.id)}`, { method: "DELETE", headers: headers(session.access_token) });
  if (!deleted.ok) throw new Error("Poznámky se nepodařilo aktualizovat.");
  if (notes.length) {
    const inserted = await fetch(`${SUPABASE_URL}/rest/v1/jarvis_notes`, { method: "POST", headers: { ...headers(session.access_token), Prefer: "return=minimal" }, body: JSON.stringify(notes.map((n) => ({ user_id: session.user.id, text: n.text }))) });
    if (!inserted.ok) throw new Error("Poznámky se nepodařilo uložit.");
  }
}

export { SUPABASE_URL, SUPABASE_KEY };
