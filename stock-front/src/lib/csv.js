/**
 * Télécharge un fichier CSV lisible directement par Excel (séparateur « ; » et BOM UTF-8).
 * columns : [{ label, value: (row) => any }]
 */
export function downloadCSV(filename, rows, columns) {
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map((column) => escape(column.label)).join(";");
  const lines = rows.map((row) => columns.map((column) => escape(column.value(row))).join(";"));
  const blob = new Blob(["﻿" + [header, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
