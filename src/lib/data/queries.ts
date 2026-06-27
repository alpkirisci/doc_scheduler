"use client";

// Client-side data access. All reads/writes go through the browser Supabase
// client under the user's session, so Row-Level Security enforces privacy.
// Pure mapping logic lives in ./transform (unit-tested separately).

import { createClient } from "@/lib/supabase/client";
import type { Assignment, ScheduleInput, SolveResult } from "@/lib/scheduler/types";
import {
  assembleScheduleInput,
  type AvailabilityRow,
  type PersonRow,
  type ProjectRow,
  type RelationshipRow,
  type RoomRow,
  type ScheduleRow,
  type ShiftRow,
} from "./transform";

export type {
  AvailabilityRow,
  PersonRow,
  ProjectRow,
  RelationshipRow,
  RoomRow,
  ScheduleRow,
  ShiftRow,
} from "./transform";

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
export const listRelationships = (p: string) =>
  listChild<RelationshipRow>("relationship_rules", p);
export const listAvailability = (p: string) => listChild<AvailabilityRow>("availability", p);

export async function insertRow<T extends object>(table: string, row: T): Promise<void> {
  const { error } = await db().from(table).insert(row);
  if (error) throw error;
}

/** Insert and return the created row (for optimistic UI without a full reload). */
export async function insertReturning<R>(table: string, row: object): Promise<R> {
  const { data, error } = await db().from(table).insert(row).select("*").single();
  if (error) throw error;
  return data as R;
}
export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await db().from(table).delete().eq("id", id);
  if (error) throw error;
}

// ----------------------------- assemble engine input -----------------------
export async function loadScheduleInput(projectId: string): Promise<ScheduleInput> {
  const [project, people, rooms, shifts, relationships, availability] = await Promise.all([
    getProject(projectId),
    listPeople(projectId),
    listRooms(projectId),
    listShifts(projectId),
    listRelationships(projectId),
    listAvailability(projectId),
  ]);
  return assembleScheduleInput({ project, people, rooms, shifts, relationships, availability });
}

// ----------------------------- shift presets -------------------------------
export type ShiftPattern = "oncall24" | "day_night";

/**
 * One-click shift setup. Replaces the project's shifts with a preset and sets a
 * sensible minimum rest. NOTE: replacing shifts removes assignments that used
 * the old shifts (saved schedules become empty), so confirm in the UI first.
 */
export async function applyShiftPattern(
  projectId: string,
  pattern: ShiftPattern,
  locale: "tr" | "en" = "tr",
): Promise<void> {
  const supabase = db();
  const { error: delErr } = await supabase.from("shift_defs").delete().eq("project_id", projectId);
  if (delErr) throw delErr;

  const tr = locale === "tr";
  let rows: object[];
  let restHours: number;
  if (pattern === "oncall24") {
    rows = [
      {
        project_id: projectId,
        name: tr ? "Nöbet" : "On-call",
        start_time: "08:00:00",
        duration_minutes: 1440,
        is_night: false,
        sort_order: 0,
      },
    ];
    restHours = 24;
  } else {
    rows = [
      {
        project_id: projectId,
        name: tr ? "Gündüz" : "Day",
        start_time: "08:00:00",
        duration_minutes: 720,
        is_night: false,
        sort_order: 0,
      },
      {
        project_id: projectId,
        name: tr ? "Gece" : "Night",
        start_time: "20:00:00",
        duration_minutes: 720,
        is_night: true,
        sort_order: 1,
      },
    ];
    restHours = 12;
  }

  const { error } = await supabase.from("shift_defs").insert(rows);
  if (error) throw error;
  await supabase.from("projects").update({ rest_hours_min: restHours }).eq("id", projectId);
}

// ----------------------------- persist & load schedules --------------------
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

export async function getScheduleAssignments(scheduleId: string): Promise<Assignment[]> {
  const { data, error } = await db()
    .from("assignments")
    .select("the_date, shift_def_id, room_id, person_id, slot_index")
    .eq("schedule_id", scheduleId);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as {
      the_date: string;
      shift_def_id: string;
      room_id: string;
      person_id: string;
      slot_index: number;
    };
    return {
      date: row.the_date,
      shiftId: row.shift_def_id,
      roomId: row.room_id,
      personId: row.person_id,
      slotIndex: row.slot_index,
    };
  });
}
