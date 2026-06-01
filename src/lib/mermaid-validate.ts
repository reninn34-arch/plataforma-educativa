/**
 * Quick validation for Mermaid syntax before rendering.
 * Returns true if the diagram looks syntactically valid.
 */
export function isValidMermaid(code: string): boolean {
  if (!code || typeof code !== "string") return false;

  const trimmed = code.trim();

  // Must start with graph declaration
  if (!/^graph\s+(TD|LR|TB|RL)/i.test(trimmed)) return false;

  // Must have at least one arrow connection
  if (!/-->\|?[^|]*\|?/.test(trimmed)) return false;

  // Count brackets — must be balanced
  const openSquare = (trimmed.match(/\[/g) || []).length;
  const closeSquare = (trimmed.match(/\]/g) || []).length;
  if (openSquare !== closeSquare) return false;

  const openParen = (trimmed.match(/\(/g) || []).length;
  const closeParen = (trimmed.match(/\)/g) || []).length;
  if (openParen !== closeParen) return false;

  // Must not contain problematic characters sequence
  if (/["\u201C\u201D]/.test(trimmed)) return false;

  return true;
}
