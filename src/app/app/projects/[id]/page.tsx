"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CalendarRange,
  CalendarOff,
  Clock4,
  Download,
  DoorOpen,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { AppNav } from "@/components/AppNav";
import { ScheduleResult } from "@/components/ScheduleResult";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { RelationshipEditor } from "@/components/RelationshipEditor";
import { Avatar, Button, Card, Field, SectionHeader, Stepper, inputClass } from "@/components/ui";
import { useSolver } from "@/lib/scheduler/useSolver";
import type { Assignment, ScheduleInput, SolveResult } from "@/lib/scheduler/types";
import { downloadScheduleXlsx } from "@/lib/export/xlsx";
import { errorMessage } from "@/lib/errors";
import { assembleScheduleInput, eachNthDate } from "@/lib/data/transform";
import {
  applyShiftPattern,
  deleteRow,
  getProject,
  getScheduleAssignments,
  insertReturning,
  listAvailability,
  listPeople,
  listRelationships,
  listRooms,
  listSchedules,
  listShifts,
  saveSchedule,
  updateProject,
  type AvailabilityRow,
  type PersonRow,
  type ProjectRow,
  type RelationshipRow,
  type RoomRow,
  type ScheduleRow,
  type ShiftPattern,
  type ShiftRow,
} from "@/lib/data/queries";

type Setter<T> = React.Dispatch<React.SetStateAction<T[]>>;

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const confirm = useConfirm();
  const solve = useSolver();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [viewing, setViewing] = useState<{ label: string; assignments: Assignment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<SolveResult | null>(null);
  const [genInput, setGenInput] = useState<ScheduleInput | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [pr, pe, ro, sh, rel, av, sc] = await Promise.all([
        getProject(id),
        listPeople(id),
        listRooms(id),
        listShifts(id),
        listRelationships(id),
        listAvailability(id),
        listSchedules(id),
      ]);
      setProject(pr);
      setPeople(pe);
      setRooms(ro.slice().sort((a, b) => a.sort_order - b.sort_order));
      setShifts(sh.slice().sort((a, b) => a.sort_order - b.sort_order));
      setRelationships(rel);
      setAvailability(av);
      setSchedules(sc);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  // ---- optimistic helpers: update local state instantly, sync in background ----
  function add<T extends { id: string }>(table: string, row: object, setter: Setter<T>) {
    setError(null);
    insertReturning<T>(table, { project_id: id, ...row })
      .then((r) => setter((prev) => [...prev, r]))
      .catch((e) => setError(errorMessage(e)));
  }
  function remove<T extends { id: string }>(table: string, rid: string, setter: Setter<T>) {
    setError(null);
    setter((prev) => prev.filter((x) => x.id !== rid));
    deleteRow(table, rid).catch((e) => {
      setError(errorMessage(e));
      void reload();
    });
  }

  const currentPattern: ShiftPattern | null =
    shifts.length === 1 && !shifts[0].is_night
      ? "oncall24"
      : shifts.length === 2 && shifts.some((s) => s.is_night)
        ? "day_night"
        : null;

  async function selectPattern(p: ShiftPattern) {
    if (p === currentPattern) return;
    if (shifts.length > 0) {
      const ok = await confirm({
        title: t.common.areYouSure,
        message: t.proj.patternConfirm,
        danger: true,
        confirmLabel: t.common.confirm,
      });
      if (!ok) return;
    }
    try {
      await applyShiftPattern(id, p, locale);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function saveProjectSettings(patch: Partial<ProjectRow>) {
    try {
      await updateProject(id, patch);
      setProject((prev) => (prev ? { ...prev, ...patch } : prev));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function generate() {
    if (!project) return;
    setBusy(true);
    setResult(null);
    setSavedMsg(false);
    setError(null);
    try {
      // build straight from current (optimistic) state — no DB round-trip
      const input = assembleScheduleInput({ project, people, rooms, shifts, relationships, availability });
      setGenInput(input);
      const t0 = performance.now();
      const res = await solve({ ...input, seed: Math.floor(Math.random() * 1e9) });
      setResult(res);
      setMs(Math.round(performance.now() - t0));
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(errorMessage(err));
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
      setSchedules(await listSchedules(id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function viewSchedule(scheduleId: string, label: string) {
    try {
      const assignments = await getScheduleAssignments(scheduleId);
      setViewing({ label, assignments });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function deleteSchedule(scheduleId: string) {
    const ok = await confirm({ title: t.common.areYouSure, danger: true, confirmLabel: t.proj.deleteSchedule });
    if (ok) remove("schedules", scheduleId, setSchedules);
  }

  const nameById = Object.fromEntries(people.map((p) => [p.id, p.full_name]));
  const gridRooms = rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity }));
  const gridShifts = shifts.map((s) => ({ id: s.id, name: s.name }));
  const canGenerate = people.length > 0 && rooms.length > 0 && shifts.length > 0;

  if (!project) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-5xl px-4 py-10">
          {error ? (
            <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin" /> …
            </div>
          )}
        </main>
      </>
    );
  }

  const GenerateBar = ({ bottom = false }: { bottom?: boolean }) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={generate} disabled={busy || !canGenerate} className="px-5">
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? t.proj.generating : t.proj.generate}
      </Button>
      {!bottom && result && (
        <>
          <Button variant="secondary" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? t.proj.saving : savedMsg ? t.proj.saved : t.proj.save}
          </Button>
          <Button variant="secondary" onClick={() => genInput && downloadScheduleXlsx(genInput, result, locale)}>
            <Download className="h-4 w-4" /> {t.proj.downloadXlsx}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <GenerateBar />
        </div>
        {error && <p className="animate-fade rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {!canGenerate && <p className="text-sm text-slate-500">{t.proj.needBasics}</p>}

        {viewing && (
          <Card>
            <SectionHeader
              icon={<CalendarRange className="h-5 w-5" />}
              accent="#0ea5e9"
              title={viewing.label}
              right={<Button variant="ghost" onClick={() => setViewing(null)}>{t.proj.close}</Button>}
            />
            <ScheduleGrid rooms={gridRooms} shifts={gridShifts} nameById={nameById} assignments={viewing.assignments} />
          </Card>
        )}

        {result && genInput && <ScheduleResult input={genInput} result={result} ms={ms} />}

        <PeriodCard project={project} onSave={saveProjectSettings} />
        <ShiftCard shifts={shifts} current={currentPattern} onSelect={selectPattern} />

        <div className="grid gap-5 lg:grid-cols-2">
          <PeopleCard people={people} onAdd={(r) => add("people", r, setPeople)} onRemove={(rid) => remove("people", rid, setPeople)} />
          <RoomsCard rooms={rooms} onAdd={(r) => add("rooms", { sort_order: rooms.length, ...r }, setRooms)} onRemove={(rid) => remove("rooms", rid, setRooms)} />
        </div>

        <RelationshipEditor
          people={people}
          relationships={relationships}
          onAdd={(r) => add("relationship_rules", r, setRelationships)}
          onRemove={(rid) => remove("relationship_rules", rid, setRelationships)}
        />

        <AvailabilityCard people={people} items={availability} onAdd={(r) => add("availability", r, setAvailability)} onRemove={(rid) => remove("availability", rid, setAvailability)} />

        {/* generate again at the bottom */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <GenerateBar bottom />
        </div>

        <SchedulesCard schedules={schedules} onView={viewSchedule} onRemove={deleteSchedule} />
      </main>
    </>
  );
}

// ----------------------------- Period & rhythm -----------------------------
function PeriodCard({ project, onSave }: { project: ProjectRow; onSave: (p: Partial<ProjectRow>) => void }) {
  const { t } = useI18n();
  const [start, setStart] = useState(project.start_date);
  const [end, setEnd] = useState(project.end_date);
  const [interval, setIntervalDays] = useState(project.settings?.intervalDays ?? 1);
  const [rest, setRest] = useState(project.rest_hours_min);
  const [maxDay, setMaxDay] = useState(project.max_duties_per_day);
  const [savedTick, setSavedTick] = useState(false);
  const dutyDays = start && end && end >= start ? eachNthDate(start, end, interval).length : 0;

  function save() {
    onSave({ start_date: start, end_date: end, rest_hours_min: rest, max_duties_per_day: maxDay, settings: { ...project.settings, intervalDays: interval } });
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  }

  return (
    <Card>
      <SectionHeader icon={<CalendarRange className="h-5 w-5" />} accent="#0ea5e9" title={t.proj.period} subtitle={t.proj.periodSubtitle} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t.proj.startDate}><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} /></Field>
        <Field label={t.proj.endDate}><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} /></Field>
        <Field label={t.proj.everyN}><Stepper value={interval} onChange={setIntervalDays} min={1} max={14} /></Field>
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
        <CalendarRange className="h-4 w-4" /> ≈ {dutyDays} {t.proj.dutyDays}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-slate-500">{t.proj.advanced}</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label={t.proj.restHours} hint={t.proj.restHint}><input type="number" min={0} value={rest} onChange={(e) => setRest(+e.target.value)} className={inputClass} /></Field>
          <Field label={t.proj.maxPerDay}><input type="number" min={1} value={maxDay} onChange={(e) => setMaxDay(+e.target.value)} className={inputClass} /></Field>
        </div>
      </details>
      <div className="mt-4">
        <Button variant="secondary" onClick={save}>
          <Save className="h-4 w-4" /> {savedTick ? t.proj.saved : t.proj.saveSettings}
        </Button>
      </div>
    </Card>
  );
}

// ----------------------------- Shifts (forced single choice) ----------------
function ShiftCard({ shifts, current, onSelect }: { shifts: ShiftRow[]; current: ShiftPattern | null; onSelect: (p: ShiftPattern) => void }) {
  const { t } = useI18n();
  return (
    <Card>
      <SectionHeader icon={<Clock4 className="h-5 w-5" />} accent="#8b5cf6" title={t.proj.shifts} subtitle={t.proj.shiftsSubtitle} />
      <div className="grid gap-3 sm:grid-cols-2">
        <PatternCard selected={current === "oncall24"} icon={<Clock4 className="h-5 w-5" />} title={t.proj.p24} desc={t.proj.p24desc} onClick={() => onSelect("oncall24")} />
        <PatternCard selected={current === "day_night"} icon={<><Sun className="h-5 w-5" /><Moon className="h-5 w-5" /></>} title={t.proj.pDayNight} desc={t.proj.pDayNightDesc} onClick={() => onSelect("day_night")} />
      </div>
      {shifts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {shifts.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
              {s.is_night ? <Moon className="h-3.5 w-3.5 text-indigo-400" /> : <Sun className="h-3.5 w-3.5 text-amber-400" />}
              {s.name} · {s.start_time.slice(0, 5)} · {Math.round(s.duration_minutes / 60)}h
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
function PatternCard({ selected, icon, title, desc, onClick }: { selected: boolean; icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-150 active:scale-[0.98] " +
        (selected ? "border-violet-500 bg-violet-50 shadow-sm" : "border-slate-200 bg-white hover:border-violet-300 hover:shadow-sm")
      }
    >
      <span className={"flex h-10 items-center gap-0.5 rounded-xl px-2.5 " + (selected ? "bg-violet-500 text-white" : "bg-violet-100 text-violet-600")}>{icon}</span>
      <span>
        <span className="flex items-center gap-2 font-medium text-slate-800">
          {title}
          {selected && <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white">✓</span>}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{desc}</span>
      </span>
    </button>
  );
}

// ----------------------------- People --------------------------------------
function PeopleCard({ people, onAdd, onRemove }: { people: PersonRow[]; onAdd: (r: { full_name: string; is_difficult: boolean; target_total_duties: number | null }) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [diff, setDiff] = useState(false);
  function submit() {
    if (name.trim()) {
      onAdd({ full_name: name.trim(), is_difficult: diff, target_total_duties: null });
      setName("");
      setDiff(false);
    }
  }
  return (
    <Card>
      <SectionHeader icon={<Users className="h-5 w-5" />} accent="#6366f1" title={`${t.proj.people} · ${people.length}`} subtitle={t.proj.peopleSubtitle} />
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.proj.namePlaceholder} className={inputClass + " flex-1"} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={diff} onChange={(e) => setDiff(e.target.checked)} className="h-4 w-4 rounded accent-amber-500" />
          {t.proj.difficult}
        </label>
        <Button onClick={submit}><Plus className="h-4 w-4" /> {t.proj.add}</Button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {people.map((p) => (
          <li key={p.id} className="animate-pop inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-sm">
            <Avatar name={p.full_name} size={24} difficult={p.is_difficult} />
            {p.full_name}
            {p.is_difficult && <span className="rounded-full bg-amber-100 px-1.5 text-xs text-amber-700">{t.proj.difficult}</span>}
            <button onClick={() => onRemove(p.id)} aria-label={t.app.delete} className="text-slate-300 transition hover:text-rose-500">×</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ----------------------------- Rooms ---------------------------------------
function RoomsCard({ rooms, onAdd, onRemove }: { rooms: RoomRow[]; onAdd: (r: { name: string; capacity: number }) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [cap, setCap] = useState(2);
  function submit() {
    if (name.trim()) {
      onAdd({ name: name.trim(), capacity: cap });
      setName("");
      setCap(2);
    }
  }
  return (
    <Card>
      <SectionHeader icon={<DoorOpen className="h-5 w-5" />} accent="#14b8a6" title={`${t.proj.rooms} · ${rooms.length}`} subtitle={t.proj.roomsSubtitle} />
      <div className="flex flex-wrap items-end gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.proj.namePlaceholder} className={inputClass + " flex-1"} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <div className="flex flex-col gap-1"><span className="text-xs text-slate-500">{t.proj.peopleNeeded}</span><Stepper value={cap} onChange={setCap} min={1} max={12} /></div>
        <Button onClick={submit}><Plus className="h-4 w-4" /> {t.proj.add}</Button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {rooms.map((r) => (
          <li key={r.id} className="animate-pop flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">{r.name} <span className="text-slate-400">· {r.capacity} {t.proj.peopleUnit}</span></span>
            <button onClick={() => onRemove(r.id)} aria-label={t.app.delete} className="text-slate-300 transition hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ----------------------------- Availability --------------------------------
function AvailabilityCard({ people, items, onAdd, onRemove }: { people: PersonRow[]; items: AvailabilityRow[]; onAdd: (r: { person_id: string; the_date: string; kind: string }) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  const [person, setPerson] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<"unavailable" | "prefer_off">("unavailable");
  const nameOf = (pid: string) => people.find((p) => p.id === pid)?.full_name ?? "?";
  return (
    <Card>
      <SectionHeader icon={<CalendarOff className="h-5 w-5" />} accent="#f59e0b" title={t.proj.availability} subtitle={t.proj.availabilitySubtitle} />
      <div className="flex flex-wrap items-center gap-2">
        <select value={person} onChange={(e) => setPerson(e.target.value)} className={inputClass + " w-auto"}>
          <option value="">{t.proj.people}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass + " w-auto"} />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClass + " w-auto"}>
          <option value="unavailable">{t.proj.cantWork}</option>
          <option value="prefer_off">{t.proj.preferOff}</option>
        </select>
        <Button onClick={() => { if (person && date) { onAdd({ person_id: person, the_date: date, kind }); setDate(""); } }}><Plus className="h-4 w-4" /> {t.proj.add}</Button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((a) => (
          <li key={a.id} className="animate-pop inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-sm">
            <Avatar name={nameOf(a.person_id)} size={22} />
            {nameOf(a.person_id)} · {a.the_date.slice(5)}
            <span className={"rounded-full px-1.5 text-xs " + (a.kind === "unavailable" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>
              {a.kind === "unavailable" ? t.proj.cantWork : t.proj.preferOff}
            </span>
            <button onClick={() => onRemove(a.id)} aria-label={t.app.delete} className="text-slate-300 transition hover:text-rose-500">×</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ----------------------------- Saved schedules -----------------------------
function SchedulesCard({ schedules, onView, onRemove }: { schedules: ScheduleRow[]; onView: (id: string, label: string) => void; onRemove: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <Card>
      <SectionHeader icon={<Save className="h-5 w-5" />} accent="#64748b" title={t.proj.savedSchedules} />
      {schedules.length === 0 ? (
        <p className="text-sm text-slate-400">{t.proj.none}</p>
      ) : (
        <ul className="space-y-1.5">
          {schedules.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
              <span className="text-slate-700">
                {s.label ?? s.id.slice(0, 8)}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{t.result.fairnessScore}: {s.fairness_score ?? "?"}/100</span>
              </span>
              <span className="flex gap-1">
                <Button variant="ghost" onClick={() => onView(s.id, s.label ?? s.id.slice(0, 8))}>{t.proj.view}</Button>
                <Button variant="danger" onClick={() => onRemove(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
