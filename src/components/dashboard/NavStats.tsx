"use client";

import { useState, useEffect } from "react";
import { getStats } from "@/lib/progress";

interface Props {
  isAdmin: boolean;
}

export default function NavStats({ isAdmin }: Props) {
  const [streak, setStreak] = useState<number | null>(null);
  const [todayLessons, setTodayLessons] = useState<number | null>(null);
  const [apiCalls, setApiCalls] = useState<number | null>(null);

  useEffect(() => {
    const stats = getStats();
    setStreak(stats.streak);
    setTodayLessons(stats.today);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchApiCalls = () => {
      fetch("/api/usage")
        .then((r) => r.json())
        .then((d) => setApiCalls(d.todayCalls ?? 0))
        .catch(() => {});
    };

    fetchApiCalls();
    const interval = setInterval(fetchApiCalls, 15000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  if (streak === null) return null;

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      <span title="Day streak">🔥 <span className="font-medium text-indigo-600">{streak}</span> streak</span>
      <span title="Lessons completed today">📖 <span className="font-medium text-green-600">{todayLessons}</span> today</span>
      {isAdmin && apiCalls !== null && (
        <span title="API calls today">⚡ <span className={`font-medium ${apiCalls >= 1350 ? "text-red-500" : "text-amber-600"}`}>{apiCalls}</span> / 1,500 API</span>
      )}
    </div>
  );
}
