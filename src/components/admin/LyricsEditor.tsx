"use client";

import { useState, useEffect, useCallback } from "react";
import type { Song, EditorSongData, EditorLine, EditorLesson, EditorSavePayload } from "@/types";
import EditorYouTubePlayer from "./EditorYouTubePlayer";
import EditorLineRow from "./EditorLineRow";

function generateId() {
  return crypto.randomUUID();
}

interface Props {
  songs: Song[];
}

export default function LyricsEditor({ songs }: Props) {
  const [selectedSongId, setSelectedSongId] = useState<string>("");
  const [songData, setSongData] = useState<EditorSongData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [collapsedLessons, setCollapsedLessons] = useState<Set<string>>(new Set());
  const [globalOffset, setGlobalOffset] = useState<string>("");

  // Warn on unsaved changes
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Fetch song data
  async function loadSong(songId: string) {
    if (!songId) {
      setSongData(null);
      return;
    }
    setLoading(true);
    setDirty(false);
    setDeletedIds([]);
    setAddedIds(new Set());
    setActiveLineId(null);
    setCollapsedLessons(new Set());
    try {
      const res = await fetch(`/api/admin/lyrics-editor/${songId}`);
      if (!res.ok) throw new Error("Failed to load song");
      const data: EditorSongData = await res.json();
      setSongData(data);
    } catch (err) {
      alert("Failed to load song data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSongSelect(songId: string) {
    if (dirty && !confirm("You have unsaved changes. Discard?")) return;
    setSelectedSongId(songId);
    loadSong(songId);
  }

  // Get the active line's data
  const activeLine = songData
    ? songData.lessons.flatMap((l) => l.lines).find((l) => l.id === activeLineId)
    : null;

  // Update a field on a line
  const updateLine = useCallback(
    (lessonId: string, lineId: string, field: keyof EditorLine, value: string | number) => {
      setSongData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lessons: prev.lessons.map((lesson) => {
            if (lesson.id !== lessonId) return lesson;
            return {
              ...lesson,
              lines: lesson.lines.map((line) => {
                if (line.id !== lineId) return line;
                return {
                  ...line,
                  [field]: value,
                  _status: line._status === "added" ? "added" : "modified",
                } as EditorLine;
              }),
            };
          }),
        };
      });
      setDirty(true);
    },
    []
  );

  // Delete a line
  function deleteLine(lessonId: string, lineId: string) {
    if (!confirm("Delete this line? Its vocabulary will also be deleted.")) return;
    setSongData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lessons: prev.lessons.map((lesson) => {
          if (lesson.id !== lessonId) return lesson;
          return { ...lesson, lines: lesson.lines.filter((l) => l.id !== lineId) };
        }),
      };
    });
    // Only track for deletion if it's an existing line (not newly added)
    if (!addedIds.has(lineId)) {
      setDeletedIds((prev) => [...prev, lineId]);
    } else {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }
    if (activeLineId === lineId) setActiveLineId(null);
    setDirty(true);
  }

  // Add a new line below a given line
  function addLineBelow(lessonId: string, afterLineId: string) {
    const newId = generateId();
    setSongData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lessons: prev.lessons.map((lesson) => {
          if (lesson.id !== lessonId) return lesson;
          const idx = lesson.lines.findIndex((l) => l.id === afterLineId);
          if (idx === -1) return lesson;
          const afterLine = lesson.lines[idx];
          const nextLine = lesson.lines[idx + 1];
          const newLine: EditorLine = {
            id: newId,
            lesson_id: lessonId,
            start_time: afterLine.end_time,
            end_time: nextLine ? nextLine.start_time : afterLine.end_time + 4,
            japanese_text: "",
            english_text: "",
            trim: 0,
            vocabulary: [],
            _status: "added",
          };
          const newLines = [...lesson.lines];
          newLines.splice(idx + 1, 0, newLine);
          return { ...lesson, lines: newLines };
        }),
      };
    });
    setAddedIds((prev) => new Set(prev).add(newId));
    setDirty(true);
  }

  // Set start/end from YouTube player
  function handleSetStart(time: number) {
    if (!activeLineId || !songData) return;
    const lesson = songData.lessons.find((l) => l.lines.some((li) => li.id === activeLineId));
    if (lesson) updateLine(lesson.id, activeLineId, "start_time", time);
  }

  function handleSetEnd(time: number) {
    if (!activeLineId || !songData) return;
    const lesson = songData.lessons.find((l) => l.lines.some((li) => li.id === activeLineId));
    if (lesson) updateLine(lesson.id, activeLineId, "end_time", time);
  }

  // Save all changes
  async function handleSave() {
    if (!songData || !selectedSongId) return;
    setSaving(true);

    const allLines = songData.lessons.flatMap((l) => l.lines);
    const updates: EditorSavePayload["updates"] = [];
    const additions: EditorSavePayload["additions"] = [];

    for (const line of allLines) {
      if (line._status === "added") {
        additions.push({
          id: line.id,
          lesson_id: line.lesson_id,
          start_time: line.start_time,
          end_time: line.end_time,
          japanese_text: line.japanese_text,
          english_text: line.english_text,
        });
      } else if (line._status === "modified") {
        updates.push({
          id: line.id,
          japanese_text: line.japanese_text,
          english_text: line.english_text,
          start_time: line.start_time,
          end_time: line.end_time,
        });
      }
    }

    const payload: EditorSavePayload = {
      updates,
      deletes: deletedIds,
      additions,
    };

    try {
      const res = await fetch(`/api/admin/lyrics-editor/${selectedSongId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      // Reload to get fresh data
      await loadSong(selectedSongId);
    } catch (err) {
      alert("Failed to save changes");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function applyGlobalOffset() {
    const delta = parseFloat(globalOffset);
    if (isNaN(delta) || delta === 0) return;
    setSongData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lessons: prev.lessons.map((lesson) => ({
          ...lesson,
          lines: lesson.lines.map((line) => ({
            ...line,
            start_time: Math.max(0, Math.round((line.start_time + delta) * 100) / 100),
            end_time: Math.max(0, Math.round((line.end_time + delta) * 100) / 100),
            _status: line._status === "added" ? "added" : "modified",
          } as EditorLine)),
        })),
      };
    });
    setGlobalOffset("");
    setDirty(true);
  }

  function toggleLesson(lessonId: string) {
    setCollapsedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Song selector */}
      <div className="flex items-center gap-3">
        <select
          value={selectedSongId}
          onChange={(e) => handleSongSelect(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">Select a song to edit...</option>
          {songs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {/* Global offset tool */}
      {songData && (
        <div className="flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-gray-600 shrink-0">Shift all timestamps by</span>
          <input
            type="number"
            step="0.01"
            value={globalOffset}
            onChange={(e) => setGlobalOffset(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyGlobalOffset(); }}
            placeholder="e.g. -0.5 or 1.2"
            className="w-32 border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:border-indigo-400 focus:outline-none"
          />
          <span className="text-gray-600 shrink-0">seconds</span>
          <button
            type="button"
            onClick={applyGlobalOffset}
            disabled={globalOffset === "" || isNaN(parseFloat(globalOffset))}
            className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-40 text-sm font-medium"
          >
            Apply
          </button>
          <span className="text-gray-400 text-xs ml-1">Marks all lines as modified — save to persist</span>
        </div>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {songData && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Line editor */}
          <div className="flex-1 min-w-0 space-y-4 order-2 lg:order-1">
            {songData.lessons.map((lesson) => (
              <LessonGroup
                key={lesson.id}
                lesson={lesson}
                collapsed={collapsedLessons.has(lesson.id)}
                onToggle={() => toggleLesson(lesson.id)}
                activeLineId={activeLineId}
                onSetActive={setActiveLineId}
                onUpdateLine={updateLine}
                onDeleteLine={deleteLine}
                onAddLineBelow={addLineBelow}
              />
            ))}

            {/* Bottom save bar */}
            {dirty && (
              <div className="sticky bottom-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shadow-lg"
                >
                  {saving ? "Saving..." : "Save All Changes"}
                </button>
              </div>
            )}
          </div>

          {/* Right: YouTube player (sticky) */}
          <div className="lg:w-[400px] shrink-0 order-1 lg:order-2">
            <div className="lg:sticky lg:top-20 space-y-2">
              <EditorYouTubePlayer
                videoId={songData.song.youtube_id}
                startTime={activeLine?.start_time ?? 0}
                endTime={activeLine?.end_time ?? 10}
                isLooping={isLooping}
                onSetStart={handleSetStart}
                onSetEnd={handleSetEnd}
              />
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLooping}
                    onChange={(e) => setIsLooping(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-gray-600">Loop active line</span>
                </label>
                {activeLine && (
                  <span className="text-gray-400 ml-auto truncate">
                    Active: {activeLine.japanese_text.slice(0, 30)}
                    {activeLine.japanese_text.length > 30 ? "..." : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Lesson group sub-component
function LessonGroup({
  lesson,
  collapsed,
  onToggle,
  activeLineId,
  onSetActive,
  onUpdateLine,
  onDeleteLine,
  onAddLineBelow,
}: {
  lesson: EditorLesson;
  collapsed: boolean;
  onToggle: () => void;
  activeLineId: string | null;
  onSetActive: (id: string | null) => void;
  onUpdateLine: (lessonId: string, lineId: string, field: keyof EditorLine, value: string | number) => void;
  onDeleteLine: (lessonId: string, lineId: string) => void;
  onAddLineBelow: (lessonId: string, afterLineId: string) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
      >
        <span>Day {lesson.day_number}</span>
        <span className="text-gray-400 text-xs">
          {lesson.lines.length} lines {collapsed ? "+" : "-"}
        </span>
      </button>
      {!collapsed && (
        <div className="p-2 space-y-1.5">
          {lesson.lines.map((line) => (
            <EditorLineRow
              key={line.id}
              line={line}
              isActive={line.id === activeLineId}
              onPlay={() =>
                onSetActive(line.id === activeLineId ? null : line.id)
              }
              onUpdate={(field, value) => onUpdateLine(lesson.id, line.id, field, value)}
              onDelete={() => onDeleteLine(lesson.id, line.id)}
              onAddBelow={() => onAddLineBelow(lesson.id, line.id)}
            />
          ))}
          {lesson.lines.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No lines in this lesson</p>
          )}
        </div>
      )}
    </div>
  );
}
