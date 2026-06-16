"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { COLOR_PALETTES, type AccentColorKey } from "@/lib/accent-colors";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function AccentColorInitializer() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const updateAccent = () => {
      const isDark = resolvedTheme === "dark";

      // Read resolved accent color from the server-rendered html data attribute
      let accent = document.documentElement.getAttribute("data-accent") || "";

      if (!accent) {
        let role = "student";
        if (pathname.startsWith("/admin")) role = "admin";
        else if (pathname.startsWith("/teacher")) role = "teacher";
        accent = localStorage.getItem("accent-color-" + role) || "indigo";
      }

      const storedColor = accent as AccentColorKey;
      const palette = COLOR_PALETTES[storedColor] || COLOR_PALETTES.indigo;
      const values = isDark ? palette.dark : palette.light;

      if (!document.documentElement.getAttribute("data-accent")) {
        document.documentElement.setAttribute("data-accent", storedColor);
      }

      document.documentElement.style.setProperty("--primary", values.primary);
      document.documentElement.style.setProperty("--ring", values.primary);
      document.documentElement.style.setProperty("--sidebar-primary", values.primary);

      document.documentElement.style.setProperty("--logo-gradient-from", values.logoFrom);
      document.documentElement.style.setProperty("--logo-gradient-to", values.logoTo);
      document.documentElement.style.setProperty("--logo-text-gradient-from", values.logoTextFrom);
      document.documentElement.style.setProperty("--logo-text-gradient-to", values.logoTextTo);
      document.documentElement.style.setProperty("--active-link-bg", values.activeBg);
      document.documentElement.style.setProperty("--active-link-text", values.activeText);
      document.documentElement.style.setProperty("--active-link-border", values.activeBorder);
      document.documentElement.style.setProperty("--active-link-icon", values.activeIcon);
      document.documentElement.style.setProperty("--active-link-dot", values.activeDot);

      document.documentElement.style.setProperty("--hero-gradient-from", values.heroFrom);
      document.documentElement.style.setProperty("--hero-gradient-via", values.heroVia);
      document.documentElement.style.setProperty("--hero-gradient-to", values.heroTo);
      document.documentElement.style.setProperty("--accent-card-from", values.accentFrom);
      document.documentElement.style.setProperty("--accent-card-to", values.accentTo);
      document.documentElement.style.setProperty("--tutor-gradient-from", values.tutorFrom);
      document.documentElement.style.setProperty("--tutor-gradient-to", values.tutorTo);
    };

    updateAccent();

    window.addEventListener("accent-color-change", updateAccent);
    window.addEventListener("storage", updateAccent);

    return () => {
      window.removeEventListener("accent-color-change", updateAccent);
      window.removeEventListener("storage", updateAccent);
    };
  }, [resolvedTheme, pathname]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("theme", theme);
    document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>
      {mounted && <AccentColorInitializer />}
      {children}
    </ThemeContext.Provider>
  );
}
