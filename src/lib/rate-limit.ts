import { NextResponse } from "next/server";

const store = new Map<string, { timestamps: number[]; windowMs: number }>();

const CLEANUP_INTERVAL = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < entry.windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL);
}

export function rateLimit(opts: {
  key: string;
  maxRequests: number;
  windowMs?: number;
}): Response | null {
  const { key, maxRequests, windowMs = 60_000 } = opts;
  const now = Date.now();

  ensureCleanup();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], windowMs };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const retryAfter = Math.ceil(
      (entry.timestamps[0] + windowMs - now) / 1000
    );
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo mas tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  entry.timestamps.push(now);
  return null;
}
