// The friend's real-world case, used as the in-app "Load demo" example and as
// the engine's validation fixture:
//   9 residents, rooms Yeşil1=1 / Yeşil2=2 / Sarı=3 / Kırmızı=3 (=9 slots),
//   21 duty days on a 1-in-3 rhythm, one on-call block per duty day.
//   Ahmet Berk is the "difficult" colleague whose exposure must be shared.

import { ScheduleInput } from "./types";

function isoAddDays(start: string, days: number): string {
  const d = new Date(start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 21 duty dates, one every 3 days (≈ a 1-in-3 rhythm over ~2 months). */
export function demoDutyDates(start = "2026-07-01", count = 21, everyNDays = 3): string[] {
  return Array.from({ length: count }, (_, i) => isoAddDays(start, i * everyNDays));
}

export function buildDemoInput(): ScheduleInput {
  return {
    people: [
      { id: "p1", name: "Ayşe" },
      { id: "p2", name: "Mehmet" },
      { id: "p3", name: "Zeynep" },
      { id: "p4", name: "Can" },
      { id: "p5", name: "Elif" },
      { id: "p6", name: "Burak" },
      { id: "p7", name: "Deniz" },
      { id: "p8", name: "Selin" },
      { id: "p9", name: "Ahmet Berk", isDifficult: true },
    ],
    rooms: [
      { id: "r1", name: "Yeşil1", capacity: 1 },
      { id: "r2", name: "Yeşil2", capacity: 2, twoPersonUndesirable: true },
      { id: "r3", name: "Sarı", capacity: 3 },
      { id: "r4", name: "Kırmızı", capacity: 3 },
    ],
    shifts: [{ id: "s1", name: "Nöbet", startMin: 8 * 60, durationMin: 24 * 60 }],
    dutyDates: demoDutyDates(),
    // NOTE: this is the exact 9-people / 9-slots case — there is no slack, so a
    // person being unavailable makes a day impossible to fill (the engine will
    // say so). Unavailability/days-off shine when the pool is larger than the
    // daily slots; see the rotation scenario in scripts/validate.ts.
    groupRules: [
      // Ayşe, Zeynep & Can enjoy working together — but NOT always (~half the time)
      { members: ["p1", "p3", "p4"], kind: "together", strength: 2 },
      // Can & Burak prefer to stay apart
      { members: ["p4", "p6"], kind: "apart", strength: 2 },
      // Elif must never be the only other person in a room with Ahmet Berk
      { members: ["p5", "p9"], kind: "never_alone" },
    ],
    restHoursMin: 24,
    maxDutiesPerDay: 1,
    seed: 42,
  };
}
