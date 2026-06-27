"use client";

import { useI18n } from "@/i18n/I18nProvider";
import type { Assignment } from "@/lib/scheduler/types";

interface GridRoom {
  id: string;
  name: string;
  capacity: number;
}
interface GridShift {
  id: string;
  name: string;
}

const ROOM_TINT = [
  "bg-emerald-50",
  "bg-sky-50",
  "bg-amber-50",
  "bg-rose-50",
  "bg-violet-50",
  "bg-teal-50",
];

/** Renders the actual roster: rows = date (× shift), columns = room slots. */
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
  const { t } = useI18n();

  const dates = Array.from(new Set(assignments.map((a) => a.date))).sort();
  const cell = new Map<string, string>();
  for (const a of assignments) {
    cell.set(`${a.date}|${a.shiftId}|${a.roomId}|${a.slotIndex}`, nameById[a.personId] ?? "?");
  }

  const slotCols: { roomId: string; slot: number; tint: string; label: string }[] = [];
  rooms.forEach((room, ri) => {
    for (let k = 0; k < room.capacity; k++) {
      slotCols.push({
        roomId: room.id,
        slot: k,
        tint: ROOM_TINT[ri % ROOM_TINT.length],
        label: room.capacity > 1 ? `${room.name} ${k + 1}` : room.name,
      });
    }
  });

  const multiShift = shifts.length > 1;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <h3 className="border-b border-slate-100 px-4 py-3 font-semibold">{t.result.scheduleGrid}</h3>
      <table className="w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">{t.fields.date}</th>
            {multiShift && <th className="px-3 py-2 text-left">{t.fields.shift}</th>}
            {slotCols.map((c, i) => (
              <th key={i} className={"px-3 py-2 text-left font-medium " + c.tint}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date) =>
            shifts.map((shift) => (
              <tr key={`${date}|${shift.id}`} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium tabular-nums">
                  {date}
                </td>
                {multiShift && <td className="px-3 py-1.5 text-slate-500">{shift.name}</td>}
                {slotCols.map((c, i) => (
                  <td key={i} className={"px-3 py-1.5 " + c.tint}>
                    {cell.get(`${date}|${shift.id}|${c.roomId}|${c.slot}`) ?? ""}
                  </td>
                ))}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
