"use client";

import { AlertTriangle, CheckCircle2, Clock, Scale, UserX } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ScheduleInput, SolveResult } from "@/lib/scheduler/types";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { Avatar, Card } from "@/components/ui";

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
  const difficultIds = new Set(input.people.filter((p) => p.isDifficult).map((p) => p.id));

  const good = rep.fairnessScore >= 85;
  const ok = rep.fairnessScore >= 65;
  const ring = good ? "#10b981" : ok ? "#f59e0b" : "#ef4444";

  return (
    <section className="space-y-5">
      {/* summary */}
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full text-white"
            style={{ background: `conic-gradient(${ring} ${rep.fairnessScore * 3.6}deg, #e2e8f0 0)` }}
          >
            <span className="flex h-[68px] w-[68px] flex-col items-center justify-center rounded-full bg-white">
              <span className="text-xl font-bold text-slate-900">{rep.fairnessScore}</span>
              <span className="text-[10px] text-slate-400">/ 100</span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-semibold">
              {rep.feasible ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              )}
              {good ? t.result.balanced : ok ? t.result.review : t.result.infeasible}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{t.result.fairnessScore}</p>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
          <Mini icon={<Scale className="h-3.5 w-3.5" />} label={t.result.roomSpread} value={String(rep.spreads.roomMax)} />
          <Mini icon={<UserX className="h-3.5 w-3.5" />} label={t.result.exposureSpread} value={String(rep.spreads.exposure)} />
          {ms != null && <Mini icon={<Clock className="h-3.5 w-3.5" />} label={t.result.solveTime} value={`${ms} ms`} />}
        </div>
      </Card>

      {rep.infeasibilities.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" /> {t.result.infeasible}
          </div>
          <ul className="list-disc pl-5">
            {rep.infeasibilities.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <ScheduleGrid rooms={input.rooms} shifts={input.shifts} nameById={nameById} assignments={result.assignments} />

      {/* per-person fairness matrix */}
      <Card className="overflow-hidden p-0">
        <h3 className="border-b border-slate-100 px-5 py-3.5 font-semibold">{t.result.roomMatrix}</h3>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">{t.result.person}</th>
                {input.rooms.map((r) => (
                  <th key={r.id} className="px-3 py-2.5 text-right font-medium">{r.name}</th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium">{t.result.total}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t.result.withDifficult}</th>
              </tr>
            </thead>
            <tbody>
              {rep.perPerson.map((s) => (
                <tr key={s.personId} className="border-t border-slate-100">
                  <td className="px-4 py-1.5">
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={s.name} size={24} difficult={difficultIds.has(s.personId)} />
                      <span className="font-medium text-slate-800">{s.name}</span>
                    </span>
                  </td>
                  {input.rooms.map((r) => (
                    <td key={r.id} className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                      {s.roomCount[r.id] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{s.load}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                    {difficultIds.has(s.personId) ? "—" : s.difficultExposure}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-slate-50 text-xs italic text-slate-400">
                <td className="px-4 py-1.5">{t.result.target}</td>
                {input.rooms.map((r) => (
                  <td key={r.id} className="px-3 py-1.5 text-right tabular-nums">
                    {(rep.targets.room[r.id] ?? 0).toFixed(1)}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right tabular-nums">{rep.targets.load.toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{rep.targets.exposure.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}
