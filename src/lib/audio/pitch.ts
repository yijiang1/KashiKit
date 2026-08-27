import { PitchDetector } from "pitchy";

export type PitchPoint = { tSec: number; hz: number | null };

const WINDOW_SIZE = 2048;
const HOP_SIZE = 512;
// Below this clarity, findPitch's autocorrelation candidate is not trustworthy
// (silence, noise, unvoiced consonants) — pitchy's own docs recommend 0.8-1.
const CLARITY_THRESHOLD = 0.8;
// Human speaking/singing voice range; filters out low-frequency rumble and
// spurious high-frequency detections outside anything a voice produces.
const MIN_HZ = 60;
const MAX_HZ = 500;

/**
 * Extracts an F0-over-time contour from decoded mono PCM, for visualizing the
 * rise/fall shape of a recorded line (directly meaningful for tone/pitch-accent
 * correctness). Windows with low clarity or an out-of-voice-range pitch are
 * reported as `hz: null` so the chart can render them as a gap rather than a
 * misleading interpolated line.
 */
export function detectPitchContour(channelData: Float32Array, sampleRate: number): PitchPoint[] {
  if (channelData.length < WINDOW_SIZE) return [];

  const detector = PitchDetector.forFloat32Array(WINDOW_SIZE);
  const window = new Float32Array(WINDOW_SIZE);
  const points: PitchPoint[] = [];

  for (let start = 0; start + WINDOW_SIZE <= channelData.length; start += HOP_SIZE) {
    window.set(channelData.subarray(start, start + WINDOW_SIZE));
    const [hz, clarity] = detector.findPitch(window, sampleRate);
    const tSec = (start + WINDOW_SIZE / 2) / sampleRate;
    const valid = clarity >= CLARITY_THRESHOLD && hz >= MIN_HZ && hz <= MAX_HZ;
    points.push({ tSec, hz: valid ? hz : null });
  }

  return points;
}
