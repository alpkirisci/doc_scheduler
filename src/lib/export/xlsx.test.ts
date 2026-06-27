import { describe, expect, it } from "vitest";
import { buildScheduleBuffer } from "./xlsx";
import { solve } from "@/lib/scheduler/engine";
import { buildDemoInput } from "@/lib/scheduler/demo";

describe("Excel export", () => {
  it("builds a non-empty .xlsx buffer that opens as a valid workbook", async () => {
    const input = buildDemoInput();
    const result = solve(input);
    const buf = await buildScheduleBuffer(input, result, "tr");

    expect(buf.byteLength).toBeGreaterThan(2000);

    // re-open it to prove it's a real, parseable workbook with our sheets
    const mod = await import("exceljs");
    const ExcelJS = (mod as unknown as { default?: typeof import("exceljs") }).default ?? mod;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toContain("Çizelge");
    expect(names).toContain("Oda Dağılımı");
    expect(names).toContain("Özet");

    // schedule sheet should have a row per duty day + header
    const grid = wb.getWorksheet("Çizelge")!;
    expect(grid.rowCount).toBe(input.dutyDates.length + 1);
  });
});
