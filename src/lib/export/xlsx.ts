// Client-side Excel export. ExcelJS is dynamically imported so it only loads on
// download. The workbook BUILDER is separated from the DOWNLOAD trigger so the
// build can be unit-tested in Node (see xlsx.test.ts).

import type { ScheduleInput, SolveResult } from "../scheduler/types";
import type { Locale } from "@/i18n/messages";

const ROOM_TINTS = ["FFE8F5E9", "FFE3F2FD", "FFFFF8E1", "FFFFEBEE", "FFF3E5F5", "FFE0F7FA"];

/** Builds the workbook and returns it as a binary buffer. Pure / Node-safe. */
export async function buildScheduleBuffer(
  input: ScheduleInput,
  result: SolveResult,
  locale: Locale = "tr",
): Promise<ArrayBuffer> {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof import("exceljs") }).default ?? mod;
  const tr = locale === "tr";
  const wb = new ExcelJS.Workbook();
  wb.creator = "doc_scheduler";

  const personName = new Map(input.people.map((p) => [p.id, p.name]));
  const shiftById = new Map(input.shifts.map((s) => [s.id, s]));

  // -------- Sheet 1: schedule grid --------
  const grid = wb.addWorksheet(tr ? "Çizelge" : "Schedule", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });
  const cols: Partial<{ header: string; key: string; width: number }>[] = [
    { header: tr ? "Tarih" : "Date", key: "date", width: 12 },
    { header: tr ? "Vardiya" : "Shift", key: "shift", width: 12 },
  ];
  const slotCols: { roomId: string; slotIndex: number; key: string; tint: string }[] = [];
  input.rooms.forEach((room, ri) => {
    for (let k = 0; k < room.capacity; k++) {
      const key = `${room.id}__${k}`;
      cols.push({ header: room.capacity > 1 ? `${room.name} ${k + 1}` : room.name, key, width: 14 });
      slotCols.push({ roomId: room.id, slotIndex: k, key, tint: ROOM_TINTS[ri % ROOM_TINTS.length] });
    }
  });
  grid.columns = cols as never;

  const cell = new Map<string, string>();
  for (const a of result.assignments) {
    cell.set(`${a.date}|${a.shiftId}|${a.roomId}|${a.slotIndex}`, personName.get(a.personId) ?? "?");
  }
  const dates = Array.from(new Set(input.dutyDates)).sort();
  for (const date of dates) {
    for (const shift of input.shifts) {
      const row: Record<string, string> = { date, shift: shiftById.get(shift.id)?.name ?? shift.id };
      for (const sc of slotCols) row[sc.key] = cell.get(`${date}|${shift.id}|${sc.roomId}|${sc.slotIndex}`) ?? "";
      const added = grid.addRow(row);
      slotCols.forEach((sc, idx) => {
        added.getCell(idx + 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: sc.tint } };
      });
    }
  }
  grid.getRow(1).font = { bold: true };

  // -------- Sheet 2: per-person room balance --------
  const fair = wb.addWorksheet(tr ? "Oda Dağılımı" : "Room Balance");
  fair.addRow([
    tr ? "Kişi" : "Person",
    ...input.rooms.map((r) => r.name),
    tr ? "Toplam" : "Total",
    tr ? "Zor kişiyle" : "With difficult",
    tr ? "Gece" : "Nights",
  ]).font = { bold: true };
  for (const s of result.report.perPerson) {
    fair.addRow([
      s.name,
      ...input.rooms.map((r) => s.roomCount[r.id] ?? 0),
      s.load,
      s.difficultExposure,
      s.nightCount,
    ]);
  }
  const tg = result.report.targets;
  fair.addRow([
    tr ? "HEDEF" : "TARGET",
    ...input.rooms.map((r) => Number((tg.room[r.id] ?? 0).toFixed(2))),
    Number(tg.load.toFixed(2)),
    Number(tg.exposure.toFixed(2)),
    "",
  ]).font = { italic: true };
  fair.columns.forEach((c) => (c.width = 14));

  // -------- Sheet 3: summary --------
  const sum = wb.addWorksheet(tr ? "Özet" : "Summary");
  const rep = result.report;
  sum.addRow([tr ? "doc_scheduler — Özet" : "doc_scheduler — Summary"]).font = { bold: true, size: 14 };
  const rows: [string, string | number][] = [
    [tr ? "Adalet puanı" : "Fairness score", `${rep.fairnessScore}/100`],
    [tr ? "Uygun" : "Feasible", rep.feasible ? (tr ? "Evet" : "Yes") : tr ? "Hayır" : "No"],
    [tr ? "Oda farkı (maks-min)" : "Room spread", rep.spreads.roomMax],
    [tr ? "Yük farkı" : "Load spread", rep.spreads.load],
    [tr ? "Zor-kişi farkı" : "Difficult-colleague spread", rep.spreads.exposure],
    [tr ? "Yalnız-kalmasın ihlali" : "Never-alone breaches", rep.neverAloneViolations],
    [tr ? "Tohum (seed)" : "Seed", result.seed],
  ];
  for (const r of rows) sum.addRow(r);
  if (rep.infeasibilities.length) {
    sum.addRow([]);
    sum.addRow([tr ? "Sorunlar" : "Issues"]).font = { bold: true };
    for (const m of rep.infeasibilities) sum.addRow([m]);
  }
  sum.getColumn(1).width = 34;
  sum.getColumn(2).width = 40;

  return wb.xlsx.writeBuffer();
}

/** Builds the workbook and triggers a browser download (no external deps). */
export async function downloadScheduleXlsx(
  input: ScheduleInput,
  result: SolveResult,
  locale: Locale = "tr",
): Promise<void> {
  const buf = await buildScheduleBuffer(input, result, locale);
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "doc_scheduler.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
