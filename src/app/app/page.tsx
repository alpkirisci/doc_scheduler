"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, FolderPlus, Sparkles, Trash2, ArrowRight, FolderOpen } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { AppNav } from "@/components/AppNav";
import { Button, Card, EmptyState, inputClass } from "@/components/ui";
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
      router.push(`/app/projects/${await seedDemoProject()}`);
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
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">{t.app.dashboard}</h1>
        <p className="mt-1 text-slate-500">{t.app.dashboardSubtitle}</p>

        <Card className="mt-6">
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <label className="flex-1">
              <span className="text-xs font-medium text-slate-600">{t.app.projectName}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.app.projectNamePlaceholder}
                className={inputClass + " mt-1"}
              />
            </label>
            <Button type="submit" disabled={busy}>
              <FolderPlus className="h-4 w-4" /> {busy ? t.app.creating : t.app.create}
            </Button>
            <Button type="button" variant="secondary" onClick={onSeedDemo} disabled={busy}>
              <Sparkles className="h-4 w-4" /> {t.demo.loadDemo}
            </Button>
          </form>
        </Card>

        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-6">
          {projects && projects.length === 0 && (
            <EmptyState
              icon={<FolderOpen className="h-6 w-6" />}
              title={t.app.noProjects}
              subtitle={t.app.noProjectsHint}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {projects?.map((p) => (
              <Card key={p.id} className="group flex items-center justify-between gap-3 transition hover:border-indigo-300">
                <button onClick={() => router.push(`/app/projects/${p.id}`)} className="min-w-0 flex-1 text-left">
                  <div className="truncate font-semibold text-slate-900">{p.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                    <CalendarRange className="h-3.5 w-3.5" />
                    {p.start_date} → {p.end_date}
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={() => router.push(`/app/projects/${p.id}`)}>
                    {t.app.open} <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(p.id)} aria-label={t.app.delete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
