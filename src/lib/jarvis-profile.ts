export type JarvisMemory = { id: string; text: string; createdAt: number };
export type JarvisAppearance = { style: "glamorous" | "cyber" | "casual"; hair: "silver" | "black" | "violet" | "rose"; outfit: "midnight" | "white" | "crimson"; accent: "cyan" | "violet" | "rose"; height: number; body: "slim" | "athletic" | "curvy" };
export type JarvisProfile = { characterName: string; userName: string; memories: JarvisMemory[]; favoriteTopics: string[]; conversationStyle: "friendly" | "professional" | "playful" | "concise"; appearance: JarvisAppearance };

const AUTH_KEY = "jarvis.auth.v1";
const DEFAULT_APPEARANCE: JarvisAppearance = { style: "glamorous", hair: "silver", outfit: "midnight", accent: "cyan", height: 1, body: "athletic" };
export const DEFAULT_PROFILE: JarvisProfile = { characterName: "Jarvis", userName: "", memories: [], favoriteTopics: [], conversationStyle: "friendly", appearance: DEFAULT_APPEARANCE };

function storageKey() {
  if (typeof window === "undefined") return "jarvis.profile.anonymous";
  try { const session = JSON.parse(localStorage.getItem(AUTH_KEY) || "null") as { user?: { id?: string } } | null; return session?.user?.id ? `jarvis.profile.${session.user.id}` : "jarvis.profile.anonymous"; } catch { return "jarvis.profile.anonymous"; }
}

export function loadJarvisProfile(): JarvisProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || "null") as Partial<JarvisProfile> | null;
    if (!parsed) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...parsed, memories: Array.isArray(parsed.memories) ? parsed.memories : [], favoriteTopics: Array.isArray(parsed.favoriteTopics) ? parsed.favoriteTopics : [], appearance: { ...DEFAULT_APPEARANCE, ...(parsed.appearance || {}) } };
  } catch { return DEFAULT_PROFILE; }
}

export function saveJarvisProfile(profile: JarvisProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("jarvis-profile-updated"));
    const session = JSON.parse(localStorage.getItem(AUTH_KEY) || "null") as { access_token?: string; user?: { id?: string } } | null;
    if (session?.access_token && session.user?.id) {
      const headers = { apikey: "sb_publishable_h6OPGkq8kd5c1wvqLlQ02g_VdQ9Vjw1", Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
      void fetch("https://ntzjirsejfvgvuhmbqvt.supabase.co/rest/v1/jarvis_profiles?on_conflict=user_id", { method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: session.user.id, character_name: profile.characterName, appearance: profile.appearance, preferences: { userName: profile.userName, favoriteTopics: profile.favoriteTopics, conversationStyle: profile.conversationStyle } }) }).catch(() => undefined);
      void fetch(`https://ntzjirsejfvgvuhmbqvt.supabase.co/rest/v1/jarvis_memories?user_id=eq.${encodeURIComponent(session.user.id)}`, { method: "DELETE", headers }).then(() => profile.memories.length ? fetch("https://ntzjirsejfvgvuhmbqvt.supabase.co/rest/v1/jarvis_memories", { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(profile.memories.slice(-100).map((m) => ({ user_id: session.user!.id, memory: m.text }))) }) : undefined).catch(() => undefined);
    }
  } catch { /* local storage/auth can be unavailable */ }
}

export function addJarvisMemory(profile: JarvisProfile, text: string): JarvisProfile { const value = text.trim(); if (!value) return profile; return { ...profile, memories: [...profile.memories, { id: crypto.randomUUID().slice(0, 10), text: value, createdAt: Date.now() }].slice(-100) }; }
export function removeJarvisMemory(profile: JarvisProfile, id: string): JarvisProfile { return { ...profile, memories: profile.memories.filter((memory) => memory.id !== id) }; }
export function normalizeWakeWord(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
export function stripWakeWord(transcript: string, characterName: string) { const wake = normalizeWakeWord(characterName); const normalized = normalizeWakeWord(transcript); if (!wake || !normalized.includes(wake)) return { heard: false, command: transcript.trim() }; const escaped = wake.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const match = new RegExp(`\\b${escaped}\\b`, "i"); return { heard: true, command: transcript.replace(match, "").trim() }; }
