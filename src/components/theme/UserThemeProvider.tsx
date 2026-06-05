"use client";

import { useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function UserThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("theme") || "system";
    setTheme(stored);

    const fetchUserTheme = async () => {
      try {
        const res = await fetch("/api/user/theme");
        if (res.ok) {
          const data = await res.json();
          const serverTheme = data.theme || "system";
          localStorage.setItem("theme", serverTheme);
          if (serverTheme !== stored) {
            setTheme(serverTheme);
            setKey(k => k + 1);
          }
        }
      } catch {
        // Use localStorage default
      }
    };

    fetchUserTheme();
  }, []);

  if (theme === null) {
    return <>{children}</>;
  }

  return (
    <NextThemesProvider key={key} defaultTheme={theme} attribute="class" enableSystem>
      {children}
    </NextThemesProvider>
  );
}