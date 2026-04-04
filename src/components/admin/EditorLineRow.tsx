"use client";

import { useEffect, useRef } from "react";
import EditorTimestampInput from "./EditorTimestampInput";
import type { EditorLine } from "@/types";

function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={1}
      className={className}
      placeholder={placeholder}
      style={{ overflow: "hidden", resize: "none" }}
    />
  );
}

interface Props {
  line: EditorLine;
  isActive: boolean;
  onPlay: () => void;
  onUpdate: (field: keyof EditorLine, value: string | number) => void;
  onDelete: () => void;
  onAddBelow: () => void;
  // Selection
  isSelected?: boolean;
  onToggleSelect?: () => void;
  // Retranslate
  retranslating?: boolean;
  onRetranslate?: () => void;
  // Drag and drop
  isDragging?: boolean;
  dropPosition?: "before" | "after" | null;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
}

export default function EditorLineRow({
  line,
  isActive,
  onPlay,
  onUpdate,
  onDelete,
  onAddBelow,
  isSelected,
  onToggleSelect,
  retranslating,
  onRetranslate,
  isDragging,
  dropPosition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  const isModified = line._status === "modified";
  const isAdded = line._status === "added";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      className={`flex gap-2 items-stretch p-2 rounded-lg border transition-colors ${
        isActive
          ? "border-indigo-400 bg-indigo-50"
          : isModified
          ? "border-amber-300 bg-amber-50"
          : isAdded
          ? "border-green-300 bg-green-50"
          : "border-gray-200 bg-white"
      } ${isDragging ? "opacity-30" : ""} ${isSelected ? "ring-2 ring-indigo-400" : ""}`}
      style={{
        boxShadow:
          dropPosition === "before"
            ? "0 -2px 0 0 rgb(99, 102, 241)"
            : dropPosition === "after"
            ? "0 2px 0 0 rgb(99, 102, 241)"
            : undefined,
      }}
    >
      {/* Selection checkbox */}
      <label className="shrink-0 flex items-center cursor-pointer px-0.5">
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => onToggleSelect?.()}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
      </label>

      {/* Drag handle */}
      <div
        className="shrink-0 flex items-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 select-none text-sm px-0.5"
        title="Drag to reorder"
      >
        ⠿
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Top row: text fields + actions */}
        <div className="flex gap-2 items-start">
          {/* Text fields */}
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <AutoTextarea
              value={line.japanese_text}
              onChange={(e) => onUpdate("japanese_text", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:border-indigo-400 focus:outline-none font-sans"
              placeholder="Japanese text"
            />
            <div className="flex gap-1 items-start">
              <AutoTextarea
                value={line.english_text}
                onChange={(e) => onUpdate("english_text", e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:border-indigo-400 focus:outline-none text-gray-600"
                placeholder="English translation"
              />
              <button
                type="button"
                onClick={() => onRetranslate?.()}
                disabled={retranslating}
                className="shrink-0 px-1.5 py-1 text-[10px] bg-cyan-100 hover:bg-cyan-200 text-cyan-700 rounded disabled:opacity-50"
                title="Regenerate English translation with AI"
              >
                {retranslating ? "..." : "AI"}
              </button>
            </div>
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

        {/* Bottom row: play button + timestamps */}
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={onPlay}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 text-xs"
            title="Play this line"
          >
            {isActive ? "||" : "\u25B6"}
          </button>
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
              <EditorTimestampInput
                label="Start"
                value={line.start_time}
                onChange={(v) => onUpdate("start_time", v)}
              />
            </div>
            <span className="text-gray-300 text-sm select-none">→</span>
            <div className="px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
              <EditorTimestampInput
                label="End"
                value={line.end_time}
                onChange={(v) => onUpdate("end_time", v)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
