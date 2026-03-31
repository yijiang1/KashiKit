"use client";

import { useState, useEffect, useCallback } from "react";

type Entry = {
  id: string;
  japanese_text: string;
  english_text: string;
  song_title: string;
  youtube_id: string;
  start_time: number;
  end_time: number;
  words: string;
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface Props {
  songTitles: string[];
}

export default function SentenceBankTable({ songTitles }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [songFilter, setSongFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (songFilter) params.set("song", songFilter);
    const res = await fetch(`/api/sentence-bank?${params}`);
    const data = await res.json();
    if (Array.isArray(data)) setEntries(data);
    setLoading(false);
  }, [search, songFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchEntries, 300);
    return () => clearTimeout(timer);
  }, [fetchEntries]);

  async function handleDelete(id: string, text: string) {
    if (!confirm(`Delete "${text}"?`)) return;
    await fetch(`/api/sentences?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Japanese or English text..."
            className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-400"
          />
          <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={songFilter}
          onChange={(e) => setSongFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 text-sm"
        >
          <option value="">All songs</option>
          {songTitles.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500">
        {loading ? "Loading..." : `${entries.length} sentence${entries.length !== 1 ? "s" : ""}${entries.length === 200 ? " (limit 200)" : ""}`}
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Japanese</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">English</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Song</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Time</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Words</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              let words: string[] = [];
              try { words = JSON.parse(entry.words); } catch { /* empty */ }
              return (
                <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900">{entry.japanese_text}</td>
                  <td className="px-4 py-3 text-gray-600 italic text-xs">{entry.english_text}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{entry.song_title}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatTime(Number(entry.start_time))}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {words.map((w, i) => (
                        <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{w}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(entry.id, entry.japanese_text)}
                      className="text-red-400 hover:text-red-600 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  {search || songFilter ? "No sentences match your search" : "No sentences in the bank"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
