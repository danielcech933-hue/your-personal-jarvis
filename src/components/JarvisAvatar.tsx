import type { AvatarMood, AvatarState } from "./JarvisCompanion";
export type { AvatarMood, AvatarState };

// Compatibility wrapper kept for older imports.
export function JarvisAvatar(_props: { state: AvatarState; mood?: AvatarMood; level: number }) {
  return null;
}
