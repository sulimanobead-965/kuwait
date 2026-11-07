export type DayMode = "auto" | "day" | "night";

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function smoothstep(a: number, b: number, n: number) {
  const t = clamp01((n - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function lightingAt(mode: DayMode, phase: number) {
  const sunHeight = mode === "night" ? -0.6 : mode === "day" ? 0.8 : Math.sin(phase * Math.PI * 2);
  const night = 1 - smoothstep(-0.12, 0.26, sunHeight);
  const dusk = mode === "auto" ? clamp01(1 - Math.abs(sunHeight) / 0.34) * (1 - night * 0.45) : 0;
  return {
    night,
    dusk,
    sunHeight,
    elevation: Math.max(8, Math.asin(Math.max(-0.3, sunHeight)) * (180 / Math.PI)),
    azimuth: phase * Math.PI * 2 - Math.PI * 0.4,
    emission: smoothstep(0.18, 0.78, night),
  };
}
