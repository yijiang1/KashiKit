"use client";

interface Props {
  value: number; // seconds
  onChange: (seconds: number) => void;
  label: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

function parseTime(str: string): number | null {
  const match = str.match(/^(\d+):(\d{1,2}(?:\.\d{0,3})?)$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const secs = parseFloat(match[2]);
  if (secs >= 60) return null;
  return minutes * 60 + secs;
}

export default function EditorTimestampInput({ value, onChange, label }: Props) {
  const display = formatTime(value);

  function nudge(delta: number) {
    onChange(Math.max(0, Math.round((value + delta) * 100) / 100));
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const parsed = parseTime(e.target.value);
    if (parsed !== null) {
      onChange(Math.max(0, Math.round(parsed * 100) / 100));
    }
    // If invalid, the display will reset to the current value on re-render
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => nudge(-0.1)}
          className="px-1 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
          title="-0.1s"
        >
          -.1
        </button>
        <button
          type="button"
          onClick={() => nudge(-0.01)}
          className="px-1 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
          title="-0.01s"
        >
          -.01
        </button>
        <input
          type="text"
          defaultValue={display}
          key={display}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-[72px] text-xs text-center font-mono border border-gray-200 rounded px-1 py-0.5 focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => nudge(0.01)}
          className="px-1 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
          title="+0.01s"
        >
          +.01
        </button>
        <button
          type="button"
          onClick={() => nudge(0.1)}
          className="px-1 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
          title="+0.1s"
        >
          +.1
        </button>
      </div>
    </div>
  );
}
