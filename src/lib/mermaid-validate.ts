export function isValidMermaid(code: string): boolean {
  if (!code || typeof code !== "string") return false;

  let cleaned = code.trim();
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  cleaned = cleaned.trim();

  // Accept both graph and flowchart syntax
  if (!/^(graph|flowchart)\s+(TD|LR|TB|RL)/i.test(cleaned)) return false;
  if (!/-->/.test(cleaned)) return false;

  const openSquare = (cleaned.match(/\[/g) || []).length;
  const closeSquare = (cleaned.match(/\]/g) || []).length;
  if (openSquare !== closeSquare) return false;

  const openParen = (cleaned.match(/\(/g) || []).length;
  const closeParen = (cleaned.match(/\)/g) || []).length;
  if (openParen !== closeParen) return false;

  if (/[\u201C\u201D]/.test(cleaned)) return false;

  return true;
}

export function sanitizeMermaid(code: string): string {
  let cleaned = code.trim();
  // Remove any lines starting with 'caption:' or 'caption :' case-insensitively
  cleaned = cleaned.replace(/^\s*caption\s*:.*$/gim, "");
  // Replace all semicolons with newlines to ensure compatibility with modern Mermaid (which requires newlines instead of single-line semicolons)
  cleaned = cleaned.replace(/;/g, "\n");
  // Remove consecutive newlines
  cleaned = cleaned.replace(/\n+/g, "\n");
  cleaned = cleaned.trim();

  return cleaned.replace(/([A-Za-z]\w*)\[([^\[\]]+)\]/g, (match, id, text) => {
    if (text.startsWith('"') && text.endsWith('"')) return match;
    if (/^[\wáéíóúÁÉÍÓÚñÑ\s]+$/.test(text)) return match;
    const escaped = text.replace(/"/g, '\\"');
    return `${id}["${escaped}"]`;
  });
}
