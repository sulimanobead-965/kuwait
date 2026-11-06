export function createAudio() {
  let ctx: AudioContext | null = null;

  function ensure() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ) {
    const c = ensure();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur);
  }

  return {
    unlock() {
      try {
        ensure();
      } catch {
        /* ignore */
      }
    },
    play(kind: "place" | "road" | "collect" | "error" | "quest", mute: boolean) {
      if (mute) return;
      try {
        if (kind === "place") {
          tone(523, 0.08, "triangle", 0.05);
          tone(784, 0.12, "triangle", 0.04, 0.07);
        } else if (kind === "road") {
          tone(392, 0.05, "square", 0.025);
        } else if (kind === "collect") {
          tone(880, 0.07, "sine", 0.05);
          tone(1175, 0.11, "sine", 0.04, 0.06);
        } else if (kind === "error") {
          tone(180, 0.12, "square", 0.03);
        } else {
          tone(523, 0.09, "triangle", 0.05);
          tone(659, 0.09, "triangle", 0.045, 0.09);
          tone(784, 0.16, "triangle", 0.05, 0.18);
        }
      } catch {
        /* ignore */
      }
    },
  };
}
