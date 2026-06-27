import { describe, expect, it } from "vitest";
import { solve } from "./engine";
import type { Assignment, Room, ScheduleInput, Shift } from "./types";

// ---- helpers ----------------------------------------------------------------
function dates(start: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
const ROOMS_1233: Room[] = [
  { id: "r1", name: "G1", capacity: 1 },
  { id: "r2", name: "G2", capacity: 2 },
  { id: "r3", name: "Y", capacity: 3 },
  { id: "r4", name: "K", capacity: 3 },
];
const ONE_SHIFT: Shift[] = [{ id: "s", name: "Nöbet", startMin: 480, durationMin: 1440 }];
function people(n: number, extra: Partial<ScheduleInput["people"][number]>[] = []) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, ...extra[i] }));
}
/** count of shift-instances where a and b are in the same room */
function sharedCount(a: string, b: string, assignments: Assignment[]): number {
  const byInst = new Map<string, Map<string, string>>(); // key date|shift -> person->room
  for (const x of assignments) {
    const k = `${x.date}|${x.shiftId}`;
    if (!byInst.has(k)) byInst.set(k, new Map());
    byInst.get(k)!.set(x.personId, x.roomId);
  }
  let n = 0;
  for (const m of byInst.values()) if (m.get(a) && m.get(a) === m.get(b)) n++;
  return n;
}

// ---- never-alone (hard) -----------------------------------------------------
describe("never_alone is never violated", () => {
  const res = solve({
    people: people(9),
    rooms: ROOMS_1233,
    shifts: ONE_SHIFT,
    dutyDates: dates("2026-07-01", 14),
    groupRules: [{ members: ["p0", "p1"], kind: "never_alone" }],
    seed: 3,
  });
  it("reports zero never-alone violations", () => {
    expect(res.report.neverAloneViolations).toBe(0);
  });
  it("never puts the pair alone together in the 2-capacity room", () => {
    // for every instance, if both are in r2 (cap 2) that's a violation
    const byInst = new Map<string, Map<string, string>>();
    for (const a of res.assignments) {
      const k = `${a.date}|${a.shiftId}`;
      if (!byInst.has(k)) byInst.set(k, new Map());
      byInst.get(k)!.set(a.personId, a.roomId);
    }
    for (const m of byInst.values()) {
      const both = m.get("p0") === "r2" && m.get("p1") === "r2";
      expect(both).toBe(false);
    }
  });
});

// ---- apart (soft, strong) ---------------------------------------------------
describe("apart keeps a pair mostly separated", () => {
  const res = solve({
    people: people(9),
    rooms: ROOMS_1233,
    shifts: ONE_SHIFT,
    dutyDates: dates("2026-07-01", 21),
    groupRules: [{ members: ["p0", "p1"], kind: "apart", strength: 3 }],
    seed: 1,
  });
  it("shares far less than chance", () => {
    // 9 people, ~ if random they'd share many days; apart should be very low
    expect(sharedCount("p0", "p1", res.assignments)).toBeLessThanOrEqual(3);
  });
});

// ---- together as a frequency (not always, not never) ------------------------
describe("together targets a frequency, not 'always'", () => {
  const res = solve({
    people: people(9),
    rooms: ROOMS_1233,
    shifts: ONE_SHIFT,
    dutyDates: dates("2026-07-01", 21),
    groupRules: [{ members: ["p0", "p1"], kind: "together", strength: 2 }], // ~50%
    seed: 1,
  });
  it("shares sometimes but not every day", () => {
    const s = sharedCount("p0", "p1", res.assignments);
    expect(s).toBeGreaterThan(3); // clearly more than apart/chance
    expect(s).toBeLessThan(21); // not glued together every single day
  });
});

// ---- maxTogether cap --------------------------------------------------------
describe("maxTogether caps shared shifts", () => {
  const res = solve({
    people: people(9),
    rooms: ROOMS_1233,
    shifts: ONE_SHIFT,
    dutyDates: dates("2026-07-01", 21),
    groupRules: [{ members: ["p0", "p1"], kind: "together", strength: 3, maxTogether: 4 }],
    seed: 2,
  });
  it("respects the cap (soft, small slack)", () => {
    expect(sharedCount("p0", "p1", res.assignments)).toBeLessThanOrEqual(6);
  });
});

// ---- 3-person group together ------------------------------------------------
describe("a 3-person 'together' group applies to every pair", () => {
  const res = solve({
    people: people(9),
    rooms: ROOMS_1233,
    shifts: ONE_SHIFT,
    dutyDates: dates("2026-07-01", 21),
    groupRules: [{ members: ["p0", "p1", "p2"], kind: "together", strength: 2 }],
    seed: 4,
  });
  it("all three pairs share sometimes", () => {
    expect(sharedCount("p0", "p1", res.assignments)).toBeGreaterThan(2);
    expect(sharedCount("p0", "p2", res.assignments)).toBeGreaterThan(2);
    expect(sharedCount("p1", "p2", res.assignments)).toBeGreaterThan(2);
  });
});

// ---- availability (hard) ----------------------------------------------------
describe("a person is never scheduled on an unavailable day", () => {
  const d = dates("2026-09-01", 12);
  const res = solve({
    people: people(12), // bench so the day is still fillable
    rooms: ROOMS_1233,
    shifts: [{ id: "day", name: "Gündüz", startMin: 480, durationMin: 720 }],
    dutyDates: d,
    unavailability: [
      { personId: "p0", date: d[2] },
      { personId: "p0", date: d[3] },
    ],
    restHoursMin: 12,
    seed: 5,
  });
  it("respects unavailability and stays feasible", () => {
    expect(res.report.feasible).toBe(true);
    const breach = res.assignments.some(
      (a) => a.personId === "p0" && (a.date === d[2] || a.date === d[3]),
    );
    expect(breach).toBe(false);
  });
});

// ---- prefer-off (soft) ------------------------------------------------------
describe("prefer-off is avoided when there is slack", () => {
  const d = dates("2026-09-01", 12);
  const res = solve({
    people: people(12),
    rooms: ROOMS_1233,
    shifts: [{ id: "day", name: "Gündüz", startMin: 480, durationMin: 720 }],
    dutyDates: d,
    preferOff: [
      { personId: "p0", date: d[5] },
      { personId: "p0", date: d[6] },
    ],
    restHoursMin: 12,
    seed: 5,
  });
  it("keeps the person off their preferred days", () => {
    const on = res.assignments.filter(
      (a) => a.personId === "p0" && (a.date === d[5] || a.date === d[6]),
    ).length;
    expect(on).toBe(0);
  });
});

// ---- per-person target duties ----------------------------------------------
describe("a low per-person duty target is honoured", () => {
  const d = dates("2026-09-01", 14);
  const res = solve({
    people: people(12).map((p, i) => (i === 0 ? { ...p, targetDuties: 2 } : p)),
    rooms: ROOMS_1233,
    shifts: [{ id: "day", name: "Gündüz", startMin: 480, durationMin: 720 }],
    dutyDates: d,
    restHoursMin: 12,
    seed: 7,
  });
  it("gives the part-timer noticeably fewer duties", () => {
    const load = (id: string) => res.assignments.filter((a) => a.personId === id).length;
    const avg = (12 * d.length) / 12; // = d.length
    expect(load("p0")).toBeLessThan(avg);
    expect(load("p0")).toBeLessThanOrEqual(5);
  });
});

// ---- rest / no-24h ----------------------------------------------------------
describe("rest rule: never two shifts closer than the minimum rest", () => {
  const d = dates("2026-09-01", 10);
  const day: Shift = { id: "day", name: "Gündüz", startMin: 480, durationMin: 720 };
  const night: Shift = { id: "night", name: "Gece", startMin: 1200, durationMin: 720, isNight: true };
  const res = solve({
    people: people(20), // plenty so day+night (18 slots/day) is feasible
    rooms: ROOMS_1233,
    shifts: [day, night],
    dutyDates: d,
    restHoursMin: 12,
    maxDutiesPerDay: 1,
    seed: 9,
  });
  it("is feasible", () => {
    expect(res.report.feasible).toBe(true);
  });
  it("no person works two shifts < 12h apart", () => {
    const dayIdx = new Map(d.map((x, i) => [x, i]));
    const startEnd = (a: Assignment) => {
      const sh = a.shiftId === "day" ? day : night;
      const base = dayIdx.get(a.date)! * 1440;
      return [base + sh.startMin, base + sh.startMin + sh.durationMin] as const;
    };
    const byPerson = new Map<string, Assignment[]>();
    for (const a of res.assignments) {
      if (!byPerson.has(a.personId)) byPerson.set(a.personId, []);
      byPerson.get(a.personId)!.push(a);
    }
    for (const list of byPerson.values()) {
      const times = list.map(startEnd).sort((x, y) => x[0] - y[0]);
      for (let i = 1; i < times.length; i++) {
        expect(times[i][0] - times[i - 1][1]).toBeGreaterThanOrEqual(12 * 60);
      }
    }
  });
});
