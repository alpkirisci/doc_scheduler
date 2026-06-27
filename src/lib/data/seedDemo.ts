"use client";

// Seeds the friend's demo case as a real project in the logged-in user's
// account (respecting RLS). Returns the new project id.

import { createClient } from "@/lib/supabase/client";
import { buildDemoInput } from "@/lib/scheduler/demo";

export async function seedDemoProject(): Promise<string> {
  const supabase = createClient();
  const demo = buildDemoInput();
  const dates = demo.dutyDates;

  const { data: proj, error: pErr } = await supabase
    .from("projects")
    .insert({
      name: "Demo — Nöbet",
      start_date: dates[0],
      end_date: dates[dates.length - 1],
      rest_hours_min: demo.restHoursMin ?? 24,
      max_duties_per_day: demo.maxDutiesPerDay ?? 1,
      settings: { intervalDays: 3 },
      locale: "tr",
    })
    .select("id")
    .single();
  if (pErr) throw pErr;
  const projectId = (proj as { id: string }).id;

  // people
  const { data: peopleRows, error: peErr } = await supabase
    .from("people")
    .insert(
      demo.people.map((p) => ({
        project_id: projectId,
        full_name: p.name,
        is_difficult: !!p.isDifficult,
      })),
    )
    .select("id, full_name");
  if (peErr) throw peErr;
  const personId = new Map<string, string>(); // name -> db id
  for (const r of peopleRows as { id: string; full_name: string }[]) personId.set(r.full_name, r.id);
  const demoIdToName = new Map(demo.people.map((p) => [p.id, p.name]));
  const mapPerson = (demoId: string) => personId.get(demoIdToName.get(demoId) ?? "")!;

  // rooms
  const { error: rErr } = await supabase.from("rooms").insert(
    demo.rooms.map((r, i) => ({
      project_id: projectId,
      name: r.name,
      capacity: r.capacity,
      is_two_person_undesirable: !!r.twoPersonUndesirable,
      sort_order: i,
    })),
  );
  if (rErr) throw rErr;

  // shifts
  const { error: sErr } = await supabase.from("shift_defs").insert(
    demo.shifts.map((s, i) => ({
      project_id: projectId,
      name: s.name,
      start_time: `${String(Math.floor(s.startMin / 60)).padStart(2, "0")}:${String(
        s.startMin % 60,
      ).padStart(2, "0")}:00`,
      duration_minutes: s.durationMin,
      is_night: !!s.isNight,
      sort_order: i,
    })),
  );
  if (sErr) throw sErr;

  // relationship rules (groups of 2+)
  if (demo.groupRules && demo.groupRules.length) {
    const { error: prErr } = await supabase.from("relationship_rules").insert(
      demo.groupRules.map((g) => ({
        project_id: projectId,
        kind: g.kind,
        member_ids: g.members.map(mapPerson),
        strength: g.strength ?? 2,
        max_together: g.maxTogether ?? null,
        is_hard: !!g.hard,
      })),
    );
    if (prErr) throw prErr;
  }

  return projectId;
}
