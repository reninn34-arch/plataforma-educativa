/**
 * Agregar un nuevo color de énfasis:
 * 1. Editar src/lib/accent-colors.ts (fuente única)
 * 2. Agregar las variables CSS en :root y .dark en globals.css
 */
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { COLOR_PALETTES } from "@/lib/accent-colors";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function() {
              const isDark = localStorage.getItem("theme") === "dark";
              document.documentElement.classList.toggle("dark", isDark);
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
                const path = window.location.pathname;
                let role = "student";
                if (path.indexOf("/admin") === 0) role = "admin";
                else if (path.indexOf("/teacher") === 0) role = "teacher";
                accent = localStorage.getItem("accent-color-" + role) || "indigo";
              }
              const palettes = ${JSON.stringify(COLOR_PALETTES)};
              const palette = palettes[accent] || palettes.indigo;
              const values = isDark ? palette.dark : palette.light;
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
            })();`
          }}
        />
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
