export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === "," || ch === ";") {
        current.push(cell.trim());
        cell = "";
      } else if (ch === "\n") {
        current.push(cell.trim());
        if (current.some(c => c !== "")) {
          rows.push(current);
        }
        current = [];
        cell = "";
      } else if (ch === "\r") {
        continue;
      } else {
        cell += ch;
      }
    }
  }
  if (cell) current.push(cell.trim());
  if (current.some(c => c !== "")) rows.push(current);

  return rows;
}
