"use client";

import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/messages";

export function LangToggle() {
  const { locale, setLocale } = useI18n();
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
