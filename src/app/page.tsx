"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarHeart,
  FileSpreadsheet,
  Languages,
  Lock,
  Scale,
  Sparkles,
  UserX,
  Users2,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui";

export default function Home() {
  const { t } = useI18n();

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
      <header className="mb-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">{t.appName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link href="/login">
            <Button variant="secondary">{t.auth.signIn}</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <Sparkles className="h-3.5 w-3.5" /> {t.tagline}
        </span>
        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {t.landing.heroTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-slate-600">{t.landing.heroSubtitle}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login">
            <Button className="px-5 py-2.5 text-base">
              {t.landing.createOwn} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost">{t.auth.signIn}</Button>
          </Link>
        </div>

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2">
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

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-slate-200 bg-white/70 p-6 text-left shadow-sm">
          <h2 className="font-semibold text-slate-900">{t.landing.howTitle}</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2"><Step n={1} /> {t.landing.step1}</li>
            <li className="flex gap-2"><Step n={2} /> {t.landing.step2}</li>
            <li className="flex gap-2"><Step n={3} /> {t.landing.step3}</li>
            <li className="flex gap-2"><Step n={4} /> {t.landing.step4}</li>
          </ol>
        </div>
      </section>
    </main>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
      {n}
    </span>
  );
}
