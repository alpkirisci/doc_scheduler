"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { AppNav } from "@/components/AppNav";
import { createProject, deleteProject, listProjects, type ProjectRow } from "@/lib/data/queries";
import { seedDemoProject } from "@/lib/data/seedDemo";

export default function Dashboard() {
  const { t } = useI18n();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setProjects(await listProjects());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const p = await createProject(name.trim());
      router.push(`/app/projects/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function onSeedDemo() {
    setBusy(true);
    setError(null);
    try {
      const id = await seedDemoProject();
      router.push(`/app/projects/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t.app.confirmDelete)) return;
    await deleteProject(id);
    void refresh();
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">{t.app.dashboard}</h1>

        <form onSubmit={onCreate} className="mt-6 flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.app.projectName}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? t.app.creating : t.app.create}
          </button>
          <button
            type="button"
            onClick={onSeedDemo}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {t.demo.loadDemo}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        <ul className="mt-8 space-y-2">
          {projects?.length === 0 && <li className="text-slate-500">{t.app.noProjects}</li>}
          {projects?.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-slate-500">
                  {p.start_date} → {p.end_date}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/app/projects/${p.id}`)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
                >
                  {t.app.open}
                </button>
                <button
                  onClick={() => onDelete(p.id)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  {t.app.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
