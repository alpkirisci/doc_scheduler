// Pure data-shape + mapping helpers (no React / Supabase / DOM imports) so they
// can be unit-tested directly and reused on server or client.

import type { ScheduleInput } from "@/lib/scheduler/types";

// ---- DB row shapes (subset of columns we use) ----
export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  locale: string;
  rest_hours_min: number;
  max_duties_per_day: number;
  target_duties_per_person: number | null;
  settings: { intervalDays?: number; weights?: Partial<ScheduleInput["weights"]> } | null;
  created_at: string;
}
export interface PersonRow {
  id: string;
  project_id: string;
  full_name: string;
  is_difficult: boolean;
}
export interface RoomRow {
  id: string;
  project_id: string;
  name: string;
  capacity: number;
  is_two_person_undesirable: boolean;
  sort_order: number;
}
export interface ShiftRow {
  id: string;
  project_id: string;
  name: string;
  start_time: string; // "HH:MM:SS"
  duration_minutes: number;
  is_night: boolean;
  sort_order: number;
}
export interface PairingRow {
  id: string;
  project_id: string;
  person_a: string;
  person_b: string;
  kind: "want_together" | "avoid_together" | "never_alone";
  weight: number;
  is_hard: boolean;
}
export interface AvailabilityRow {
  id: string;
  project_id: string;
  person_id: string;
  the_date: string;
  shift_def_id: string | null;
  kind: "unavailable" | "prefer_off" | "must_work";
}
export interface ScheduleRow {
  id: string;
  project_id: string;
  label: string | null;
  status: string;
  seed: number | null;
  fairness_score: number | null;
  generated_at: string;
}

export interface ProjectData {
  project: ProjectRow;
  people: PersonRow[];
  rooms: RoomRow[];
  shifts: ShiftRow[];
  pairings: PairingRow[];
  availability: AvailabilityRow[];
}

/** "08:30:00" -> 510 minutes from midnight. */
export function timeToMin(t: string): number {
  const [h, m] = t.split(":");
  return (+h || 0) * 60 + (+m || 0);
}

/** Inclusive list of ISO dates from `start` to `end`, every `n` days. */
export function eachNthDate(start: string, end: string, n: number): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const step = Math.max(1, n);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + step)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const PAIR_KIND = {
  want_together: "want",
  avoid_together: "avoid",
  never_alone: "never_alone",
} as const;

/** Map a project's DB rows into the engine's ScheduleInput. */
export function assembleScheduleInput(d: ProjectData): ScheduleInput {
  const interval = d.project.settings?.intervalDays ?? 1;
  return {
    people: d.people.map((p) => ({ id: p.id, name: p.full_name, isDifficult: p.is_difficult })),
    rooms: d.rooms
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        twoPersonUndesirable: r.is_two_person_undesirable,
      })),
    shifts: d.shifts
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        id: s.id,
        name: s.name,
        startMin: timeToMin(s.start_time),
        durationMin: s.duration_minutes,
        isNight: s.is_night,
      })),
    dutyDates: eachNthDate(d.project.start_date, d.project.end_date, interval),
    unavailability: d.availability
      .filter((a) => a.kind === "unavailable")
      .map((a) => ({ personId: a.person_id, date: a.the_date, shiftId: a.shift_def_id ?? undefined })),
    pairRules: d.pairings.map((p) => ({
      a: p.person_a,
      b: p.person_b,
      kind: PAIR_KIND[p.kind],
      weight: p.weight,
      hard: p.is_hard,
    })),
    restHoursMin: d.project.rest_hours_min,
    maxDutiesPerDay: d.project.max_duties_per_day,
    weights: d.project.settings?.weights,
  };
}
