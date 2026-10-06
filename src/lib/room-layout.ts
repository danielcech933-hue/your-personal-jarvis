import type { CompanionZone } from "@/lib/companion-life";

export type RoomEnvironment = "cyber" | "park" | "apartment" | "rooftop";
export type FurnitureId = "desk" | "sofa" | "decor" | "lamp";
export type FurnitureItem = { x: number; z: number; rot: number; color: string; variant: string };
export type RoomLayout = { env: RoomEnvironment; items: Record<FurnitureId, FurnitureItem> };

export const ENVIRONMENTS: Record<RoomEnvironment, { label: string; floor: number; wall: number | null; sky: number; fog: number; light: number; windowZone: { x: number; z: number } }> = {
  cyber: { label: "Kyber pokoj", floor: 0x0a1420, wall: 0x0b1726, sky: 0x050b14, fog: 0x07111d, light: 1.6, windowZone: { x: 0.7, z: -1.05 } },
  park: { label: "Park", floor: 0x2f5a2c, wall: null, sky: 0x8fc4ea, fog: 0xa9d2ee, light: 2.4, windowZone: { x: 0.4, z: -1.2 } },
  apartment: { label: "Apartmán", floor: 0x5a3d28, wall: 0xcbb69a, sky: 0x1b130d, fog: 0x2a1d14, light: 1.9, windowZone: { x: 0.7, z: -1.05 } },
  rooftop: { label: "Rooftop", floor: 0x2b2f38, wall: null, sky: 0x111a33, fog: 0x1a2440, light: 1.5, windowZone: { x: 0.6, z: -1.25 } },
};

export const VARIANTS: Record<FurnitureId, { value: string; label: string }[]> = {
  desk: [{ value: "modern", label: "Moderní" }, { value: "wood", label: "Dřevěný" }, { value: "glass", label: "Skleněný" }],
  sofa: [{ value: "sofa", label: "Gauč" }, { value: "bench", label: "Lavička" }, { value: "lounger", label: "Lehátko" }],
  decor: [{ value: "plant", label: "Rostlina" }, { value: "tree", label: "Strom" }, { value: "robot", label: "Robot" }, { value: "speaker", label: "Gramofon" }],
  lamp: [{ value: "floor", label: "Stojací" }, { value: "lantern", label: "Lucerna" }, { value: "neon", label: "Neon" }],
};

export const FURNITURE_LABELS: Record<FurnitureId, string> = { desk: "Stůl", sofa: "Sezení", decor: "Dekorace", lamp: "Světlo" };
export const COLOR_SWATCHES = ["#122238", "#6b4a2f", "#d9dee6", "#7a1f35", "#2f6b5a", "#4b3b7a"];

const PRESETS: Record<RoomEnvironment, Record<FurnitureId, FurnitureItem>> = {
  cyber: { desk: { x: -1.9, z: -0.95, rot: 0, color: "#122238", variant: "modern" }, sofa: { x: 1.5, z: 0.55, rot: 0, color: "#1a2c44", variant: "sofa" }, decor: { x: 2.9, z: -0.9, rot: 0, color: "#1f5a45", variant: "plant" }, lamp: { x: -0.6, z: -1.2, rot: 0, color: "#46e9ff", variant: "neon" } },
  park: { desk: { x: -1.9, z: -0.9, rot: 0, color: "#6b4a2f", variant: "wood" }, sofa: { x: 1.5, z: 0.5, rot: 0, color: "#6b4a2f", variant: "bench" }, decor: { x: 2.8, z: -1.0, rot: 0, color: "#2f6b2f", variant: "tree" }, lamp: { x: -0.4, z: -1.1, rot: 0, color: "#ffd27a", variant: "lantern" } },
  apartment: { desk: { x: -1.9, z: -0.95, rot: 0, color: "#6b4a2f", variant: "wood" }, sofa: { x: 1.5, z: 0.55, rot: 0, color: "#7a1f35", variant: "sofa" }, decor: { x: 2.9, z: -0.9, rot: 0, color: "#2f6b5a", variant: "plant" }, lamp: { x: -0.5, z: -1.15, rot: 0, color: "#ffcf8a", variant: "floor" } },
  rooftop: { desk: { x: -1.9, z: -0.9, rot: 0, color: "#d9dee6", variant: "glass" }, sofa: { x: 1.5, z: 0.5, rot: 0, color: "#4b3b7a", variant: "lounger" }, decor: { x: 2.8, z: -0.9, rot: 0, color: "#2f6b5a", variant: "speaker" }, lamp: { x: -0.5, z: -1.15, rot: 0, color: "#b28cff", variant: "neon" } },
};

export function presetLayout(env: RoomEnvironment): RoomLayout { return { env, items: JSON.parse(JSON.stringify(PRESETS[env])) }; }
export const DEFAULT_LAYOUT: RoomLayout = presetLayout("cyber");
const KEY = "jarvis.room.v1";
export const ROOM_EVENT = "jarvis-room-updated";

export function loadRoomLayout(): RoomLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try { const raw = localStorage.getItem(KEY); if (!raw) return DEFAULT_LAYOUT; const parsed = JSON.parse(raw) as RoomLayout; if (!parsed?.env || !ENVIRONMENTS[parsed.env]) return DEFAULT_LAYOUT; return { env: parsed.env, items: { ...PRESETS[parsed.env], ...parsed.items } }; } catch { return DEFAULT_LAYOUT; }
}
export function saveRoomLayout(layout: RoomLayout, change?: string) {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch {}
  window.dispatchEvent(new CustomEvent(ROOM_EVENT, { detail: { change } }));
}

export const ROOM_BOUNDS = { minX: -3.2, maxX: 3.2, minZ: -1.3, maxZ: 1.2 };
export const clampRoom = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Companion anchor points follow the furniture so she sits where the user moved it. */
export function zoneFromLayout(layout: RoomLayout, zone: CompanionZone): { x: number; z: number } {
  const { desk, sofa, decor } = layout.items;
  if (zone === "desk") return { x: desk.x, z: desk.z + 0.6 };
  if (zone === "sofa") return { x: sofa.x, z: sofa.z + 0.02 };
  if (zone === "window") return ENVIRONMENTS[layout.env].windowZone;
  if (zone === "floor") return { x: clampRoom(decor.x - 0.8, -2.8, 2.8), z: clampRoom(decor.z + 1, -0.8, 1) };
  return { x: 0.2, z: 0.45 };
}
