"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/messages";
import { buildDemoInput } from "@/lib/scheduler/demo";
import { useSolver } from "@/lib/scheduler/useSolver";
import type { ScheduleInput, SolveResult } from "@/lib/scheduler/types";
import { downloadScheduleXlsx } from "@/lib/export/xlsx";

export default function Home() {
  const { t, locale, setLocale } = useI18n();
  const solve = useSolver();

  const [input, setInput] = useState<ScheduleInput | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState<number | null>(null);

  async function handleGenerate(inp: ScheduleInput) {
    setBusy(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const res = await solve({ ...inp, seed: Math.floor(Math.random() * 1e9) });
      setResult(res);
      setMs(Math.round(performance.now() - t0));
    } finally {
      setBusy(false);
    }
  }

  function loadDemo() {
    const demo = buildDemoInput();
    setInput(demo);
    setResult(null);
    void handleGenerate(demo);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.appName}</h1>
          <p className="mt-1 text-slate-600">{t.tagline}</p>
        </div>
        <LangToggle locale={locale} setLocale={setLocale} />
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">{t.demo.title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.demo.subtitle}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={loadDemo}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {input ? t.demo.regenerate : t.demo.loadDemo}
          </button>
          {busy && <span className="self-center text-sm text-slate-500">{t.demo.generating}</span>}
          {result && (
            <button
              onClick={() => input && downloadScheduleXlsx(input, result, locale)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              {t.demo.downloadXlsx}
            </button>
          )}
        </div>
      </section>

      {result && input && (
        <ResultView t={t} input={input} result={result} ms={ms} />
      )}
    </main>
  );
}

function LangToggle({ locale, setLocale }: { locale: Locale; setLocale: (l: Locale) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
      {(["tr", "en"] as Locale[]).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={
            "px-3 py-1.5 " + (locale === l ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50")
          }
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ResultView({
  t,
  input,
  result,
  ms,
}: {
  t: ReturnType<typeof useI18n>["t"];
  input: ScheduleInput;
  result: SolveResult;
  ms: number | null;
}) {
  const rep = result.report;
  const scoreColor =
    rep.fairnessScore >= 85 ? "text-emerald-600" : rep.fairnessScore >= 65 ? "text-amber-600" : "text-rose-600";

  return (
    <section className="mt-8 space-y-6">
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
