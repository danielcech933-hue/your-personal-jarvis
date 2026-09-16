import { describe, expect, test } from "bun:test";
import { decideCompanionLife, getCompanionZonePosition } from "./companion-life";

describe("companion life scheduler", () => {
  test("sleeps at night", () => {
    const decision = decideCompanionLife(new Date(2026, 8, 16, 1, 30), "normal", () => 0.5);
    expect(decision.zone).toBe("sofa");
    expect(decision.action).toBe("sleep");
  });

  test("uses the desk during a weekday morning", () => {
    const decision = decideCompanionLife(new Date(2026, 8, 16, 9, 15), "normal", () => 0.5);
    expect(decision.zone).toBe("desk");
    expect(["work", "think"]).toContain(decision.action);
  });

  test("uses a relaxed start on weekend mornings", () => {
    const decision = decideCompanionLife(new Date(2026, 8, 20, 8, 0), "normal", () => 0.25);
    expect(decision.zone).toBe("sofa");
    expect(["sit", "stretch"]).toContain(decision.action);
  });

  test("play mood stays in a play-safe zone", () => {
    const decision = decideCompanionLife(new Date(2026, 8, 16, 16, 0), "play", () => 0.1);
    expect(["floor", "center"]).toContain(decision.zone);
    expect(["dance", "jump", "spin", "wave", "stretch", "flip"]).toContain(decision.action);
  });

  test("room zone coordinates are finite", () => {
    for (const zone of ["center", "desk", "sofa", "window", "floor"] as const) {
      const position = getCompanionZonePosition(zone);
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.z)).toBe(true);
    }
  });
});
