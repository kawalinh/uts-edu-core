// Universal Data Export Utilities (Excel-compatible UTF-8 BOM CSV, JSON, iCalendar, Print/PDF)

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T, index: number) => string | number | boolean | null | undefined;
}

function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${str}"`;
}

export function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function convertRowsToCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[]
): string {
  const headerLine = columns.map((col) => escapeCSVCell(col.header)).join(',');
  const dataLines = rows.map((row, idx) =>
    columns.map((col) => escapeCSVCell(col.accessor(row, idx))).join(',')
  );
  // Prepend UTF-8 BOM so Microsoft Excel renders Vietnamese diacritics accurately
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}

export function exportRowsToCSV<T>(
  filenameBase: string,
  columns: ExportColumn<T>[],
  rows: T[]
): void {
  const csvContent = convertRowsToCsv(rows, columns);
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(`${filenameBase}_${stamp}.csv`, csvContent, 'text/csv;charset=utf-8;');
}

export function exportRowsToJSON<T>(
  filenameBase: string,
  payload: {
    reportTitle: string;
    exportedAt?: string;
    totalRecords: number;
    records: T[];
  }
): void {
  const jsonContent = JSON.stringify(
    {
      ...payload,
      exportedAt: payload.exportedAt ?? new Date().toISOString(),
    },
    null,
    2
  );
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(`${filenameBase}_${stamp}.json`, jsonContent, 'application/json;charset=utf-8;');
}
