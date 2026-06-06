"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface ModuleCardProps {
  id: string;
  defaultOpen?: boolean;
  className: string;
  header: ReactNode;
  children: ReactNode;
}

export function ModuleCard({ id, defaultOpen = true, className, header, children }: ModuleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="relative">
      <div className={className}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">{header}</div>
            <ChevronDown
              size={20}
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                open ? "rotate-0" : "-rotate-90"
              }`}
            />
          </div>
        </button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
