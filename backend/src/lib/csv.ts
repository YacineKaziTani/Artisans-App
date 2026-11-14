/**
 * Minimal RFC 4180 CSV: quoted fields, "" escapes, commas and line breaks
 * inside quotes, CRLF or LF rows. Enough for spreadsheets exported from
 * Excel, Numbers or Google Sheets.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  // Excel adds a byte-order mark to UTF-8 exports.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines (often a trailing newline) aren't rows.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * One CSV cell. A leading = + - @ (or tab/CR) would make Excel/Sheets run
 * the cell as a formula, so those get a ' prefix and stay plain text.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n']/.test(safe) || safe !== text ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n") + "\r\n";
}
