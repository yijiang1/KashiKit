import type { PitchPoint } from "@/lib/audio/pitch";

interface Props {
  data: PitchPoint[];
}

const WIDTH = 320;
const HEIGHT = 80;
const PADDING = 6;

export default function PitchContourChart({ data }: Props) {
  const voiced = data.filter((p): p is PitchPoint & { hz: number } => p.hz !== null);

  if (voiced.length < 2) {
    return (
      <div className="h-20 flex items-center justify-center text-xs text-gray-400">
        Not enough voiced audio detected
      </div>
    );
  }

  const tMin = data[0].tSec;
  const tMax = data[data.length - 1].tSec;
  const tSpan = Math.max(tMax - tMin, 0.001);

  let hzMin = Math.min(...voiced.map((p) => p.hz));
  let hzMax = Math.max(...voiced.map((p) => p.hz));
  if (hzMax - hzMin < 20) {
    // Near-flat range — pad so the shape isn't squashed into a single pixel row
    const mid = (hzMax + hzMin) / 2;
    hzMin = mid - 10;
    hzMax = mid + 10;
  }

  const x = (tSec: number) => PADDING + ((tSec - tMin) / tSpan) * (WIDTH - 2 * PADDING);
  const y = (hz: number) => HEIGHT - PADDING - ((hz - hzMin) / (hzMax - hzMin)) * (HEIGHT - 2 * PADDING);

  // Split into contiguous voiced runs so silence/unvoiced gaps render as a
  // break in the line rather than a misleading straight interpolation.
  const segments: { tSec: number; hz: number }[][] = [];
  let current: { tSec: number; hz: number }[] = [];
  for (const p of data) {
    if (p.hz === null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push({ tSec: p.tSec, hz: p.hz });
    }
  }
  if (current.length > 0) segments.push(current);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-20" preserveAspectRatio="none">
      {segments.map((seg, i) => (
        <polyline
          key={i}
          points={seg.map((p) => `${x(p.tSec)},${y(p.hz)}`).join(" ")}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
