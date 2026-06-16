"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { COLOR_PALETTES, type AccentColorKey } from "@/lib/accent-colors";

function AccentColorInitializer() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const updateAccent = () => {
      let accent = "";
      const cookiesList = document.cookie.split(";");
      for (let i = 0; i < cookiesList.length; i++) {
        const parts = cookiesList[i].trim().split("=");
        if (parts[0] === "accent-color") {
          accent = parts[1];
          break;
        }
      }

      if (!accent) {
        let role = "student";
        if (pathname.startsWith("/admin")) role = "admin";
        else if (pathname.startsWith("/teacher")) role = "teacher";
        accent = localStorage.getItem("accent-color-" + role) || "indigo";
      }

      const storedColor = accent as AccentColorKey;
      const palette = COLOR_PALETTES[storedColor] || COLOR_PALETTES.indigo;
      const isDark = resolvedTheme === "dark";
      const values = isDark ? palette.dark : palette.light;

      document.documentElement.style.setProperty("--primary", values.primary);
      document.documentElement.style.setProperty("--ring", values.primary);
      document.documentElement.style.setProperty("--sidebar-primary", values.primary);

      // Set all the extra logo/highlight properties
      document.documentElement.style.setProperty("--logo-gradient-from", values.logoFrom);
      document.documentElement.style.setProperty("--logo-gradient-to", values.logoTo);
      document.documentElement.style.setProperty("--logo-text-gradient-from", values.logoTextFrom);
      document.documentElement.style.setProperty("--logo-text-gradient-to", values.logoTextTo);
      document.documentElement.style.setProperty("--active-link-bg", values.activeBg);
      document.documentElement.style.setProperty("--active-link-text", values.activeText);
      document.documentElement.style.setProperty("--active-link-border", values.activeBorder);
      document.documentElement.style.setProperty("--active-link-icon", values.activeIcon);
      document.documentElement.style.setProperty("--active-link-dot", values.activeDot);

      // Card gradient variables
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
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      storageKey="theme"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AccentColorInitializer />
      {children}
    </NextThemesProvider>
  );
}