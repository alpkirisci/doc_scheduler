import { describe, expect, it } from "vitest";
import { assembleScheduleInput, eachNthDate, timeToMin, type ProjectData } from "./transform";

describe("eachNthDate", () => {
  it("every 3 days, inclusive of both ends", () => {
    expect(eachNthDate("2026-07-01", "2026-07-10", 3)).toEqual([
      "2026-07-01",
      "2026-07-04",
      "2026-07-07",
      "2026-07-10",
    ]);
  });
  it("daily", () => {
    expect(eachNthDate("2026-07-01", "2026-07-03", 1)).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
  });
  it("treats n<1 as daily", () => {
    expect(eachNthDate("2026-07-01", "2026-07-02", 0)).toHaveLength(2);
  });
});

describe("timeToMin", () => {
  it("parses HH:MM:SS", () => {
    expect(timeToMin("08:30:00")).toBe(510);
    expect(timeToMin("00:00:00")).toBe(0);
    expect(timeToMin("20:00:00")).toBe(1200);
  });
});

describe("assembleScheduleInput", () => {
  const data: ProjectData = {
    project: {
      id: "p",
      name: "x",
      description: null,
      start_date: "2026-07-01",
      end_date: "2026-07-07",
      locale: "tr",
      rest_hours_min: 24,
      max_duties_per_day: 1,
      target_duties_per_person: null,
      settings: { intervalDays: 3 },
      created_at: "",
    },
    people: [
      { id: "a", project_id: "p", full_name: "A", is_difficult: false },
      { id: "b", project_id: "p", full_name: "B", is_difficult: true },
    ],
    rooms: [
      { id: "r2", project_id: "p", name: "R2", capacity: 2, is_two_person_undesirable: true, sort_order: 1 },
      { id: "r1", project_id: "p", name: "R1", capacity: 1, is_two_person_undesirable: false, sort_order: 0 },
    ],
    shifts: [
      { id: "s", project_id: "p", name: "S", start_time: "08:00:00", duration_minutes: 1440, is_night: false, sort_order: 0 },
    ],
    pairings: [
      { id: "pr", project_id: "p", person_a: "a", person_b: "b", kind: "avoid_together", weight: 2, is_hard: true },
    ],
    availability: [
      { id: "av", project_id: "p", person_id: "a", the_date: "2026-07-04", shift_def_id: null, kind: "unavailable" },
      { id: "av2", project_id: "p", person_id: "b", the_date: "2026-07-04", shift_def_id: null, kind: "prefer_off" },
    ],
  };
  const input = assembleScheduleInput(data);

  it("computes duty dates from interval", () => {
    expect(input.dutyDates).toEqual(["2026-07-01", "2026-07-04", "2026-07-07"]);
  });
  it("sorts rooms by sort_order and maps flags", () => {
    expect(input.rooms.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(input.rooms[1].twoPersonUndesirable).toBe(true);
  });
  it("maps difficult flag and pairing kind", () => {
    expect(input.people[1].isDifficult).toBe(true);
    expect(input.pairRules![0]).toMatchObject({ a: "a", b: "b", kind: "avoid", weight: 2, hard: true });
  });
  it("only treats kind='unavailable' as a hard day off", () => {
    expect(input.unavailability).toHaveLength(1);
    expect(input.unavailability![0]).toMatchObject({ personId: "a", date: "2026-07-04" });
  });
  it("carries rest + max-per-day from the project", () => {
    expect(input.restHoursMin).toBe(24);
    expect(input.maxDutiesPerDay).toBe(1);
  });
});
