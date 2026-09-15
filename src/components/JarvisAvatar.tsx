import type { AvatarState, AvatarMood } from "./JarvisAvatar";
export type { AvatarState, AvatarMood };

// Compatibility wrapper. The full-screen autonomous companion lives in
// JarvisCompanion.tsx; this component remains available for existing imports.
export function JarvisAvatar({ state, mood = "normal", level }: { state: AvatarState; mood?: AvatarMood; level: number }) {
  void state;
  void mood;
  void level;
  return null;
}
