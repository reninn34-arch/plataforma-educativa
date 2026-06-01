"use client";

import { createContext, useContext, type ReactNode } from "react";

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

export function UserProvider({ children, profile }: { children: ReactNode; profile: UserProfile | null }) {
  return <UserContext.Provider value={{ profile, loading: false }}>{children}</UserContext.Provider>;
}

export function useUserProfile() { return useContext(UserContext); }
export function useTeacherCourses() { return useContext(UserContext); }