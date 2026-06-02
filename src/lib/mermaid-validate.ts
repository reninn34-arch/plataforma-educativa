export function isValidMermaid(code: string): boolean {
  if (!code || typeof code !== "string") return false;

  let cleaned = code.trim();
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  cleaned = cleaned.trim();

  if (!/^graph\s+(TD|LR|TB|RL)/i.test(cleaned)) return false;
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
