"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { LangToggle } from "@/components/LangToggle";
import { ScheduleResult } from "@/components/ScheduleResult";
import { buildDemoInput } from "@/lib/scheduler/demo";
import { useSolver } from "@/lib/scheduler/useSolver";
import type { ScheduleInput, SolveResult } from "@/lib/scheduler/types";
import { downloadScheduleXlsx } from "@/lib/export/xlsx";

export default function Home() {
  const { t, locale } = useI18n();
  const solve = useSolver();

  const [input, setInput] = useState<ScheduleInput | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState<number | null>(null);

  async function generate(inp: ScheduleInput) {
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
    void generate(demo);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.appName}</h1>
          <p className="mt-1 text-slate-600">{t.tagline}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t.auth.signIn}
          </Link>
          <LangToggle />
        </div>
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
        <div className="mt-8">
          <ScheduleResult input={input} result={result} ms={ms} />
        </div>
      )}
    </main>
  );
}
