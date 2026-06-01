"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { dedupFetch } from "@/lib/api-cache";

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

const UserContext = createContext<{
  profile: UserProfile | null;
  loading: boolean;
}>({ profile: null, loading: true });

const TeacherCoursesContext = createContext<{
  cursos: CursoOption[];
  loading: boolean;
}>({ cursos: [], loading: true });

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dedupFetch<UserProfile>("/api/user/profile")
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ profile, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function TeacherCoursesProvider({ children }: { children: ReactNode }) {
  const [cursos, setCursos] = useState<CursoOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dedupFetch<{ cursos: CursoOption[] }>("/api/teacher/courses")
      .then(d => setCursos(d.cursos ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <TeacherCoursesContext.Provider value={{ cursos, loading }}>
      {children}
    </TeacherCoursesContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserContext);
}

export function useTeacherCourses() {
  return useContext(TeacherCoursesContext);
}
