"use client";

import clsx from "clsx";
import { initials, personColor } from "@/lib/colors";

// ------------------------------- Avatar ------------------------------------
export function Avatar({
  name,
  size = 32,
  difficult = false,
  title,
}: {
  name: string;
  size?: number;
  difficult?: boolean;
  title?: string;
}) {
  const c = personColor(name);
  return (
    <span
      title={title ?? name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white"
      style={{
        background: c.solid,
        width: size,
        height: size,
        fontSize: size * 0.38,
        boxShadow: difficult ? "0 0 0 2px #f59e0b" : undefined,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function PersonChip({
  name,
  difficult,
  onRemove,
}: {
  name: string;
  difficult?: boolean;
  onRemove?: () => void;
}) {
  const c = personColor(name);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-sm font-medium"
      style={{ background: c.soft, color: c.text }}
    >
      <Avatar name={name} size={22} difficult={difficult} />
      {name}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 rounded-full px-1 text-current/70 hover:bg-black/10">
          ×
        </button>
      )}
    </span>
  );
}

// ------------------------------- Card --------------------------------------
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "animate-fade-up rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  icon,
  title,
  subtitle,
  accent = "#6366f1",
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold leading-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ------------------------------- Button ------------------------------------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSolid";
export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: { variant?: Variant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<Variant, string> = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm hover:shadow active:scale-[0.97]",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.97]",
    ghost: "text-slate-600 hover:bg-slate-100 active:scale-[0.97]",
    danger: "text-rose-600 hover:bg-rose-50",
    dangerSolid: "bg-rose-600 text-white hover:bg-rose-500 shadow-sm active:scale-[0.97]",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ------------------------------- inputs ------------------------------------
export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm text-slate-700"
    >
      <span
        className={clsx(
          "relative h-5 w-9 rounded-full transition",
          checked ? "bg-indigo-600" : "bg-slate-300",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            checked ? "left-4" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-300">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-3 py-2 text-slate-500 hover:text-slate-900"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-3 py-2 text-slate-500 hover:text-slate-900"
      >
        +
      </button>
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700",
  } as const;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        {icon}
      </span>
      <p className="font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
