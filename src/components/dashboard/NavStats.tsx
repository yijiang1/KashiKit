"use client";

import { useState, useEffect } from "react";

export default function NavStats() {
  const [streak, setStreak] = useState<number | null>(null);
  const [todayLessons, setTodayLessons] = useState<number | null>(null);
  const [apiCalls, setApiCalls] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { setStreak(d.streak ?? 0); setTodayLessons(d.today ?? 0); })
      .catch(() => {});
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => { setApiCalls(d.todayCalls ?? 0); })
      .catch(() => {});
  }, []);

  if (streak === null) return null;

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      <span title="Day streak">🔥 <span className="font-medium text-indigo-600">{streak}</span> streak</span>
      <span title="Lessons completed today">📖 <span className="font-medium text-green-600">{todayLessons}</span> today</span>
      <span title="API calls today">⚡ <span className={`font-medium ${apiCalls !== null && apiCalls >= 1350 ? "text-red-500" : "text-amber-600"}`}>{apiCalls ?? 0}</span> / 1,500 API</span>
    </div>
  );
}
