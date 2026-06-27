"use client";

import { useI18n } from "@/i18n/I18nProvider";
import type { ScheduleInput, SolveResult } from "@/lib/scheduler/types";
import { ScheduleGrid } from "@/components/ScheduleGrid";

export function ScheduleResult({
  input,
  result,
  ms,
}: {
  input: ScheduleInput;
  result: SolveResult;
  ms?: number | null;
}) {
  const { t } = useI18n();
  const rep = result.report;
  const nameById = Object.fromEntries(input.people.map((p) => [p.id, p.name]));
  const scoreColor =
    rep.fairnessScore >= 85
      ? "text-emerald-600"
      : rep.fairnessScore >= 65
        ? "text-amber-600"
        : "text-rose-600";

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t.result.fairnessScore} value={`${rep.fairnessScore}/100`} className={scoreColor} />
        <Stat
          label={rep.feasible ? t.result.feasible : t.result.infeasible}
          value={rep.feasible ? "✓" : "✕"}
          className={rep.feasible ? "text-emerald-600" : "text-rose-600"}
        />
        <Stat label={t.result.spreads} value={`${rep.spreads.roomMax} / ${rep.spreads.exposure}`} />
        {ms != null && <Stat label={t.result.solveTime} value={`${ms} ms`} />}
      </div>

      {rep.infeasibilities.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <ul className="list-disc pl-5">
            {rep.infeasibilities.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <ScheduleGrid
        rooms={input.rooms}
        shifts={input.shifts}
        nameById={nameById}
        assignments={result.assignments}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-4 py-3 font-semibold">{t.result.roomMatrix}</h3>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">{t.result.person}</th>
              {input.rooms.map((r) => (
                <th key={r.id} className="px-3 py-2 text-right">
                  {r.name}
                </th>
              ))}
              <th className="px-3 py-2 text-right">{t.result.total}</th>
              <th className="px-3 py-2 text-right">{t.result.withDifficult}</th>
            </tr>
          </thead>
          <tbody>
            {rep.perPerson.map((s) => (
              <tr key={s.personId} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                {input.rooms.map((r) => (
                  <td key={r.id} className="px-3 py-2 text-right tabular-nums">
                    {s.roomCount[r.id] ?? 0}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{s.load}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.difficultExposure}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 bg-slate-50 italic text-slate-500">
              <td className="px-3 py-2">{t.result.target}</td>
              {input.rooms.map((r) => (
                <td key={r.id} className="px-3 py-2 text-right tabular-nums">
                  {(rep.targets.room[r.id] ?? 0).toFixed(1)}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums">{rep.targets.load.toFixed(1)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{rep.targets.exposure.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={"mt-1 text-lg font-semibold " + className}>{value}</div>
    </div>
  );
}
