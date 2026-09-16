export type CompanionZone = "center" | "desk" | "sofa" | "window" | "floor";
export type CompanionAction = "idle" | "walk" | "sit" | "work" | "sleep" | "stretch" | "dance" | "spin" | "jump" | "flip" | "wave" | "think";

export type CompanionMood = "normal" | "bored" | "play" | "sleep" | "curious";

export type LifeDecision = {
  zone: CompanionZone;
  action: CompanionAction;
  durationMs: number;
  reason: string;
};

const zones: Record<CompanionZone, { x: number; z: number }> = {
  center: { x: 0.2, z: 0.45 },
  desk: { x: -1.9, z: -0.35 },
  sofa: { x: 1.5, z: 0.57 },
  window: { x: 0.7, z: -1.05 },
  floor: { x: 2.1, z: 0.1 },
};

const allowed: Record<CompanionZone, CompanionAction[]> = {
  center: ["idle", "walk", "wave", "think", "stretch", "dance", "spin", "jump"],
  desk: ["work", "think", "sit", "idle"],
  sofa: ["sit", "sleep", "stretch", "think", "idle"],
  window: ["think", "wave", "stretch", "idle"],
  floor: ["dance", "spin", "jump", "flip", "stretch", "wave", "walk", "idle"],
};

/** Keeps an action physically plausible for the zone it happens in. */
export function fitAction(zone: CompanionZone, action: CompanionAction): CompanionAction {
  const list = allowed[zone];
  return list.includes(action) ? action : (list[0] as CompanionAction);
}

export function getCompanionZonePosition(zone: CompanionZone) {
  return zones[zone];
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function routine(
  zone: CompanionZone,
  action: CompanionAction,
  minMs: number,
  maxMs: number,
  reason: string,
  random: () => number,
): LifeDecision {
  return {
    zone,
    action: fitAction(zone, action),
    durationMs: minMs + random() * Math.max(0, maxMs - minMs),
    reason,
  };
}

export function decideCompanionLife(
  now: Date,
  mood: CompanionMood,
  random: () => number = Math.random,
): LifeDecision {
  const hour = now.getHours();
  const day = now.getDay();
  const weekend = day === 0 || day === 6;

  if (mood === "sleep" || hour >= 23 || hour < 7) {
    return routine("sofa", "sleep", 10000, 17000, "noční odpočinek", random);
  }

  if (mood === "play") {
    const zone = random() < 0.55 ? "floor" : "center";
    const action = pick(["dance", "jump", "spin", "wave", "stretch", "flip"] as CompanionAction[], random);
    return routine(zone, action, 1800, 5200, "chce se zabavit", random);
  }

  if (mood === "bored") {
    const zone = pick(["desk", "sofa", "window", "floor"] as CompanionZone[], random);
    if (zone === "desk") return routine(zone, random() < 0.72 ? "work" : "think", 5000, 11000, "začíná se nudit a něco si hledá", random);
    if (zone === "sofa") return routine(zone, random() < 0.8 ? "sit" : "stretch", 3000, 7000, "potřebuje pauzu", random);
    if (zone === "window") return routine(zone, random() < 0.75 ? "think" : "wave", 3000, 6500, "kouká ven", random);
    return routine(zone, "walk", 2500, 5500, "potřebuje změnu", random);
  }

  if (mood === "curious") {
    const zone = pick(["window", "center", "desk"] as CompanionZone[], random);
    const action = zone === "window"
      ? pick(["think", "wave", "stretch"] as CompanionAction[], random)
      : zone === "desk"
        ? pick(["think", "walk", "work"] as CompanionAction[], random)
        : pick(["walk", "think", "wave"] as CompanionAction[], random);
    return routine(zone, action, 2200, 6200, "něco ji zaujalo", random);
  }

  if (hour >= 7 && hour <= 8) {
    return weekend
      ? routine("sofa", random() < 0.5 ? "stretch" : "sit", 3500, 7000, "víkendové ráno", random)
      : routine("desk", "work", 6000, 10000, "začíná den", random);
  }

  if (hour >= 9 && hour <= 11) {
    return routine("desk", random() < 0.78 ? "work" : "think", 7000, 13000, "ranní pracovní režim", random);
  }

  if (hour >= 12 && hour <= 14) {
    if (random() < 0.4) return routine("sofa", random() < 0.75 ? "sit" : "sleep", 3500, 7500, "polední pauza", random);
    if (random() < 0.5) return routine("window", "think", 3500, 7000, "krátká pauza od práce", random);
    return routine("desk", "work", 5000, 9000, "pokračuje v práci", random);
  }

  if (hour >= 15 && hour <= 17) {
    const zone = random() < 0.58 ? "desk" : random() < 0.55 ? "window" : "floor";
    const action = zone === "desk" ? "work" : zone === "window" ? "think" : "walk";
    return routine(zone, action, 4500, 9500, "odpolední režim", random);
  }

  if (hour >= 18 && hour <= 22) {
    const zone = pick(["sofa", "window", "center", "floor"] as CompanionZone[], random);
    if (zone === "sofa") return routine(zone, random() < 0.82 ? "sit" : "stretch", 3500, 8000, "večerní odpočinek", random);
    if (zone === "window") return routine(zone, random() < 0.7 ? "think" : "wave", 3000, 6500, "večer u okna", random);
    if (zone === "floor") return routine(zone, random() < 0.65 ? "stretch" : "dance", 2500, 5500, "večerní volno", random);
    return routine(zone, pick(["walk", "idle", "wave", "stretch"] as CompanionAction[], random), 2200, 5200, "má trochu volného času", random);
  }

  return routine("center", "idle", 2500, 5000, "klidný moment", random);
}
