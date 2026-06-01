"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./fetch-utils";

export function useApiQuery<T>(
  key: string,
  url: string,
  options?: {
    staleTime?: number;
    enabled?: boolean;
  }
) {
  return useQuery<T, Error>({
    queryKey: [key],
    queryFn: async () => {
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json() as Promise<T>;
    },
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}