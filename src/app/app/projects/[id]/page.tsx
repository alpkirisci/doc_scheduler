"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { AppNav } from "@/components/AppNav";
import { ScheduleResult } from "@/components/ScheduleResult";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { useSolver } from "@/lib/scheduler/useSolver";
import type { Assignment, ScheduleInput, SolveResult } from "@/lib/scheduler/types";
import { downloadScheduleXlsx } from "@/lib/export/xlsx";
import {
  applyShiftPattern,
  deleteRow,
  getProject,
  getScheduleAssignments,
  insertRow,
  listAvailability,
  listPairings,
  listPeople,
  listRooms,
  listSchedules,
  listShifts,
  loadScheduleInput,
  saveSchedule,
  updateProject,
  type AvailabilityRow,
  type PairingRow,
  type PersonRow,
  type ProjectRow,
  type RoomRow,
  type ScheduleRow,
  type ShiftPattern,
  type ShiftRow,
} from "@/lib/data/queries";

const inputCls = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const solve = useSolver();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [viewing, setViewing] = useState<{ label: string; assignments: Assignment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [genInput, setGenInput] = useState<ScheduleInput | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [pr, pe, ro, sh, pa, av, sc] = await Promise.all([
        getProject(id),
        listPeople(id),
        listRooms(id),
        listShifts(id),
        listPairings(id),
        listAvailability(id),
        listSchedules(id),
      ]);
      setProject(pr);
      setPeople(pe);
      setRooms(ro);
      setShifts(sh);
      setPairings(pa);
      setAvailability(av);
      setSchedules(sc);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function add(table: string, row: object) {
    setError(null);
    try {
      await insertRow(table, row);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  async function remove(table: string, rowId: string) {
    await deleteRow(table, rowId);
    await reload();
  }

  async function generate() {
    setBusy(true);
    setResult(null);
    setSavedMsg(false);
    setError(null);
    try {
      const input = await loadScheduleInput(id);
      setGenInput(input);
      const t0 = performance.now();
      const res = await solve({ ...input, seed: Math.floor(Math.random() * 1e9) });
      setResult(res);
      setMs(Math.round(performance.now() - t0));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!genInput || !result) return;
    setSaving(true);
    try {
      await saveSchedule(id, genInput, result, new Date().toLocaleString());
      setSavedMsg(true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function applyPattern(p: ShiftPattern) {
    if (!confirm(t.proj.patternConfirm)) return;
    try {
      await applyShiftPattern(id, p, locale);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function viewSchedule(scheduleId: string, label: string) {
    try {
      const assignments = await getScheduleAssignments(scheduleId);
      setViewing({ label, assignments });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const nameById = Object.fromEntries(people.map((p) => [p.id, p.full_name]));
  const gridRooms = rooms
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({ id: r.id, name: r.name, capacity: r.capacity }));
  const gridShifts = shifts
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ id: s.id, name: s.name }));

  if (!project) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-3xl px-4 py-10 text-slate-500">{error ?? "…"}</main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        {viewing && (
          <section className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{viewing.label}</h2>
              <button
                onClick={() => setViewing(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {t.proj.close}
              </button>
            </div>
            <ScheduleGrid rooms={gridRooms} shifts={gridShifts} nameById={nameById} assignments={viewing.assignments} />
          </section>
        )}

        <SettingsCard project={project} onSave={async (patch) => { await updateProject(id, patch); await reload(); }} />

        <div className="grid gap-6 lg:grid-cols-2">
          <PeopleCard people={people} onAdd={(r) => add("people", { project_id: id, ...r })} onRemove={(rid) => remove("people", rid)} />
          <RoomsCard rooms={rooms} onAdd={(r) => add("rooms", { project_id: id, sort_order: rooms.length, ...r })} onRemove={(rid) => remove("rooms", rid)} />
          <ShiftsCard shifts={shifts} onApplyPattern={applyPattern} onAdd={(r) => add("shift_defs", { project_id: id, sort_order: shifts.length, ...r })} onRemove={(rid) => remove("shift_defs", rid)} />
          <RulesCard people={people} pairings={pairings} onAdd={(r) => add("pairing_rules", { project_id: id, ...r })} onRemove={(rid) => remove("pairing_rules", rid)} />
          <AvailabilityCard people={people} items={availability} onAdd={(r) => add("availability", { project_id: id, ...r })} onRemove={(rid) => remove("availability", rid)} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? t.proj.generating : t.proj.generate}
          </button>
          {result && (
            <>
              <button onClick={save} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
                {saving ? t.proj.saving : savedMsg ? t.proj.saved : t.proj.save}
              </button>
              <button onClick={() => genInput && downloadScheduleXlsx(genInput, result, locale)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
                {t.demo.downloadXlsx}
              </button>
            </>
          )}
        </div>

        {result && genInput && <ScheduleResult input={genInput} result={result} ms={ms} />}

        <SchedulesCard schedules={schedules} onView={viewSchedule} onRemove={(sid) => remove("schedules", sid)} />
      </main>
    </>
  );
}

// --------------------------- editor cards ----------------------------------
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SettingsCard({ project, onSave }: { project: ProjectRow; onSave: (p: Partial<ProjectRow>) => void }) {
  const { t } = useI18n();
  const [start, setStart] = useState(project.start_date);
  const [end, setEnd] = useState(project.end_date);
  const [interval, setIntervalDays] = useState(project.settings?.intervalDays ?? 1);
  const [rest, setRest] = useState(project.rest_hours_min);
  const [maxDay, setMaxDay] = useState(project.max_duties_per_day);
  return (
    <Card title={t.proj.settings}>
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label={t.proj.startDate}><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} /></Field>
        <Field label={t.proj.endDate}><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} /></Field>
        <Field label={t.proj.intervalDays}><input type="number" min={1} value={interval} onChange={(e) => setIntervalDays(+e.target.value)} className={inputCls} /></Field>
        <Field label={t.proj.restHours}><input type="number" min={0} value={rest} onChange={(e) => setRest(+e.target.value)} className={inputCls} /></Field>
        <Field label={t.proj.maxPerDay}><input type="number" min={1} value={maxDay} onChange={(e) => setMaxDay(+e.target.value)} className={inputCls} /></Field>
      </div>
      <button
        onClick={() => onSave({ start_date: start, end_date: end, rest_hours_min: rest, max_duties_per_day: maxDay, settings: { ...project.settings, intervalDays: interval } })}
        className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        {t.proj.saveSettings}
      </button>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      {label}
      {children}
    </label>
  );
}

function PeopleCard({ people, onAdd, onRemove }: { people: PersonRow[]; onAdd: (r: { full_name: string; is_difficult: boolean }) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [diff, setDiff] = useState(false);
  return (
    <Card title={`${t.proj.people} (${people.length})`}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.proj.name} className={inputCls + " flex-1"} />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={diff} onChange={(e) => setDiff(e.target.checked)} />{t.proj.difficult}</label>
        <button onClick={() => { if (name.trim()) { onAdd({ full_name: name.trim(), is_difficult: diff }); setName(""); setDiff(false); } }} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700">{t.proj.add}</button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
            <span>{p.full_name} {p.is_difficult && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-800">{t.proj.difficult}</span>}</span>
            <button onClick={() => onRemove(p.id)} className="text-xs text-slate-400 hover:text-rose-600">{t.proj.remove}</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RoomsCard({ rooms, onAdd, onRemove }: { rooms: RoomRow[]; onAdd: (r: { name: string; capacity: number; is_two_person_undesirable: boolean }) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [cap, setCap] = useState(1);
  const [two, setTwo] = useState(false);
  return (
    <Card title={`${t.proj.rooms} (${rooms.length})`}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.proj.name} className={inputCls + " flex-1"} />
        <input type="number" min={1} value={cap} onChange={(e) => setCap(+e.target.value)} className={inputCls + " w-20"} title={t.proj.capacity} />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={two} onChange={(e) => setTwo(e.target.checked)} />{t.proj.twoUndesirable}</label>
        <button onClick={() => { if (name.trim()) { onAdd({ name: name.trim(), capacity: cap, is_two_person_undesirable: two }); setName(""); setCap(1); setTwo(false); } }} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700">{t.proj.add}</button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {rooms.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
            <span>{r.name} · {t.proj.capacity} {r.capacity}</span>
            <button onClick={() => onRemove(r.id)} className="text-xs text-slate-400 hover:text-rose-600">{t.proj.remove}</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ShiftsCard({
  shifts,
  onApplyPattern,
  onAdd,
  onRemove,
}: {
  shifts: ShiftRow[];
  onApplyPattern: (p: ShiftPattern) => void;
  onAdd: (r: { name: string; start_time: string; duration_minutes: number; is_night: boolean }) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [start, setStart] = useState("08:00");
  const [hours, setHours] = useState(24);
  const [night, setNight] = useState(false);
  return (
    <Card title={`${t.proj.shifts} (${shifts.length})`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
        <span className="text-xs font-medium text-slate-500">{t.proj.shiftPattern}:</span>
        <button
          onClick={() => onApplyPattern("oncall24")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          {t.proj.p24}
        </button>
        <button
          onClick={() => onApplyPattern("day_night")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          {t.proj.pDayNight}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.proj.name} className={inputCls + " w-28"} />
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} title={t.proj.startTime} />
        <input type="number" min={1} max={24} value={hours} onChange={(e) => setHours(+e.target.value)} className={inputCls + " w-20"} title={t.proj.durationH} />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} />{t.proj.night}</label>
        <button onClick={() => { if (name.trim()) { onAdd({ name: name.trim(), start_time: start + ":00", duration_minutes: Math.round(hours * 60), is_night: night }); setName(""); } }} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700">{t.proj.add}</button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {shifts.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
            <span>{s.name} · {s.start_time.slice(0, 5)} · {Math.round(s.duration_minutes / 60)}h{s.is_night ? " · 🌙" : ""}</span>
            <button onClick={() => onRemove(s.id)} className="text-xs text-slate-400 hover:text-rose-600">{t.proj.remove}</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RulesCard({ people, pairings, onAdd, onRemove }: { people: PersonRow[]; pairings: PairingRow[]; onAdd: (r: { person_a: string; person_b: string; kind: string; weight: number; is_hard: boolean }) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [kind, setKind] = useState<"want_together" | "avoid_together" | "never_alone">("want_together");
  const nameOf = (pid: string) => people.find((p) => p.id === pid)?.full_name ?? "?";
  return (
    <Card title={`${t.proj.rules} (${pairings.length})`}>
      <div className="flex flex-wrap items-center gap-2">
        <select value={a} onChange={(e) => setA(e.target.value)} className={inputCls}>
          <option value="">{t.proj.personA}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} className={inputCls}>
          <option value="">{t.proj.personB}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputCls}>
          <option value="want_together">{t.proj.want}</option>
          <option value="avoid_together">{t.proj.avoid}</option>
          <option value="never_alone">{t.proj.neverAlone}</option>
        </select>
        <button onClick={() => { if (a && b && a !== b) { onAdd({ person_a: a, person_b: b, kind, weight: 1, is_hard: kind === "never_alone" }); setA(""); setB(""); } }} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700">{t.proj.add}</button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {pairings.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
            <span>{nameOf(p.person_a)} — {nameOf(p.person_b)} · {p.kind === "want_together" ? t.proj.want : p.kind === "avoid_together" ? t.proj.avoid : t.proj.neverAlone}</span>
            <button onClick={() => onRemove(p.id)} className="text-xs text-slate-400 hover:text-rose-600">{t.proj.remove}</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AvailabilityCard({ people, items, onAdd, onRemove }: { people: PersonRow[]; items: AvailabilityRow[]; onAdd: (r: { person_id: string; the_date: string; kind: string }) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  const [person, setPerson] = useState("");
  const [date, setDate] = useState("");
  const nameOf = (pid: string) => people.find((p) => p.id === pid)?.full_name ?? "?";
  return (
    <Card title={`${t.proj.availability} (${items.length})`}>
      <div className="flex flex-wrap items-center gap-2">
        <select value={person} onChange={(e) => setPerson(e.target.value)} className={inputCls}>
          <option value="">{t.proj.people}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <button onClick={() => { if (person && date) { onAdd({ person_id: person, the_date: date, kind: "unavailable" }); setDate(""); } }} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700">{t.proj.add}</button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
            <span>{nameOf(a.person_id)} · {a.the_date}</span>
            <button onClick={() => onRemove(a.id)} className="text-xs text-slate-400 hover:text-rose-600">{t.proj.remove}</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SchedulesCard({ schedules, onView, onRemove }: { schedules: ScheduleRow[]; onView: (id: string, label: string) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <Card title={t.proj.savedSchedules}>
      {schedules.length === 0 ? (
        <p className="text-sm text-slate-500">{t.proj.none}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {schedules.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
              <span>{s.label ?? s.id.slice(0, 8)} · {t.result.fairnessScore}: {s.fairness_score ?? "?"}/100</span>
              <span className="flex gap-3">
                <button onClick={() => onView(s.id, s.label ?? s.id.slice(0, 8))} className="text-xs text-slate-500 hover:text-slate-900">{t.proj.view}</button>
                <button onClick={() => onRemove(s.id)} className="text-xs text-slate-400 hover:text-rose-600">{t.proj.deleteSchedule}</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
