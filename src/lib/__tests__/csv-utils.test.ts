import { describe, it, expect } from "vitest";
import { parseCSV, generatePin } from "@/lib/csv-utils";

describe("parseCSV", () => {
  it("parses basic comma-separated CSV", () => {
    const csv = "cedula,nombre,email\n1712345678,Juan Perez,juan@test.com\n1798765432,Ana Lopez,ana@test.com";
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre", "email"],
      ["1712345678", "Juan Perez", "juan@test.com"],
      ["1798765432", "Ana Lopez", "ana@test.com"],
    ]);
  });

  it("parses semicolon-separated CSV", () => {
    const csv = "cedula;nombre;email\n1712345678;Juan Perez;juan@test.com";
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre", "email"],
      ["1712345678", "Juan Perez", "juan@test.com"],
    ]);
  });

  it("handles quoted fields", () => {
    const csv = 'cedula,nombre\n1712345678,"Perez, Juan"';
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre"],
      ["1712345678", "Perez, Juan"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    const csv = 'cedula,nombre\n1712345678,"Juan ""El Profe"" Perez"';
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre"],
      ["1712345678", 'Juan "El Profe" Perez'],
    ]);
  });

  it("strips UTF-8 BOM", () => {
    const bom = "\uFEFF";
    const csv = bom + "cedula,nombre\n1712345678,Juan";
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre"],
      ["1712345678", "Juan"],
    ]);
  });

  it("skips empty rows", () => {
    const csv = "cedula,nombre\n\n1712345678,Juan\n\n1798765432,Ana\n";
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre"],
      ["1712345678", "Juan"],
      ["1798765432", "Ana"],
    ]);
  });

  it("handles carriage return + newline (Windows line endings)", () => {
    const csv = "cedula,nombre\r\n1712345678,Juan Perez\r\n1798765432,Ana Lopez";
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre"],
      ["1712345678", "Juan Perez"],
      ["1798765432", "Ana Lopez"],
    ]);
  });

  it("handles multiline content inside quoted fields", () => {
    const csv = 'cedula,nombre,notas\n1712345678,Juan Perez,"linea1\nlinea2\nlinea3"';
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre", "notas"],
      ["1712345678", "Juan Perez", "linea1\nlinea2\nlinea3"],
    ]);
  });

  it("trims whitespace from cells", () => {
    const csv = "cedula, nombre , email \n  1712345678 , Juan Perez , juan@test.com ";
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre", "email"],
      ["1712345678", "Juan Perez", "juan@test.com"],
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCSV("")).toEqual([]);
  });

  it("returns single row for header-only CSV", () => {
    const csv = "cedula,nombre,email";
    const result = parseCSV(csv);
    expect(result).toEqual([["cedula", "nombre", "email"]]);
  });

  it("handles trailing newline", () => {
    const csv = "cedula,nombre\n1712345678,Juan\n";
    const result = parseCSV(csv);
    expect(result).toEqual([
      ["cedula", "nombre"],
      ["1712345678", "Juan"],
    ]);
  });
});

describe("generatePin", () => {
  it("generates a 4-digit string", () => {
    const pin = generatePin();
    expect(pin).toMatch(/^\d{4}$/);
  });

  it("generates different pins on subsequent calls", () => {
    const pins = new Set(Array.from({ length: 100 }, () => generatePin()));
    expect(pins.size).toBeGreaterThan(1);
  });

  it("generates pins between 1000 and 9999", () => {
    for (let i = 0; i < 100; i++) {
      const pin = parseInt(generatePin());
      expect(pin).toBeGreaterThanOrEqual(1000);
      expect(pin).toBeLessThanOrEqual(9999);
    }
  });
});
