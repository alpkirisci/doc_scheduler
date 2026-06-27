"use client";

import { useState } from "react";
import { Ban, Heart, Plus, ShieldAlert, Trash2, Users2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { RelationshipRow } from "@/lib/data/queries";
import { Avatar, Button, Card, SectionHeader, Segmented, Stepper, Toggle } from "@/components/ui";

type Kind = "together" | "apart" | "never_alone";

interface Person {
  id: string;
  full_name: string;
  is_difficult: boolean;
}

const KIND_META: Record<Kind, { icon: typeof Heart; accent: string; soft: string }> = {
  together: { icon: Heart, accent: "#10b981", soft: "#d1fae5" },
  apart: { icon: Ban, accent: "#f43f5e", soft: "#ffe4e6" },
  never_alone: { icon: ShieldAlert, accent: "#f59e0b", soft: "#fef3c7" },
};

export function RelationshipEditor({
  people,
  relationships,
  onAdd,
  onRemove,
}: {
  people: Person[];
  relationships: RelationshipRow[];
  onAdd: (r: { kind: Kind; member_ids: string[]; strength: number; max_together: number | null; is_hard: boolean }) => void;
  onRemove: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>("together");
  const [strength, setStrength] = useState(2);
  const [capOn, setCapOn] = useState(false);
  const [cap, setCap] = useState(5);

  const nameOf = (id: string) => people.find((p) => p.id === id)?.full_name ?? "?";
  const join = (names: string[]) => {
    if (names.length <= 1) return names.join("");
    const sep = locale === "tr" ? " ve " : " & ";
    return names.slice(0, -1).join(", ") + sep + names[names.length - 1];
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function add() {
    if (selected.length < 2) return;
    onAdd({
      kind,
      member_ids: selected,
      strength,
      max_together: kind === "together" && capOn ? cap : null,
      is_hard: false,
    });
    setSelected([]);
    setCapOn(false);
  }

  const kindLabel = (k: Kind) => (k === "together" ? t.rel.together : k === "apart" ? t.rel.apart : t.rel.neverAlone);
  const strengthOpts = [
    { value: "1", label: t.rel.light },
    { value: "2", label: t.rel.medium },
    { value: "3", label: t.rel.strong },
  ];

  return (
    <Card>
      <SectionHeader
        icon={<Heart className="h-5 w-5" />}
        accent="#ec4899"
        title={t.rel.title}
        subtitle={t.rel.subtitle}
      />

      {/* builder */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">{t.rel.who}</p>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm transition " +
                  (on
                    ? "border-indigo-400 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
                }
              >
                <Avatar name={p.full_name} size={22} difficult={p.is_difficult} />
                {p.full_name}
              </button>
            );
          })}
          {people.length === 0 && <span className="text-sm text-slate-400">{t.rel.addPeopleFirst}</span>}
        </div>

        <p className="mb-2 mt-4 text-xs font-medium text-slate-500">{t.rel.how}</p>
        <div className="flex flex-wrap gap-2">
          {(["together", "apart", "never_alone"] as Kind[]).map((k) => {
            const M = KIND_META[k];
            const Icon = M.icon;
            const on = kind === k;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition " + (on ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}
                style={on ? { background: M.accent } : undefined}
              >
                <Icon className="h-4 w-4" />
                {kindLabel(k)}
              </button>
            );
          })}
        </div>

        {kind !== "never_alone" && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Segmented options={strengthOpts} value={String(strength)} onChange={(v) => setStrength(+v)} />
            <span className="text-xs text-slate-400">
              {kind === "together" ? t.rel.togetherHint : t.rel.apartHint}
            </span>
          </div>
        )}

        {kind === "together" && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Toggle checked={capOn} onChange={setCapOn} label={t.rel.capToggle} />
            {capOn && <Stepper value={cap} onChange={setCap} min={1} max={60} />}
          </div>
        )}

        {/* live preview */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
          <span className="text-slate-600">
            {selected.length >= 2 ? (
              <>
                <span className="font-medium text-slate-900">{join(selected.map(nameOf))}</span>{" "}
                — {kindLabel(kind).toLowerCase()}
                {kind !== "never_alone" && ` (${strengthOpts[strength - 1].label})`}
                {kind === "together" && capOn && ` · ${t.rel.max} ${cap}`}
              </>
            ) : (
              <span className="text-slate-400">{t.rel.pickTwo}</span>
            )}
          </span>
          <Button onClick={add} disabled={selected.length < 2}>
            <Plus className="h-4 w-4" /> {t.rel.add}
          </Button>
        </div>
      </div>

      {/* existing rules */}
      <ul className="mt-4 space-y-2">
        {relationships.length === 0 && <li className="text-sm text-slate-400">{t.rel.none}</li>}
        {relationships.map((r) => {
          const M = KIND_META[r.kind];
          const Icon = M.icon;
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: M.accent }}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex -space-x-2">
                {r.member_ids.map((id) => (
                  <Avatar key={id} name={nameOf(id)} size={24} />
                ))}
              </span>
              <span className="min-w-0 flex-1 text-sm text-slate-700">
                <span className="font-medium">{join(r.member_ids.map(nameOf))}</span> — {kindLabel(r.kind).toLowerCase()}
                {r.kind !== "never_alone" && ` (${strengthOpts[(r.strength || 2) - 1].label})`}
                {r.kind === "together" && r.max_together != null && ` · ${t.rel.max} ${r.max_together}`}
              </span>
              <button onClick={() => onRemove(r.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Users2 className="h-3.5 w-3.5" /> {t.rel.groupHint}
      </p>
    </Card>
  );
}
