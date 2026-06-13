import { describe, it, expect, vi } from "vitest";
import { extractPdfText } from "@/lib/study-material";

vi.mock("pdf-parse", () => ({
  PDFParse: class MockPDFParse {
    data: Buffer;
    constructor({ data }: { data: Buffer }) { this.data = data; }
    getText() { return Promise.resolve({ text: this.data.toString() }); }
    destroy() { return Promise.resolve(); }
  },
}));

describe("extractPdfText", () => {
  it("should extract text from a PDF buffer", async () => {
    const pdfBuffer = Buffer.from("Hello World");
    const text = await extractPdfText(pdfBuffer);
    expect(text).toBe("Hello World");
  });
});
