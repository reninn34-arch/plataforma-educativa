"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/fetch-utils";

export interface UserProfile {
  id: number;
  fullName: string;
  cedula: string;
  role: string;
  email?: string;
}

export interface CursoOption {
  id: number;
  nombre: string;
  nivel: string;
  mySubjects: { subjectEmoji: string; subjectName: string }[];
}

const UserContext = createContext<{ profile: UserProfile | null; loading: boolean }>({ profile: null, loading: true });

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const res = await apiFetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setProfile(data);
        }
      } catch {
        // Silently fail — user may not be authenticated
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, []);

  return <UserContext.Provider value={{ profile, loading }}>{children}</UserContext.Provider>;
}

export function useUserProfile() { return useContext(UserContext); }