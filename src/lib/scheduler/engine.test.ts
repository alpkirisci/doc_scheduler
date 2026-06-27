import { describe, expect, it } from "vitest";
import { solve } from "./engine";
import { buildDemoInput } from "./demo";

describe("engine — friend's real case (9 people, 4 rooms, 21 days)", () => {
  const res = solve(buildDemoInput());

  it("is feasible with zero hard violations", () => {
    expect(res.report.feasible).toBe(true);
    expect(res.report.hardViolations).toBe(0);
  });

  it("fills every slot (9 per duty day x 21 days)", () => {
    expect(res.assignments.length).toBe(9 * 21);
  });

  it("respects never-alone (Elif never alone with Ahmet Berk)", () => {
    expect(res.report.neverAloneViolations).toBe(0);
  });

  it("balances time per room (small spread)", () => {
    expect(res.report.spreads.roomMax).toBeLessThanOrEqual(2);
  });

  it("shares the difficult colleague evenly (the Ahmet Berk fix)", () => {
    expect(res.report.spreads.exposure).toBeLessThanOrEqual(2);
  });

  it("gives a high fairness score", () => {
    expect(res.report.fairnessScore).toBeGreaterThanOrEqual(85);
  });

  it("is deterministic for a fixed seed", () => {
    const a = solve({ ...buildDemoInput(), seed: 123, restarts: 2 });
    const b = solve({ ...buildDemoInput(), seed: 123, restarts: 2 });
    expect(a.report.penalty).toBe(b.report.penalty);
    expect(a.assignments).toEqual(b.assignments);
  });
});

describe("engine — infeasibility is detected & explained", () => {
  it("flags an impossible day when someone is off in the no-slack 9=9 case", () => {
    const input = buildDemoInput();
    input.unavailability = [{ personId: input.people[0].id, date: input.dutyDates[0] }];
    const res = solve(input);
    expect(res.report.infeasibilities.length).toBeGreaterThan(0);
    expect(res.report.feasible).toBe(false);
  });
});

describe("engine — rotation with a bench respects availability", () => {
  const dates = Array.from({ length: 10 }, (_, i) => {
    const d = new Date("2026-09-01T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const res = solve({
    people: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    rooms: [
      { id: "r1", name: "A", capacity: 1 },
      { id: "r2", name: "B", capacity: 2 },
      { id: "r3", name: "C", capacity: 3 },
      { id: "r4", name: "D", capacity: 3 },
    ],
    shifts: [{ id: "s", name: "Day", startMin: 480, durationMin: 720 }],
    dutyDates: dates,
    unavailability: [{ personId: "p0", date: dates[2] }],
    restHoursMin: 12,
    maxDutiesPerDay: 1,
    seed: 5,
  });

  it("is feasible and fills all slots", () => {
    expect(res.report.feasible).toBe(true);
    expect(res.assignments.length).toBe(9 * dates.length);
  });

  it("never schedules an unavailable person", () => {
    const breach = res.assignments.some((a) => a.personId === "p0" && a.date === dates[2]);
    expect(breach).toBe(false);
  });

  it("keeps total load roughly balanced", () => {
    expect(res.report.spreads.load).toBeLessThanOrEqual(3);
  });
});
