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
  center: { x: 0, z: 0.25 },
  desk: { x: -1.75, z: -0.45 },
  sofa: { x: 0.95, z: 0.35 },
  window: { x: 0.2, z: -0.72 },
  floor: { x: 1.55, z: -0.55 },
};

export function getCompanionZonePosition(zone: CompanionZone) {
  return zones[zone];
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

export function decideCompanionLife(
  now: Date,
  mood: CompanionMood,
  random: () => number = Math.random,
): LifeDecision {
  const hour = now.getHours();

  if (mood === "sleep" || hour >= 23 || hour < 7) {
    return { zone: "sofa", action: "sleep", durationMs: 10000 + random() * 7000, reason: "noční odpočinek" };
  }

  if (mood === "play") {
    const zone = random() < 0.5 ? "floor" : "center";
    const action = pick(["dance", "jump", "spin", "wave", "stretch", "flip"] as CompanionAction[], random);
    return { zone, action, durationMs: 1800 + random() * 2800, reason: "chce se zabavit" };
  }

  if (mood === "bored") {
    const zone = pick(["desk", "sofa", "window", "floor"] as CompanionZone[], random);
    const action = zone === "desk" ? "work" : zone === "sofa" ? "sit" : zone === "window" ? "think" : "walk";
    return { zone, action, durationMs: action === "work" ? 6000 + random() * 5000 : 2500 + random() * 3500, reason: "začíná se nudit" };
  }

  if (mood === "curious") {
    const zone = pick(["window", "center", "desk"] as CompanionZone[], random);
    return { zone, action: pick(["walk", "think", "wave", "stretch"] as CompanionAction[], random), durationMs: 2200 + random() * 2600, reason: "je zvědavá" };
  }

  if (hour >= 8 && hour <= 11) {
    return { zone: "desk", action: "work", durationMs: 7000 + random() * 5000, reason: "ranní pracovní režim" };
  }

  if (hour >= 12 && hour <= 17) {
    const zone = random() < 0.55 ? "desk" : "window";
    return { zone, action: zone === "desk" ? "work" : "think", durationMs: 5000 + random() * 5000, reason: "odpolední režim" };
  }

  const zone = pick(["sofa", "window", "center"] as CompanionZone[], random);
  return { zone, action: zone === "sofa" ? "sit" : zone === "window" ? "think" : pick(["walk", "stretch", "idle", "wave"] as CompanionAction[], random), durationMs: 2500 + random() * 3500, reason: "večerní režim" };
}
