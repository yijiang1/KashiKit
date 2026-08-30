"use client";

import { useRef, useEffect, useState, useCallback } from "react";

export default function LogoText() {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [keyframes, setKeyframes] = useState("");
  const [wide, setWide] = useState(false);

  const buildKeyframes = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const spans = el.querySelectorAll<HTMLSpanElement>(".logo-letter");
    const origin = el.getBoundingClientRect().left;
    const positions: number[] = [];
    spans.forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.width > 0) positions.push(r.left + r.width / 2 - origin);
    });

    const n = positions.length;
    if (n === 0) return;

    const seg = 100 / (n + 1);
    let kf = "";

    for (let i = 0; i < n; i++) {
      const landPct = i * seg;
      kf += `${landPct.toFixed(2)}%{left:${positions[i].toFixed(1)}px;top:-2px;opacity:1}`;
      if (i < n - 1) {
        const arcPct = landPct + seg / 2;
        const midX = (positions[i] + positions[i + 1]) / 2;
        kf += `${arcPct.toFixed(2)}%{left:${midX.toFixed(1)}px;top:-8px;opacity:1}`;
      }
    }

    const lastPct = (n - 1) * seg;
    kf += `${(lastPct + seg * 0.5).toFixed(2)}%{left:${positions[n - 1].toFixed(1)}px;top:-6px;opacity:0}`;
    kf += `${(lastPct + seg * 0.8).toFixed(2)}%{left:${positions[0].toFixed(1)}px;top:-6px;opacity:0}`;
    kf += `100%{left:${positions[0].toFixed(1)}px;top:-2px;opacity:1}`;

    setKeyframes(`@keyframes noteTravel{${kf}}`);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setWide(mq.matches);
      // Defer to let DOM update after state change
      requestAnimationFrame(() => buildKeyframes());
    };
    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", buildKeyframes);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", buildKeyframes);
    };
  }, [buildKeyframes]);

  // Rebuild when wide changes (tagline appears/disappears)
  useEffect(() => {
    requestAnimationFrame(() => buildKeyframes());
  }, [wide, buildKeyframes]);

  const speed = wide ? 14 : 4;

  return (
    <span ref={containerRef} className="relative select-none pt-3 inline-flex items-baseline gap-2 whitespace-nowrap">
      {keyframes && (
        <>
          <style dangerouslySetInnerHTML={{ __html: keyframes }} />
          <span
            key={speed}
            className="absolute text-indigo-400 text-xs pointer-events-none"
            style={{
              animation: `noteTravel ${speed}s linear infinite`,
              transform: "translateX(-50%)",
            }}
          >
            ♪
          </span>
        </>
      )}
      <span className="text-lg tracking-tight">
        {"Kashi".split("").map((ch, i) => (
          <span key={i} className="logo-letter font-bold text-indigo-600">{ch}</span>
        ))}
        {"Kit".split("").map((ch, i) => (
          <span key={`k${i}`} className="logo-letter font-light text-gray-700">{ch}</span>
        ))}
      </span>
      {wide && (
        <span className="text-lg text-gray-400 tracking-tight font-light">
          {"Learn Japanese & Chinese through music".split("").map((ch, i) =>
            ch === " " ? (
              <span key={i}> </span>
            ) : (
              <span key={i} className="logo-letter font-light text-gray-400">{ch}</span>
            )
          )}
        </span>
      )}
    </span>
  );
}
