"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { LangToggle } from "@/components/LangToggle";
import { createClient } from "@/lib/supabase/client";

export function AppNav() {
  const { t } = useI18n();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/app" className="font-bold tracking-tight">
          {t.appName}
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-slate-600 hover:underline">
            {t.app.backToDemo}
          </Link>
          <LangToggle />
          <button
            onClick={signOut}
            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            {t.app.signOut}
          </button>
        </div>
      </div>
    </nav>
  );
}
