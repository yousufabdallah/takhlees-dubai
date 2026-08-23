export type SheetSpec = {
  name: string;
  rows: (string | number | null)[][];
};

/** يصدّر ورقة/أوراق إكسل مع اتجاه من اليمين لليسار وعرض أعمدة تلقائي. */
export async function exportExcel(fileName: string, sheets: SheetSpec[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    const colCount = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
    ws["!cols"] = Array.from({ length: colCount }, (_, c) => ({
      wch: Math.min(
        34,
        Math.max(10, ...s.rows.map((r) => String(r[c] ?? "").length + 4)),
      ),
    }));
    (ws as Record<string, unknown>)["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30));
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
