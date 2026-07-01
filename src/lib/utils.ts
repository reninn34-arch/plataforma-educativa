import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNotation(text: string): string {
  if (!text) return text;
  let result = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Subscript notation: H_2O, CO_2 (underscore prefix)
  result = result.replace(/_(\{?)(\d+)(\}?)/g, '<sub>$2</sub>');

  // Superscript notation: x^2, 10^{-3}, H^+, cm^3 (caret prefix)
  result = result.replace(/\^(\{?)([+\-]?\d*[+\-]?)(\}?)/g, (_, __, content) => {
    if (!content) return _;
    return `<sup>${content}</sup>`;
  });

  // Charges after elements: Fe3+, SO4 2-, O2- (skip if already inside <sup>)
  result = result.replace(/(\d+)([+\-])/g, (match, num, sign, offset) => {
    if (offset > 0 && result[offset - 1] === ">") return match;
    return `<sup>${num}${sign}</sup>`;
  });

  // Chemical element subscripts: H2 → H₂, Fe2O3 → Fe₂O₃ (skip if already tagged)
  result = result.replace(/([A-Z][a-z]?)(\d+)/g, (match, el, num, offset) => {
    if (offset > 0 && result[offset - 1] === ">") return match;
    if (match.includes("<sup>") || match.includes("<sub>")) return match;
    return `${el}<sub>${num}</sub>`;
  });

  // Number-only subscripts after parentheses: (OH)2 → (OH)₂
  result = result.replace(/(\))(\d+)/g, '$1<sub>$2</sub>');

  // Arrow symbols
  result = result.replace(/-->/g, "→");
  result = result.replace(/<->/g, "⇌");
  result = result.replace(/->/g, "→");

  return result;
}

