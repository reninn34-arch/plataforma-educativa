import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCSV } from "@/lib/csv-utils";

vi.mock("@/lib/hash-utils", () => ({
  hashPin: () => Promise.resolve("$2a$10$mockedHashValue"),
  comparePin: () => Promise.resolve(true),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: vi.fn(),
  getVerifiedUser: vi.fn(),
}));

import { db } from "@/lib/db";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

function createMockRequest({
  body,
  token,
}: {
  body?: FormData;
  token?: string;
}) {
  return {
    method: "POST",
    headers: { get: () => null, forEach: () => {} },
    cookies: {
      get: (name: string) =>
        name === "atlas-edu-token" && token ? { value: token } : undefined,
    },
    formData: vi.fn().mockResolvedValue(body || new FormData()),
    nextUrl: new URL("http://localhost:3000/api/admin/users/bulk"),
  } as unknown as Request;
}

function createMockFile(content: string): File {
  return new File([content], "test.csv", { type: "text/csv" });
}

describe("POST /api/admin/users/bulk", () => {
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;

  function makeThenable<T>(value: T) {
    return { then: (resolve: (v: T) => void) => Promise.resolve(resolve(value)) };
  }

  function makeChain(existingUsers: Record<string, unknown>[] = []) {
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: (resolve: ((v: Record<string, unknown>[]) => Record<string, unknown>[]) | undefined) => Promise.resolve(resolve ? resolve(existingUsers) : existingUsers),
    };
    return chain;
  }

  function setupDbMocks(existingUsers: Record<string, unknown>[] = []) {
    mockSelect = vi.fn().mockReturnValue(makeChain(existingUsers));
    const insertResult = makeThenable(undefined);
    mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue(insertResult),
    });
    const updateResult = makeThenable(undefined);
    mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(updateResult),
    });

    (db.select as unknown as vi.Mock).mockImplementation(mockSelect);
    (db.insert as unknown as vi.Mock).mockImplementation(mockInsert);
    (db.update as unknown as vi.Mock).mockImplementation(mockUpdate);
    (db.transaction as unknown as vi.Mock).mockImplementation(async (cb: () => void) => {
      await cb({
        insert: () => ({
          values: () => makeThenable(undefined),
        }),
        update: () => ({
          set: () => ({
            where: () => makeThenable(undefined),
          }),
        }),
      });
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMocks();
    (getVerifiedUser as unknown as vi.Mock).mockReturnValue({ id: 1, role: "admin" });
  });

  it("rejects request without auth", async () => {
    (getVerifiedUser as unknown as vi.Mock).mockReturnValue(null);
    (verifyToken as unknown as vi.Mock).mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const res = await POST(createMockRequest({}));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Solo admin");
  });

  it("rejects request without file", async () => {
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const res = await POST(createMockRequest({ token: "valid" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("No se recibio ningun archivo");
  });

  it("rejects file larger than 5MB", async () => {
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    fd.append("file", createMockFile("x".repeat(6 * 1024 * 1024)));
    const res = await POST(createMockRequest({ body: fd, token: "valid" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("5MB");
  });

  it("rejects CSV without header row", async () => {
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    fd.append("file", createMockFile(""));
    const res = await POST(createMockRequest({ body: fd, token: "valid" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("al menos una fila");
  });

  it("rejects CSV without required columns", async () => {
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    fd.append("file", createMockFile("nombre,email\nJuan,juan@test.com"));
    const res = await POST(createMockRequest({ body: fd, token: "valid" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Cedula");
  });

  it("rejects CSV with more than 500 data rows", async () => {
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    let csv = "cedula,nombre\n";
    for (let i = 0; i < 501; i++) csv += `${1000000000 + i},Usuario ${i}\n`;
    fd.append("file", createMockFile(csv));
    const res = await POST(createMockRequest({ body: fd, token: "valid" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("500");
  });

  it("creates new users from CSV", async () => {
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    fd.append("file", createMockFile("cedula,nombre\n1712345678,Juan Perez\n1798765432,Ana Lopez"));
    const res = await POST(createMockRequest({ body: fd, token: "valid" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.creados).toBe(2);
    expect(data.total).toBe(2);
    expect(data.resultados[0].status).toBe("creado");
    expect(data.resultados[0].pin).toMatch(/^\d{4}$/);
  }, 10000);

  it("omits existing active users", async () => {
    setupDbMocks([{ id: 1, cedula: "1712345678", activo: true }]);
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    fd.append("file", createMockFile("cedula,nombre\n1712345678,Juan Perez\n1798765432,Ana Lopez"));
    const res = await POST(createMockRequest({ body: fd, token: "valid" }));
    const data = await res.json();

    expect(data.omitidos).toBe(1);
    expect(data.creados).toBe(1);
    expect(data.resultados[0].status).toBe("omitido");
    expect(data.resultados[1].status).toBe("creado");
  }, 10000);

  it("reactivates inactive existing users", async () => {
    setupDbMocks([{ id: 1, cedula: "1712345678", activo: false }]);
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    fd.append("file", createMockFile("cedula,nombre\n1712345678,Juan Perez"));
    const res = await POST(createMockRequest({ body: fd, token: "valid" }));
    const data = await res.json();

    expect(data.reactivados).toBe(1);
    expect(data.resultados[0].status).toBe("reactivado");
  }, 10000);

  it("reports errors for invalid rows", async () => {
    setupDbMocks([]);
    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    fd.append("file", createMockFile("cedula,nombre\n12345,Juan\n,Ana\n1798765432,Ana Lopez"));
    const res = await POST(createMockRequest({ body: fd, token: "valid" }));
    const data = await res.json();

    expect(data.errores).toBe(2);
    expect(data.creados).toBe(1);
    expect(data.resultados[0].status).toBe("error");
    expect(data.resultados[1].status).toBe("error");
    expect(data.resultados[2].status).toBe("creado");
  }, 10000);

  it("uses database transaction", async () => {
    setupDbMocks([]);
    const transactionSpy = vi.fn(async (cb: () => void) => {
      await cb({
        insert: () => ({
          values: () => makeThenable(undefined),
        }),
        update: () => ({
          set: () => ({
            where: () => makeThenable(undefined),
          }),
        }),
      });
    });
    (db.transaction as unknown as vi.Mock).mockImplementation(transactionSpy);

    const { POST } = await import("@/app/api/admin/users/bulk/route");
    const fd = new FormData();
    fd.append("file", createMockFile("cedula,nombre\n1712345678,Juan Perez"));
    await POST(createMockRequest({ body: fd, token: "valid" }));

    expect(transactionSpy).toHaveBeenCalledOnce();
  }, 10000);
});

describe("parseCSV", () => {
  it("handles semicolon delimiters", () => {
    const result = parseCSV("cedula;nombre;email\n1712345678;Juan;juan@test.com");
    expect(result).toHaveLength(2);
    expect(result[1][1]).toBe("Juan");
  });

  it("handles CSV with only header and BOM", () => {
    const result = parseCSV("\uFEFFcedula,nombre");
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe("cedula");
  });
});
