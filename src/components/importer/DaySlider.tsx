"use client";

interface Props {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}

export default function DaySlider({ value, onChange, max = 30 }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">Course length</label>
        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-full">
          {value} {value === 1 ? "day" : "days"}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>1 day</span>
        <span>{max} {max === 1 ? "day" : "days"} max</span>
      </div>
    </div>
  );
}
