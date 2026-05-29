import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";
import {
  loginSchema,
  practiceGenerateSchema,
  practiceCheckSchema,
  assignmentSchema,
  messageSchema,
  studyMaterialSchema,
} from "@/lib/api-helpers";

describe("rateLimit", () => {
  beforeEach(() => {
    rateLimit({ key: "test", maxRequests: 1, windowMs: 100 });
    rateLimit({ key: "test2", maxRequests: 2, windowMs: 5000 });
  });

  it("allows requests within limit", () => {
    const result = rateLimit({ key: "rl_test_1", maxRequests: 3 });
    expect(result).toBeNull();
  });

  it("blocks requests exceeding limit", () => {
    const key = "rl_test_block";
    rateLimit({ key, maxRequests: 1 });
    rateLimit({ key, maxRequests: 1 });
    const result = rateLimit({ key, maxRequests: 1 });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("returns Retry-After header", () => {
    const key = "rl_test_retry";
    rateLimit({ key, maxRequests: 1 });
    rateLimit({ key, maxRequests: 1 });
    const result = rateLimit({ key, maxRequests: 1 });
    expect(result!.headers.get("Retry-After")).toBeTruthy();
  });

  it("resets window after time passes", async () => {
    const key = "rl_test_reset";
    rateLimit({ key, maxRequests: 1, windowMs: 50 });
    rateLimit({ key, maxRequests: 1, windowMs: 50 });
    const blocked = rateLimit({ key, maxRequests: 1, windowMs: 50 });
    expect(blocked).not.toBeNull();

    await new Promise((r) => setTimeout(r, 60));

    const allowed = rateLimit({ key, maxRequests: 1, windowMs: 50 });
    expect(allowed).toBeNull();
  });

  it("uses different windows for different keys", () => {
    const key1 = "rl_key_1";
    const key2 = "rl_key_2";

    rateLimit({ key: key1, maxRequests: 1 });
    rateLimit({ key: key1, maxRequests: 1 });
    const blocked1 = rateLimit({ key: key1, maxRequests: 1 });
    expect(blocked1).not.toBeNull();

    const allowed2 = rateLimit({ key: key2, maxRequests: 5 });
    expect(allowed2).toBeNull();
  });
});

describe("validation schemas", () => {
  describe("loginSchema", () => {
    it("accepts valid cedula and PIN", () => {
      const result = loginSchema.safeParse({ cedula: "1234567890", pin: "1234" });
      expect(result.success).toBe(true);
    });

    it("rejects cedula with wrong length", () => {
      const result = loginSchema.safeParse({ cedula: "12345", pin: "1234" });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric cedula", () => {
      const result = loginSchema.safeParse({ cedula: "abcdefghij", pin: "1234" });
      expect(result.success).toBe(false);
    });

    it("rejects PIN with wrong length", () => {
      const result = loginSchema.safeParse({ cedula: "1234567890", pin: "12" });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric PIN", () => {
      const result = loginSchema.safeParse({ cedula: "1234567890", pin: "abcd" });
      expect(result.success).toBe(false);
    });
  });

  describe("assignmentSchema", () => {
    it("accepts valid assignment", () => {
      const result = assignmentSchema.safeParse({
        title: "Tarea 1",
        description: "Descripcion",
        subjectId: 1,
        dueDate: "2025-12-31T23:59:59Z",
        trimester: 1,
        questions: [
          { type: "mcq", question: "Pregunta 1", options: ["A", "B", "C"], correctIndex: 0 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects assignment without title", () => {
      const result = assignmentSchema.safeParse({
        description: "Desc",
        subjectId: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("practiceGenerateSchema", () => {
    it("accepts valid practice generation request", () => {
      const result = practiceGenerateSchema.safeParse({
        subject: "matematicas",
        topic: "algebra",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty subject", () => {
      const result = practiceGenerateSchema.safeParse({ subject: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("practiceCheckSchema", () => {
    it("accepts valid MCQ answer check", () => {
      const result = practiceCheckSchema.safeParse({
        question: "2+2?",
        type: "mcq",
        studentAnswer: 0,
        correctAnswer: 0,
        options: ["4", "5", "6"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts fill_blank answer check", () => {
      const result = practiceCheckSchema.safeParse({
        question: "El resultado de 2+2 es ___",
        type: "fill_blank",
        studentAnswer: "4",
        correctAnswer: "4",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid question type", () => {
      const result = practiceCheckSchema.safeParse({
        question: "test",
        type: "essay",
        studentAnswer: "answer",
        correctAnswer: "answer",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("messageSchema", () => {
    it("accepts valid message", () => {
      const result = messageSchema.safeParse({ receiverId: 1, content: "Hola" });
      expect(result.success).toBe(true);
    });

    it("rejects empty message", () => {
      const result = messageSchema.safeParse({ receiverId: 1, content: "" });
      expect(result.success).toBe(false);
    });

    it("rejects negative receiverId", () => {
      const result = messageSchema.safeParse({ receiverId: -1, content: "Hola" });
      expect(result.success).toBe(false);
    });
  });

  describe("studyMaterialSchema", () => {
    it("accepts valid request", () => {
      const result = studyMaterialSchema.safeParse({ subject: "matematicas" });
      expect(result.success).toBe(true);
    });

    it("accepts request with topic", () => {
      const result = studyMaterialSchema.safeParse({ subject: "fisica", topic: "newton" });
      expect(result.success).toBe(true);
    });
  });
});
