import { describe, it, expect } from "vitest";
import { extractPdfText } from "@/lib/study-material";

describe("extractPdfText", () => {
  it("should successfully extract text from a valid PDF buffer", async () => {
    // A minimal valid PDF file structure in bytes:
    const minimalPdf = Buffer.from(
      "%PDF-1.4\n" +
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>\nendobj\n" +
      "4 0 obj\n<< /Length 44 >>\nstream\n" +
      "BT\n/F1 12 Tf\n72 712 Td\n(Hello World) Tj\nET\n" +
      "endstream\nendobj\n" +
      "xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000224 00000 n\n" +
      "trailer\n<< /Size 5 /Root 1 0 R >>\n" +
      "startxref\n319\n%%EOF"
    );

    const text = await extractPdfText(minimalPdf);
    expect(text).toContain("Hello World");
  });
});
