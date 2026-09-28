// RFC 4180 CSV serialisation with protection against spreadsheet formula
// injection (cells starting with = + - @ tab or CR are prefixed with ').

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "string" ? value : String(value);
  // numbers (including negatives) are safe; only guard free text
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  }
  // BOM so Excel opens UTF-8 (₹, names) correctly
  return "﻿" + lines.join("\r\n") + "\r\n";
}
