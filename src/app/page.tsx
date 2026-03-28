import { getDb } from "@/lib/db";
import SongGrid from "@/components/dashboard/SongGrid";
import StatsBar from "@/components/dashboard/StatsBar";
import type { Song } from "@/types";

export const revalidate = 0;

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const days = [...new Set(dates.map((d) => d.slice(0, 10)))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round(
      (new Date(days[i - 1]).getTime() - new Date(days[i]).getTime()) / 86400000
    );
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

export default async function DashboardPage() {
  const db = getDb();

  const songs = db.prepare("SELECT * FROM songs ORDER BY created_at DESC").all() as Song[];
  const completions = db.prepare("SELECT completed_at, lesson_id FROM lesson_completions").all() as { completed_at: string; lesson_id: string }[];
  const lessons = db.prepare("SELECT id, song_id FROM lessons").all() as { id: string; song_id: string }[];
  const apiUsage = db.prepare("SELECT created_at, total_tokens FROM api_usage").all() as { created_at: string; total_tokens: number }[];

  const today = new Date().toISOString().slice(0, 10);
  const allCompletions = completions ?? [];
  const streak = calcStreak(allCompletions.map((c) => c.completed_at));
  const todayCount = allCompletions.filter((c) => c.completed_at.slice(0, 10) === today).length;
  const completedLessonIds = new Set(allCompletions.map((c) => c.lesson_id));

  // Build per-song completed day count
  const lessonsBySong = (lessons ?? []).reduce<Record<string, string[]>>((acc, l) => {
    acc[l.song_id] = acc[l.song_id] ?? [];
    acc[l.song_id].push(l.id);
    return acc;
  }, {});

  const completedDaysBySong = Object.fromEntries(
    Object.entries(lessonsBySong).map(([songId, ids]) => [
      songId,
      ids.filter((id) => completedLessonIds.has(id)).length,
    ])
  );

  // API usage stats
  const allApiUsage = apiUsage ?? [];
  const todayApiRows = allApiUsage.filter((r) => r.created_at.slice(0, 10) === today);
  const apiTodayCalls = todayApiRows.length;
  const apiTodayTokens = todayApiRows.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0);
  const apiTotalCalls = allApiUsage.length;
  const apiTotalTokens = allApiUsage.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0);

  const songList: Song[] = songs ?? [];

  return (
    <div className="space-y-6">
      <StatsBar
        streak={streak}
        today={todayCount}
        total={allCompletions.length}
        apiTodayCalls={apiTodayCalls}
        apiTodayTokens={apiTodayTokens}
        apiTotalCalls={apiTotalCalls}
        apiTotalTokens={apiTotalTokens}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your songs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {songList.length === 0
              ? "Import a song to generate your first course"
              : `${songList.length} song${songList.length !== 1 ? "s" : ""} in your library`}
          </p>
        </div>
      </div>

      <SongGrid songs={songList} completedDaysBySong={completedDaysBySong} />
    </div>
  );
}
