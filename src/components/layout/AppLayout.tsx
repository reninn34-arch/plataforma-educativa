"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, clearCache } from "@/lib/fetch-utils";

interface AppLayoutProps {
  children: React.ReactNode;
  role: "student" | "teacher" | "parent" | "admin";
  links: { href: string; label: string; icon: any }[];
  title: string;
}

export function AppLayout({ children, role, links, title }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    queryClient.clear();
    clearCache();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === `/${role}/dashboard` || href === `/${role}/`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed inset-y-0 z-40 shadow-sm">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold shadow-sm">
            A
          </div>
          <div>
            <span className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              Atlas Edu
            </span>
            <span className="block text-[10px] text-slate-400 font-medium tracking-wide uppercase">{title}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <div className={`${active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"} transition-colors`}>
                  <Icon size={20} />
                </div>
                <span>{label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 w-full transition-all duration-200"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 z-40 flex items-center justify-between px-4">
        <button
          className="text-slate-500 hover:bg-slate-100 p-2 rounded-xl transition-colors"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={22} />
        </button>
        <span className="text-sm font-semibold text-slate-700 truncate mx-2">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
          A
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl animate-fade-in-up border-r border-slate-200 flex flex-col">
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold">
                A
              </div>
              <div>
                <span className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                  Atlas Edu
                </span>
                <span className="block text-[10px] text-slate-400 font-medium">{title}</span>
              </div>
            </div>
            <button className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100" onClick={() => setMobileMenuOpen(false)}>
              <X size={22} />
            </button>
          </div>

          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {links.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className={`${active ? "text-indigo-600" : "text-slate-400"}`}>
                    <Icon size={22} />
                  </div>
                  {label}
                  {active && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 pb-4 border-t border-slate-100 pt-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 w-full transition-all"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen lg:pl-64 pt-16 lg:pt-0">
        {children}
      </div>
    </div>
  );
}
