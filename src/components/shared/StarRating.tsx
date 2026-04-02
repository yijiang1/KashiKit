"use client";

import { useState } from "react";

interface Props {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: "sm" | "md";
}

const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

const sizes = {
  sm: "w-3.5 h-3.5",
  md: "w-5 h-5",
};

export default function StarRating({ value, onChange, size = "sm" }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !!onChange;
  const display = hover ?? value ?? 0;

  function handleClick(star: number) {
    if (!onChange) return;
    // Clicking the current value clears the rating
    onChange(star === value ? null : star);
  }

  return (
    <div
      className={`flex gap-0.5 ${interactive ? "cursor-pointer" : ""}`}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizes[size]} transition-colors ${
            star <= display
              ? hover !== null
                ? "text-amber-300"
                : "text-amber-400"
              : "text-gray-200"
          }`}
          viewBox="0 0 24 24"
          fill="currentColor"
          onClick={interactive ? () => handleClick(star) : undefined}
          onMouseEnter={interactive ? () => setHover(star) : undefined}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  );
}
