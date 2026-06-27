"use client";

import { CalendarDays } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { Assignment } from "@/lib/scheduler/types";
import { roomColor } from "@/lib/colors";
import { Avatar } from "@/components/ui";

interface GridRoom {
  id: string;
  name: string;
  capacity: number;
}
interface GridShift {
  id: string;
  name: string;
}

function weekday(dateIso: string, locale: string) {
  try {
    return new Date(dateIso + "T00:00:00Z").toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
  } catch {
    return "";
  }
}

/** The actual roster: rows = date (× shift), columns = room slots, with avatars. */
export function ScheduleGrid({
  rooms,
  shifts,
  nameById,
  assignments,
}: {
  rooms: GridRoom[];
  shifts: GridShift[];
  nameById: Record<string, string>;
  assignments: Assignment[];
}) {
  const { t, locale } = useI18n();

  const dates = Array.from(new Set(assignments.map((a) => a.date))).sort();
  const cell = new Map<string, string>();
  for (const a of assignments) {
    cell.set(`${a.date}|${a.shiftId}|${a.roomId}|${a.slotIndex}`, nameById[a.personId] ?? "?");
  }

  const slotCols: { roomId: string; slot: number; ri: number; label: string }[] = [];
  rooms.forEach((room, ri) => {
    for (let k = 0; k < room.capacity; k++) {
      slotCols.push({
        roomId: room.id,
        slot: k,
        ri,
        label: room.capacity > 1 ? `${room.name} ${k + 1}` : room.name,
      });
    }
  });
  const multiShift = shifts.length > 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <CalendarDays className="h-4 w-4 text-indigo-500" />
        <h3 className="font-semibold">{t.result.scheduleGrid}</h3>
      </div>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left font-medium">
                {t.fields.date}
              </th>
              {multiShift && <th className="px-3 py-2.5 text-left font-medium">{t.fields.shift}</th>}
              {slotCols.map((c, i) => {
                const col = roomColor(c.ri);
                return (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left font-semibold"
                    style={{ background: col.soft, color: col.text }}
                  >
                    {c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) =>
              shifts.map((shift) => (
                <tr key={`${date}|${shift.id}`} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 bg-white px-4 py-1.5">
                    <div className="font-medium tabular-nums text-slate-800">{date.slice(5)}</div>
                    <div className="text-[11px] text-slate-400">{weekday(date, locale)}</div>
                  </td>
                  {multiShift && <td className="px-3 py-1.5 text-slate-500">{shift.name}</td>}
                  {slotCols.map((c, i) => {
                    const name = cell.get(`${date}|${shift.id}|${c.roomId}|${c.slot}`);
                    const col = roomColor(c.ri);
                    return (
                      <td key={i} className="px-3 py-1.5" style={{ background: col.soft + "80" }}>
                        {name ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Avatar name={name} size={22} />
                            <span className="text-slate-700">{name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
