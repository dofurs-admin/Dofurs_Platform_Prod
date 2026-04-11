/**
 * Exports data as a CSV file download in the browser.
 *
 * @param filename - File name without extension (e.g. "bookings-export")
 * @param headers - Column header labels (in order)
 * @param rows    - Each row as an array of values matching headers
 */
export function exportToCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  function escapeCell(value: string | number | null | undefined): string {
    const str = value == null ? '' : String(value);
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const lines: string[] = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
