"use client";

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? match[1] : null;
}

export function clearCache(pattern?: RegExp) {
  if (!pattern) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (pattern.test(key)) cache.delete(key);
  }
}

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  const isStateChanging = options.method && ["POST", "PUT", "DELETE", "PATCH"].includes(options.method.toUpperCase());

  if (isStateChanging) {
    const csrf = getCsrfToken();
    if (csrf) headers.set("x-csrf-token", csrf);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const isGet = !options.method || options.method === "GET";
  const cacheKey = `GET:${url}`;

  if (isGet) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return new Response(JSON.stringify(cached.data), {
        headers: { "Content-Type": "application/json" },
      });
    }
    cache.delete(cacheKey);

    const pending = inflight.get(cacheKey);
    if (pending) {
      const data = await pending;
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const promise = (async () => {
    const res = await fetch(url, { ...options, headers, credentials: "include" });
    if (isGet && res.ok) {
      const clone = res.clone();
      const data = await clone.json();
      cache.set(cacheKey, { data, expiresAt: Date.now() + 30_000 });
      return data;
    }
    if (isStateChanging && res.ok) {
      cache.clear();
    }
    return res;
  })();

  if (isGet) {
    inflight.set(cacheKey, promise);
    promise.then(() => inflight.delete(cacheKey)).catch(() => inflight.delete(cacheKey));
    const data = await promise;
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return promise as Promise<Response>;
}
