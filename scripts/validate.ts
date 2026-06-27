/* eslint-disable no-console */
// Runs the scheduler on (A) the friend's real case and (B) a rotation case
// with a bench, day-off availability and night shifts. Prints explainable
// fairness reports and asserts the headline guarantees, so this doubles as a
// regression test: `npm run validate`.

import { solve } from "../src/lib/scheduler/engine";
import { buildDemoInput } from "../src/lib/scheduler/demo";
import type { ScheduleInput } from "../src/lib/scheduler/types";

function pad(s: string, n: number) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
function padl(s: string, n: number) {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

interface Limits {
  roomSpread: number;
  exposureSpread: number;
  loadSpread: number;
  expectFeasible: boolean;
}

function runScenario(label: string, input: ScheduleInput, limits: Limits): string[] {
  const t0 = Date.now();
  const result = solve(input);
  const ms = Date.now() - t0;
  const rep = result.report;

  console.log("\n" + "=".repeat(70));
  console.log(`  ${label}`);
  console.log("=".repeat(70));
  console.log(
    `people=${input.people.length}  rooms=${input.rooms.length}  ` +
      `shifts/day=${input.shifts.length}  dutyDays=${input.dutyDates.length}  ` +
      `placed=${result.assignments.length}`,
  );
  console.log(`solve: ${ms}ms  seed:${result.seed}  iters/restart:${result.iterations}`);
  console.log(
    `feasible:${rep.feasible}  hardViolations:${rep.hardViolations}  ` +
      `fairnessScore:${rep.fairnessScore}/100`,
  );
  if (rep.infeasibilities.length) {
    console.log("INFEASIBILITIES:");
    for (const m of rep.infeasibilities) console.log("  - " + m);
  }

  const roomIds = input.rooms.map((r) => r.id);
  const roomNames = input.rooms.map((r) => r.name);
  let header = pad("Person", 13);
  for (const n of roomNames) header += padl(n, 9);
  header += padl("Total", 8) + padl("w/diff", 8) + padl("nights", 8);
  console.log("\n  " + header);
  for (const s of rep.perPerson) {
    let line = pad(s.name, 13);
    for (const id of roomIds) line += padl(String(s.roomCount[id] ?? 0), 9);
    line +=
      padl(String(s.load), 8) + padl(String(s.difficultExposure), 8) + padl(String(s.nightCount), 8);
    console.log("  " + line);
  }
  let tline = pad("TARGET", 13);
  for (const id of roomIds) tline += padl(rep.targets.room[id].toFixed(2), 9);
  tline += padl(rep.targets.load.toFixed(2), 8) + padl(rep.targets.exposure.toFixed(2), 8);
  console.log("  " + tline);

  console.log(
    `\n  spreads (max-min): room=${rep.spreads.roomMax}  load=${rep.spreads.load}  ` +
      `diff-exposure=${rep.spreads.exposure}`,
  );
  console.log(
    `  rules: neverAloneViol=${rep.neverAloneViolations}  avoidShared=${rep.avoidViolations}  ` +
      `wantShared=${rep.wantSatisfied}  2-rooms=${rep.twoRoomCount}`,
  );

  // availability respected?
  const unavail = new Set((input.unavailability ?? []).map((u) => `${u.personId}|${u.date}`));
  let availBreaches = 0;
  for (const a of result.assignments) if (unavail.has(`${a.personId}|${a.date}`)) availBreaches++;

  const fails: string[] = [];
  if (limits.expectFeasible) {
    if (!rep.feasible) fails.push("not feasible");
    if (rep.hardViolations !== 0) fails.push(`hardViolations=${rep.hardViolations}`);
    if (rep.neverAloneViolations !== 0) fails.push(`neverAlone violated ${rep.neverAloneViolations}x`);
    if (availBreaches !== 0) fails.push(`availability breached ${availBreaches}x`);
    if (rep.spreads.roomMax > limits.roomSpread)
      fails.push(`room spread ${rep.spreads.roomMax} > ${limits.roomSpread}`);
    if (rep.spreads.exposure > limits.exposureSpread)
      fails.push(`exposure spread ${rep.spreads.exposure} > ${limits.exposureSpread}`);
    if (rep.spreads.load > limits.loadSpread)
      fails.push(`load spread ${rep.spreads.load} > ${limits.loadSpread}`);
  }
  console.log("  " + (fails.length === 0 ? "✅ scenario OK" : "❌ " + fails.join("; ")));
  return fails;
}

// --- Scenario A: the friend's exact case (9 people, 9 slots, 21 days) ---
const aFails = runScenario("A) Friend's real case — 9 people / 4 rooms / 21 days", buildDemoInput(), {
  roomSpread: 2,
  exposureSpread: 2,
  loadSpread: 1,
  expectFeasible: true,
});

// --- Scenario B: rotation with bench, days off, and day/night shifts ---
function isoAddDays(start: string, days: number) {
  const d = new Date(start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const bDates = Array.from({ length: 14 }, (_, i) => isoAddDays("2026-09-01", i));
const bInput: ScheduleInput = {
  people: Array.from({ length: 12 }, (_, i) => ({
    id: `b${i + 1}`,
    name: `Kişi${i + 1}`,
    isDifficult: i === 11, // last person is the difficult colleague
  })),
  rooms: [
    { id: "r1", name: "Yeşil1", capacity: 1 },
    { id: "r2", name: "Yeşil2", capacity: 2, twoPersonUndesirable: true },
    { id: "r3", name: "Sarı", capacity: 3 },
    { id: "r4", name: "Kırmızı", capacity: 3 },
  ],
  shifts: [{ id: "day", name: "Gündüz", startMin: 8 * 60, durationMin: 12 * 60 }],
  dutyDates: bDates,
  unavailability: [
    { personId: "b1", date: bDates[2] },
    { personId: "b1", date: bDates[3] },
    { personId: "b5", date: bDates[7] },
  ],
  pairRules: [
    { a: "b2", b: "b3", kind: "want", weight: 2 },
    { a: "b4", b: "b6", kind: "avoid", weight: 1 },
    { a: "b7", b: "b12", kind: "never_alone" },
  ],
  restHoursMin: 12,
  maxDutiesPerDay: 1,
  seed: 7,
};
const bFails = runScenario("B) Rotation — 12 people / 9 slots / 14 days (bench + days off)", bInput, {
  roomSpread: 3,
  exposureSpread: 3,
  loadSpread: 3,
  expectFeasible: true,
});

console.log("\n" + "=".repeat(70));
const total = aFails.length + bFails.length;
if (total === 0) {
  console.log("  ✅ ALL SCENARIOS PASSED");
  process.exit(0);
} else {
  console.log(`  ❌ ${total} check(s) failed`);
  process.exit(1);
}
