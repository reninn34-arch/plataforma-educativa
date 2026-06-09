import { describe, it, expect } from "vitest";
import { createToken, verifyToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

describe("createToken", () => {
  it("generates a valid JWT with correct payload", async () => {
    const user = {
      id: 1,
      cedula: "1234567890",
      fullName: "Test User",
      role: "student" as const,
    };

    const token = await createToken(user);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("creates tokens that can be verified", async () => {
    const user = {
      id: 42,
      cedula: "0987654321",
      fullName: "Jane Doe",
      role: "teacher" as const,
    };

    const token = await createToken(user);
    const decoded = await verifyToken(token);

    expect(decoded).toBeTruthy();
    expect(decoded!.id).toBe(42);
    expect(decoded!.cedula).toBe("0987654321");
    expect(decoded!.fullName).toBe("Jane Doe");
    expect(decoded!.role).toBe("teacher");
  });

  it("creates tokens with custom expiry", async () => {
    const user = {
      id: 1,
      cedula: "1234567890",
      fullName: "Test",
      role: "student" as const,
    };

    const shortToken = await createToken(user, "1s");
    const decoded = await verifyToken(shortToken);
    expect(decoded).toBeTruthy();

    await new Promise((r) => setTimeout(r, 1100));
    const expired = await verifyToken(shortToken);
    expect(expired).toBeNull();
  }, 5000);

  it("creates tokens for all roles", async () => {
    const roles = ["student", "teacher", "admin"] as const;

    for (const role of roles) {
      const user = { id: 1, cedula: "1234567890", fullName: "Test", role };
      const token = await createToken(user);
      const decoded = await verifyToken(token);
      expect(decoded!.role).toBe(role);
    }
  });
});

describe("verifyToken", () => {
  it("returns null for an empty token", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });

  it("returns null for a malformed token", async () => {
    const result = await verifyToken("not-a-jwt");
    expect(result).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const user = {
      id: 1,
      cedula: "1234567890",
      fullName: "Test",
      role: "student" as const,
    };
    const token = await createToken(user);
    const tampered = token.slice(0, -5) + "xxxxx";

    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  it("returns null for a token with invalid signature", async () => {
    const parts = (await createToken({ id: 1, cedula: "1234567890", fullName: "Test", role: "student" as const })).split(".");
    parts[2] = "invalid_signature_here_xxxxxxxxxxxxxxxxxxxxxxx";

    const result = await verifyToken(parts.join("."));
    expect(result).toBeNull();
  });
});

describe("bcrypt PIN hashing", () => {
  it("hashes and compares PINs correctly", async () => {
    const pin = "1234";
    const hash = await bcrypt.hash(pin, 10);

    expect(hash).not.toBe(pin);
    expect(hash).toHaveLength(60);

    const match = await bcrypt.compare(pin, hash);
    expect(match).toBe(true);

    const noMatch = await bcrypt.compare("0000", hash);
    expect(noMatch).toBe(false);
  });

  it("generates different hashes for the same PIN", async () => {
    const pin = "5678";
    const hash1 = await bcrypt.hash(pin, 10);
    const hash2 = await bcrypt.hash(pin, 10);

    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare(pin, hash1)).toBe(true);
    expect(await bcrypt.compare(pin, hash2)).toBe(true);
  });
});
