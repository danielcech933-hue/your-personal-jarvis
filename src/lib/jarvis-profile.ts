export type JarvisMemory = {
  id: string;
  text: string;
  createdAt: number;
};

export type JarvisProfile = {
  characterName: string;
  userName: string;
  memories: JarvisMemory[];
  favoriteTopics: string[];
  conversationStyle: "friendly" | "professional" | "playful" | "concise";
};

const PROFILE_KEY = "jarvis.profile.v1";

export const DEFAULT_PROFILE: JarvisProfile = {
  characterName: "Jarvis",
  userName: "",
  memories: [],
  favoriteTopics: [],
  conversationStyle: "friendly",
};

export function loadJarvisProfile(): JarvisProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<JarvisProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      favoriteTopics: Array.isArray(parsed.favoriteTopics) ? parsed.favoriteTopics : [],
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveJarvisProfile(profile: JarvisProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore storage failures */
  }
}

export function addJarvisMemory(profile: JarvisProfile, text: string): JarvisProfile {
  const value = text.trim();
  if (!value) return profile;
  return {
    ...profile,
    memories: [
      ...profile.memories,
      { id: crypto.randomUUID().slice(0, 10), text: value, createdAt: Date.now() },
    ].slice(-100),
  };
}

export function removeJarvisMemory(profile: JarvisProfile, id: string): JarvisProfile {
  return { ...profile, memories: profile.memories.filter((memory) => memory.id !== id) };
}

export function normalizeWakeWord(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function stripWakeWord(transcript: string, characterName: string) {
  const wake = normalizeWakeWord(characterName);
  const normalized = normalizeWakeWord(transcript);
  if (!wake || !normalized.includes(wake)) return { heard: false, command: transcript.trim() };
  const match = new RegExp(`\\b${wake.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i");
  return { heard: true, command: transcript.replace(match, "").trim() };
}
