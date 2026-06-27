"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarHeart, LogOut } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui";
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
    <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/app" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <CalendarHeart className="h-4 w-4" />
          </span>
          {t.appName}
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost">{t.app.backToDemo}</Button>
          </Link>
          <LangToggle />
          <Button variant="secondary" onClick={signOut}>
            <LogOut className="h-4 w-4" /> {t.app.signOut}
          </Button>
        </div>
      </div>
    </nav>
  );
}
