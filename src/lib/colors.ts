// Deterministic, friendly colors so each person/room looks the same everywhere.

export interface Swatch {
  solid: string; // strong bg (avatars, chips)
  soft: string; // light tint (table columns)
  text: string; // readable text on `soft`
  ring: string; // border
}

const PEOPLE: Swatch[] = [
  { solid: "#6366f1", soft: "#eef2ff", text: "#3730a3", ring: "#c7d2fe" }, // indigo
  { solid: "#0ea5e9", soft: "#e0f2fe", text: "#075985", ring: "#bae6fd" }, // sky
  { solid: "#10b981", soft: "#d1fae5", text: "#065f46", ring: "#a7f3d0" }, // emerald
  { solid: "#f59e0b", soft: "#fef3c7", text: "#92400e", ring: "#fde68a" }, // amber
  { solid: "#ef4444", soft: "#fee2e2", text: "#991b1b", ring: "#fecaca" }, // red
  { solid: "#8b5cf6", soft: "#ede9fe", text: "#5b21b6", ring: "#ddd6fe" }, // violet
  { solid: "#14b8a6", soft: "#ccfbf1", text: "#115e59", ring: "#99f6e4" }, // teal
  { solid: "#ec4899", soft: "#fce7f3", text: "#9d174d", ring: "#fbcfe8" }, // pink
  { solid: "#f97316", soft: "#ffedd5", text: "#9a3412", ring: "#fed7aa" }, // orange
  { solid: "#84cc16", soft: "#ecfccb", text: "#3f6212", ring: "#d9f99d" }, // lime
  { solid: "#06b6d4", soft: "#cffafe", text: "#155e75", ring: "#a5f3fc" }, // cyan
  { solid: "#a855f7", soft: "#f3e8ff", text: "#6b21a8", ring: "#e9d5ff" }, // purple
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function personColor(seed: string): Swatch {
  return PEOPLE[hash(seed) % PEOPLE.length];
}

export function roomColor(index: number): Swatch {
  return PEOPLE[index % PEOPLE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
