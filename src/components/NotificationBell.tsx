"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      fetch("/api/notifications")
        .then(r => r.json())
        .then(d => setCount(d.unreadCount || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <div className="relative inline-flex">
      <Bell className="h-4 w-4" />
      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white animate-pulse">
        {count > 9 ? "9+" : count}
      </span>
    </div>
  );
}
