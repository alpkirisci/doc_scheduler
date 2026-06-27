"use client";

// Client-side data access. All reads/writes go through the browser Supabase
// client under the user's session, so Row-Level Security enforces privacy.

import { createClient } from "@/lib/supabase/client";
import type { ScheduleInput, SolveResult, Weights } from "@/lib/scheduler/types";

// ---- row shapes (subset of columns we use) ----
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
  settings: { intervalDays?: number; weights?: Partial<Weights> } | null;
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

function db() {
  return createClient();
}

// ----------------------------- projects ------------------------------------
export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await db()
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

export async function getProject(id: string): Promise<ProjectRow> {
  const { data, error } = await db().from("projects").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function createProject(name: string): Promise<ProjectRow> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 56);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const { data, error } = await db()
    .from("projects")
    .insert({ name, start_date: iso(today), end_date: iso(end), settings: { intervalDays: 1 } })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function updateProject(id: string, patch: Partial<ProjectRow>): Promise<void> {
  const { error } = await db().from("projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await db().from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ----------------------------- generic child CRUD --------------------------
async function listChild<T>(table: string, projectId: string): Promise<T[]> {
  const { data, error } = await db().from(table).select("*").eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []) as T[];
}
export const listPeople = (p: string) => listChild<PersonRow>("people", p);
export const listRooms = (p: string) => listChild<RoomRow>("rooms", p);
export const listShifts = (p: string) => listChild<ShiftRow>("shift_defs", p);
export const listPairings = (p: string) => listChild<PairingRow>("pairing_rules", p);
export const listAvailability = (p: string) => listChild<AvailabilityRow>("availability", p);

export async function insertRow<T extends object>(table: string, row: T): Promise<void> {
  const { error } = await db().from(table).insert(row);
  if (error) throw error;
}
export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await db().from(table).delete().eq("id", id);
  if (error) throw error;
}

// ----------------------------- assemble engine input -----------------------
function timeToMin(t: string): number {
  const [h, m] = t.split(":");
  return (+h || 0) * 60 + (+m || 0);
}

function eachNthDate(start: string, end: string, n: number): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const step = Math.max(1, n);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + step)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function loadScheduleInput(projectId: string): Promise<ScheduleInput> {
  const [project, people, rooms, shifts, pairings, avail] = await Promise.all([
    getProject(projectId),
    listPeople(projectId),
    listRooms(projectId),
    listShifts(projectId),
    listPairings(projectId),
    listAvailability(projectId),
  ]);

  const interval = project.settings?.intervalDays ?? 1;
  const dutyDates = eachNthDate(project.start_date, project.end_date, interval);

  return {
    people: people.map((p) => ({ id: p.id, name: p.full_name, isDifficult: p.is_difficult })),
    rooms: rooms
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        twoPersonUndesirable: r.is_two_person_undesirable,
      })),
    shifts: shifts
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        id: s.id,
        name: s.name,
        startMin: timeToMin(s.start_time),
        durationMin: s.duration_minutes,
        isNight: s.is_night,
      })),
    dutyDates,
    unavailability: avail
      .filter((a) => a.kind === "unavailable")
      .map((a) => ({
        personId: a.person_id,
        date: a.the_date,
        shiftId: a.shift_def_id ?? undefined,
      })),
    pairRules: pairings.map((p) => ({
      a: p.person_a,
      b: p.person_b,
      kind:
        p.kind === "want_together" ? "want" : p.kind === "avoid_together" ? "avoid" : "never_alone",
      weight: p.weight,
      hard: p.is_hard,
    })),
    restHoursMin: project.rest_hours_min,
    maxDutiesPerDay: project.max_duties_per_day,
    weights: project.settings?.weights,
  };
}

// ----------------------------- persist a generated schedule ----------------
export async function saveSchedule(
  projectId: string,
  input: ScheduleInput,
  result: SolveResult,
  label: string,
): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("schedules")
    .insert({
      project_id: projectId,
      label,
      status: "active",
      engine_version: "1.0.0",
      seed: result.seed,
      fairness_score: result.report.fairnessScore,
      params_snapshot: { weights: input.weights ?? {}, iterations: result.iterations },
    })
    .select("id")
    .single();
  if (error) throw error;
  const scheduleId = (data as { id: string }).id;

  const rows = result.assignments.map((a) => ({
    schedule_id: scheduleId,
    project_id: projectId,
    the_date: a.date,
    shift_def_id: a.shiftId,
    room_id: a.roomId,
    person_id: a.personId,
    slot_index: a.slotIndex,
  }));

  // chunk inserts to stay well within request limits
  for (let i = 0; i < rows.length; i += 500) {
    const { error: aErr } = await supabase.from("assignments").insert(rows.slice(i, i + 500));
    if (aErr) throw aErr;
  }
  return scheduleId;
}

export async function listSchedules(projectId: string): Promise<ScheduleRow[]> {
  const { data, error } = await db()
    .from("schedules")
    .select("*")
    .eq("project_id", projectId)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScheduleRow[];
}
