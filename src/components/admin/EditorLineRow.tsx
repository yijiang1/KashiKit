"use client";

import EditorTimestampInput from "./EditorTimestampInput";
import type { EditorLine } from "@/types";

interface Props {
  line: EditorLine;
  isActive: boolean;
  onPlay: () => void;
  onUpdate: (field: keyof EditorLine, value: string | number) => void;
  onDelete: () => void;
  onAddBelow: () => void;
}

export default function EditorLineRow({
  line,
  isActive,
  onPlay,
  onUpdate,
  onDelete,
  onAddBelow,
}: Props) {
  const isModified = line._status === "modified";
  const isAdded = line._status === "added";

  return (
    <div
      className={`flex gap-2 items-start p-2 rounded-lg border transition-colors ${
        isActive
          ? "border-indigo-400 bg-indigo-50"
          : isModified
          ? "border-amber-300 bg-amber-50"
          : isAdded
          ? "border-green-300 bg-green-50"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* Play button */}
      <button
        type="button"
        onClick={onPlay}
        className="mt-3 shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 text-xs"
        title="Play this line"
      >
        {isActive ? "||" : "\u25B6"}
      </button>

      {/* Timestamps */}
      <div className="flex flex-col gap-1 shrink-0">
        <EditorTimestampInput
          label="Start"
          value={line.start_time}
          onChange={(v) => onUpdate("start_time", v)}
        />
        <EditorTimestampInput
          label="End"
          value={line.end_time}
          onChange={(v) => onUpdate("end_time", v)}
        />
      </div>

      {/* Text fields */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <textarea
          value={line.japanese_text}
          onChange={(e) => onUpdate("japanese_text", e.target.value)}
          rows={1}
          className="text-sm border border-gray-200 rounded px-2 py-1 resize-none focus:border-indigo-400 focus:outline-none font-sans"
          placeholder="Japanese text"
        />
        <textarea
          value={line.english_text}
          onChange={(e) => onUpdate("english_text", e.target.value)}
          rows={1}
          className="text-xs border border-gray-200 rounded px-2 py-1 resize-none focus:border-indigo-400 focus:outline-none text-gray-600"
          placeholder="English translation"
        />
      </div>

      {/* Info + actions */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {line.vocabulary.length > 0 && (
          <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
            {line.vocabulary.length} vocab
          </span>
        )}
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={onAddBelow}
            className="px-1.5 py-0.5 text-[10px] bg-green-100 hover:bg-green-200 text-green-700 rounded"
            title="Add new line below"
          >
            +Add
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-1.5 py-0.5 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 rounded"
            title="Delete this line"
          >
            Del
          </button>
        </div>
      </div>
    </div>
  );
}
