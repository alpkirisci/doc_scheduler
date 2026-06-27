"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarHeart, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Button, inputClass } from "@/components/ui";
import { LangToggle } from "@/components/LangToggle";
import type { Messages } from "@/i18n/messages";

function localizeAuthError(err: unknown, t: Messages): string {
  const m = errorMessage(err).toLowerCase();
  if (m.includes("not confirmed")) return t.auth.errNotConfirmed;
  if (m.includes("invalid login") || m.includes("invalid credentials")) return t.auth.errInvalid;
  if (m.includes("already registered") || m.includes("already exists")) return t.auth.errExists;
  if (m.includes("rate limit")) return t.auth.errRate;
  return errorMessage(err);
}

export default function LoginPage() {
  const { t } = useI18n();
  const configured = isSupabaseConfigured();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        // Confirmation OFF -> a session is returned, go straight in.
        if (data.session) {
          window.location.assign("/app");
          return;
        }
        // Email already registered (Supabase returns a user with no identities).
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setInfo(t.auth.accountExists);
          setMode("in");
          return;
        }
        setInfo(t.auth.checkEmail);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Full navigation so the freshly-set auth cookie reaches the middleware.
        window.location.assign("/app");
      }
    } catch (err) {
      setError(localizeAuthError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <CalendarHeart className="h-4 w-4" />
          </span>
          {t.appName}
        </Link>
        <LangToggle />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">{mode === "in" ? t.auth.signInTitle : t.auth.signUpTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.tagline}</p>

        {!configured && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t.auth.notConfigured}
          </p>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">{t.auth.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass + " mt-1"}
              placeholder={t.auth.emailPlaceholder}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">{t.auth.password}</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass + " mt-1"}
              placeholder="••••••••"
            />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {info && <p className="text-sm text-emerald-700">{info}</p>}
          <Button type="submit" disabled={busy || !configured} className="w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? t.auth.working : mode === "in" ? t.auth.signIn : t.auth.signUp}
          </Button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-indigo-600"
        >
          {mode === "in" ? t.auth.needAccount : t.auth.haveAccount}
        </button>
      </div>
    </main>
  );
}
