export function evaluateMath(expr: string): number | null {
  const cleaned = expr.trim();
  if (!cleaned) return null;

  const tokens = tokenize(cleaned);
  if (!tokens) return null;

  try {
    const result = parseExpression(tokens, 0);
    if (result === null || tokens.pos < tokens.tokens.length) return null;
    return result.value;
  } catch {
    return null;
  }
}

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" };

function tokenize(s: string): { tokens: Token[]; pos: number } | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === " ") { i++; continue; }
    if (s[i] >= "0" && s[i] <= "9" || s[i] === ".") {
      let num = "";
      while (i < s.length && (s[i] >= "0" && s[i] <= "9" || s[i] === ".")) { num += s[i]; i++; }
      const n = Number(num);
      if (isNaN(n)) return null;
      tokens.push({ type: "num", value: n });
    } else if ("+-*/".includes(s[i])) {
      tokens.push({ type: "op", value: s[i] });
      i++;
    } else if (s[i] === "(" || s[i] === ")") {
      tokens.push({ type: "paren", value: s[i] as "(" | ")" });
      i++;
    } else {
      return null;
    }
  }
  return { tokens, pos: 0 };
}

function parseExpression(t: { tokens: Token[]; pos: number }, minPrec: number): { value: number } | null {
  let left = parseAtom(t);
  if (!left) return null;

  while (t.pos < t.tokens.length) {
    const tok = t.tokens[t.pos];
    if (tok.type !== "op") break;
    const prec = precidence(tok.value);
    if (prec < minPrec) break;
    t.pos++;
    const right = parseExpression(t, prec + 1);
    if (!right) return null;
    switch (tok.value) {
      case "+": left = { value: left.value + right.value }; break;
      case "-": left = { value: left.value - right.value }; break;
      case "*": left = { value: left.value * right.value }; break;
      case "/":
        if (right.value === 0) return null;
        left = { value: left.value / right.value };
        break;
    }
  }
  return left;
}

function parseAtom(t: { tokens: Token[]; pos: number }): { value: number } | null {
  if (t.pos >= t.tokens.length) return null;
  const tok = t.tokens[t.pos];
  if (tok.type === "num") {
    t.pos++;
    return { value: tok.value };
  }
  if (tok.type === "paren" && tok.value === "(") {
    t.pos++;
    const expr = parseExpression(t, 0);
    if (!expr) return null;
    if (t.pos >= t.tokens.length || t.tokens[t.pos].type !== "paren" || t.tokens[t.pos].value !== ")") return null;
    t.pos++;
    return expr;
  }
  return null;
}

function precidence(op: string): number {
  if (op === "+" || op === "-") return 1;
  if (op === "*" || op === "/") return 2;
  return 0;
}
