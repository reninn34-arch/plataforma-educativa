import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
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
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function() {
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
              const palettes = {
                indigo: {
                  light: {
                    primary: "#4F46E5", logoFrom: "#6366F1", logoTo: "#7C3AED", logoTextFrom: "#4F46E5", logoTextTo: "#7C3AED",
                    activeBg: "#EEF2FF", activeText: "#4338CA", activeBorder: "#E0E7FF", activeIcon: "#4F46E5", activeDot: "#6366F1",
                    heroFrom: "#4F46E5", heroVia: "#4F46E5", heroTo: "#7C3AED", accentFrom: "#6366F1", accentTo: "#7C3AED", tutorFrom: "#7C3AED", tutorTo: "#7E22CE"
                  },
                  dark: {
                    primary: "#818CF8", logoFrom: "#6366F1", logoTo: "#7C3AED", logoTextFrom: "#818CF8", logoTextTo: "#A78BFA",
                    activeBg: "rgba(49, 46, 129, 0.4)", activeText: "#A5B4FC", activeBorder: "#3730A3", activeIcon: "#4F46E5", activeDot: "#6366F1",
                    heroFrom: "#4F46E5", heroVia: "#4F46E5", heroTo: "#7C3AED", accentFrom: "#6366F1", accentTo: "#7C3AED", tutorFrom: "#7C3AED", tutorTo: "#7E22CE"
                  }
                },
                blue: {
                  light: {
                    primary: "#2563EB", logoFrom: "#3B82F6", logoTo: "#1D4ED8", logoTextFrom: "#2563EB", logoTextTo: "#1D4ED8",
                    activeBg: "#EFF6FF", activeText: "#1D4ED8", activeBorder: "#DBEAFE", activeIcon: "#2563EB", activeDot: "#3B82F6",
                    heroFrom: "#2563EB", heroVia: "#2563EB", heroTo: "#1D4ED8", accentFrom: "#3B82F6", accentTo: "#1D4ED8", tutorFrom: "#1E40AF", tutorTo: "#1E3A8A"
                  },
                  dark: {
                    primary: "#60A5FA", logoFrom: "#3B82F6", logoTo: "#1D4ED8", logoTextFrom: "#60A5FA", logoTextTo: "#93C5FD",
                    activeBg: "rgba(30, 58, 138, 0.4)", activeText: "#93C5FD", activeBorder: "#1E3A8A", activeIcon: "#60A5FA", activeDot: "#60A5FA",
                    heroFrom: "#2563EB", heroVia: "#2563EB", heroTo: "#1D4ED8", accentFrom: "#3B82F6", accentTo: "#1D4ED8", tutorFrom: "#1E40AF", tutorTo: "#1E3A8A"
                  }
                },
                emerald: {
                  light: {
                    primary: "#059669", logoFrom: "#10B981", logoTo: "#047857", logoTextFrom: "#059669", logoTextTo: "#047857",
                    activeBg: "#ECFDF5", activeText: "#047857", activeBorder: "#D1FAE5", activeIcon: "#059669", activeDot: "#10B981",
                    heroFrom: "#059669", heroVia: "#059669", heroTo: "#047857", accentFrom: "#10B981", accentTo: "#047857", tutorFrom: "#065F46", tutorTo: "#064E3B"
                  },
                  dark: {
                    primary: "#34D399", logoFrom: "#10B981", logoTo: "#047857", logoTextFrom: "#34D399", logoTextTo: "#6EE7B7",
                    activeBg: "rgba(6, 78, 59, 0.4)", activeText: "#6EE7B7", activeBorder: "#065F46", activeIcon: "#34D399", activeDot: "#34D399",
                    heroFrom: "#059669", heroVia: "#059669", heroTo: "#047857", accentFrom: "#10B981", accentTo: "#047857", tutorFrom: "#065F46", tutorTo: "#064E3B"
                  }
                },
                rose: {
                  light: {
                    primary: "#E11D48", logoFrom: "#F43F5E", logoTo: "#BE123C", logoTextFrom: "#E11D48", logoTextTo: "#BE123C",
                    activeBg: "#FFF1F2", activeText: "#BE123C", activeBorder: "#FFE4E6", activeIcon: "#E11D48", activeDot: "#F43F5E",
                    heroFrom: "#E11D48", heroVia: "#E11D48", heroTo: "#BE123C", accentFrom: "#F43F5E", accentTo: "#BE123C", tutorFrom: "#9F1239", tutorTo: "#881337"
                  },
                  dark: {
                    primary: "#FB7185", logoFrom: "#F43F5E", logoTo: "#BE123C", logoTextFrom: "#FB7185", logoTextTo: "#FDA4AF",
                    activeBg: "rgba(136, 19, 55, 0.4)", activeText: "#FDA4AF", activeBorder: "#9F1239", activeIcon: "#FB7185", activeDot: "#FB7185",
                    heroFrom: "#E11D48", heroVia: "#E11D48", heroTo: "#BE123C", accentFrom: "#F43F5E", accentTo: "#BE123C", tutorFrom: "#9F1239", tutorTo: "#881337"
                  }
                },
                violet: {
                  light: {
                    primary: "#7C3AED", logoFrom: "#8B5CF6", logoTo: "#6D28D9", logoTextFrom: "#7C3AED", logoTextTo: "#6D28D9",
                    activeBg: "#F5F3FF", activeText: "#6D28D9", activeBorder: "#EDE9FE", activeIcon: "#7C3AED", activeDot: "#8B5CF6",
                    heroFrom: "#7C3AED", heroVia: "#7C3AED", heroTo: "#6D28D9", accentFrom: "#8B5CF6", accentTo: "#6D28D9", tutorFrom: "#5B21B6", tutorTo: "#4C1D95"
                  },
                  dark: {
                    primary: "#A78BFA", logoFrom: "#8B5CF6", logoTo: "#6D28D9", logoTextFrom: "#A78BFA", logoTextTo: "#C4B5FD",
                    activeBg: "rgba(91, 33, 182, 0.4)", activeText: "#C4B5FD", activeBorder: "#5B21B6", activeIcon: "#A78BFA", activeDot: "#A78BFA",
                    heroFrom: "#7C3AED", heroVia: "#7C3AED", heroTo: "#6D28D9", accentFrom: "#8B5CF6", accentTo: "#6D28D9", tutorFrom: "#5B21B6", tutorTo: "#4C1D95"
                  }
                },
                amber: {
                  light: {
                    primary: "#D97706", logoFrom: "#F59E0B", logoTo: "#B45309", logoTextFrom: "#D97706", logoTextTo: "#B45309",
                    activeBg: "#FFFBEB", activeText: "#B45309", activeBorder: "#FEF3C7", activeIcon: "#D97706", activeDot: "#F59E0B",
                    heroFrom: "#D97706", heroVia: "#D97706", heroTo: "#B45309", accentFrom: "#F59E0B", accentTo: "#B45309", tutorFrom: "#78350F", tutorTo: "#451A03"
                  },
                  dark: {
                    primary: "#FBBF24", logoFrom: "#F59E0B", logoTo: "#B45309", logoTextFrom: "#FBBF24", logoTextTo: "#FDE68A",
                    activeBg: "rgba(120, 53, 4, 0.4)", activeText: "#FDE68A", activeBorder: "#78350F", activeIcon: "#FBBF24", activeDot: "#FBBF24",
                    heroFrom: "#D97706", heroVia: "#D97706", heroTo: "#B45309", accentFrom: "#F59E0B", accentTo: "#B45309", tutorFrom: "#78350F", tutorTo: "#451A03"
                  }
                }
              };
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
            })();
          `}
        </Script>
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
