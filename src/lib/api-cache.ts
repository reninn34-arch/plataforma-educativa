"use client";

import { apiFetch, clearCache as clearFetchCache } from "@/lib/fetch-utils";

export async function dedupFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function clearCache(pattern?: RegExp) {
  clearFetchCache(pattern);
}
