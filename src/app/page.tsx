"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarHeart,
  Download,
  FileSpreadsheet,
  Languages,
  Lock,
  RefreshCw,
  Scale,
  Sparkles,
  UserX,
  Users2,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { LangToggle } from "@/components/LangToggle";
import { ScheduleResult } from "@/components/ScheduleResult";
import { Button } from "@/components/ui";
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

  const features = [
    { icon: <Scale className="h-4 w-4" />, label: t.features.equalRooms },
    { icon: <UserX className="h-4 w-4" />, label: t.features.fairDifficult },
    { icon: <Users2 className="h-4 w-4" />, label: t.features.groups },
    { icon: <FileSpreadsheet className="h-4 w-4" />, label: t.features.excel },
    { icon: <Languages className="h-4 w-4" />, label: t.features.bilingual },
    { icon: <Lock className="h-4 w-4" />, label: t.features.private },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">{t.appName}</span>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link href="/app">
            <Button variant="secondary">{t.auth.signIn}</Button>
          </Link>
        </div>
      </header>

      <section className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <Sparkles className="h-3.5 w-3.5" /> {t.tagline}
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {t.landing.heroTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-slate-600">{t.landing.heroSubtitle}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={loadDemo} disabled={busy} className="px-5 py-2.5 text-base">
            {busy ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> {t.demo.generating}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> {input ? t.demo.regenerate : t.demo.loadDemo}
              </>
            )}
          </Button>
          {result && input && (
            <Button variant="secondary" onClick={() => downloadScheduleXlsx(input, result, locale)}>
              <Download className="h-4 w-4" /> {t.demo.downloadXlsx}
            </Button>
          )}
          <Link href="/app">
            <Button variant="ghost">
              {t.landing.createOwn} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2">
          {features.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm text-slate-600 shadow-sm"
            >
              <span className="text-indigo-500">{f.icon}</span>
              {f.label}
            </span>
          ))}
        </div>
      </section>

      {result && input && (
        <div className="mt-12">
          <div className="mb-3 text-center text-sm text-slate-400">{t.demo.subtitle}</div>
          <ScheduleResult input={input} result={result} ms={ms} />
        </div>
      )}
    </main>
  );
}
