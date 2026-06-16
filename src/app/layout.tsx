/**
 * Agregar un nuevo color de énfasis:
 * 1. Editar src/lib/accent-colors.ts (fuente única)
 * 2. Agregar las variables CSS en :root y .dark en globals.css
 */
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { COLOR_PALETTES, type AccentColorKey } from "@/lib/accent-colors";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas Edu",
  description: "Plataforma educativa acelerada para adultos - PCEI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Atlas Edu",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B3A5C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value || "light";
  const accent = (cookieStore.get("accent-color")?.value || "indigo") as AccentColorKey;
  const palette = COLOR_PALETTES[accent] || COLOR_PALETTES.indigo;
  const isDark = theme === "dark";
  const values = isDark ? palette.dark : palette.light;

  const vars = `
    --primary: ${values.primary};
    --ring: ${values.primary};
    --sidebar-primary: ${values.primary};
    --logo-gradient-from: ${values.logoFrom};
    --logo-gradient-to: ${values.logoTo};
    --logo-text-gradient-from: ${values.logoTextFrom};
    --logo-text-gradient-to: ${values.logoTextTo};
    --active-link-bg: ${values.activeBg};
    --active-link-text: ${values.activeText};
    --active-link-border: ${values.activeBorder};
    --active-link-icon: ${values.activeIcon};
    --active-link-dot: ${values.activeDot};
    --hero-gradient-from: ${values.heroFrom};
    --hero-gradient-via: ${values.heroVia};
    --hero-gradient-to: ${values.heroTo};
    --accent-card-from: ${values.accentFrom};
    --accent-card-to: ${values.accentTo};
    --tutor-gradient-from: ${values.tutorFrom};
    --tutor-gradient-to: ${values.tutorTo};
  `;

  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth" className={isDark ? "dark" : ""}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{vars}</style>
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <TooltipProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
