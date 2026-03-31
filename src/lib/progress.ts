"use client";

const STORAGE_KEY = "lyriclearn_progress";

type ProgressStore = {
  completions: Record<string, string>; // lessonId → ISO date string
};

function load(): ProgressStore {
  if (typeof window === "undefined") return { completions: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completions: {} };
    return JSON.parse(raw) as ProgressStore;
  } catch {
    return { completions: {} };
  }
}

function save(store: ProgressStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function markComplete(lessonId: string) {
  const store = load();
  if (!store.completions[lessonId]) {
    store.completions[lessonId] = new Date().toISOString();
    save(store);
  }
}

export function isLessonComplete(lessonId: string): boolean {
  return !!load().completions[lessonId];
}

export function getCompletedLessonIds(): Set<string> {
  return new Set(Object.keys(load().completions));
}

export function getStats(): { streak: number; today: number; total: number } {
  const store = load();
  const dates = Object.values(store.completions);
  if (dates.length === 0) return { streak: 0, today: 0, total: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = dates.filter((d) => d.slice(0, 10) === today).length;
  const streak = calcStreak(dates);

  return { streak, today: todayCount, total: dates.length };
}

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const days = [...new Set(dates.map((d) => d.slice(0, 10)))].sort().reverse();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
