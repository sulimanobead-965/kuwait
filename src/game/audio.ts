export type SoundKind = "place" | "road" | "collect" | "error" | "quest";

let soundHook: ((kind: SoundKind) => void) | null = null;

/** Lets the native app add haptics to game sounds without the game knowing about it. */
export function setSoundHook(fn: ((kind: SoundKind) => void) | null) {
  soundHook = fn;
}

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

  // Background music: a slow, quiet loop in maqam hijaz (D, Eb, F#, G, A, Bb, C) with a
  // soft plucked lead over a drone and a light frame-drum pattern. All synthesized.
  let musicTimer: number | null = null;
  let musicGain: GainNode | null = null;
  const HIJAZ = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33];
  const PHRASES = [
    [0, 1, 2, 3, 4, 3, 2, 1],
    [4, 5, 4, 3, 2, 3, 1, 0],
    [3, 4, 6, 5, 4, 3, 2, 3],
    [2, 1, 0, 1, 2, 3, 2, 0],
  ];
  let bar = 0;

  function pluck(c: AudioContext, out: AudioNode, freq: number, t: number, dur: number, vol: number) {
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = "triangle";
    o2.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq * 1.003, t);
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 6, t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(out);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  function drum(c: AudioContext, out: AudioNode, t: number, low: boolean) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(low ? 110 : 220, t);
    o.frequency.exponentialRampToValueAtTime(low ? 55 : 140, t + 0.12);
    g.gain.setValueAtTime(low ? 0.22 : 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.2);
  }

  function scheduleBar() {
    const c = ensure();
    if (!musicGain) return;
    const beat = 0.42;
    const t0 = c.currentTime + 0.05;
    const phrase = PHRASES[bar % PHRASES.length]!;
    phrase.forEach((step, i) => {
      if (i % 4 === 3 && bar % 2) return;
      pluck(c, musicGain!, HIJAZ[step]!, t0 + i * beat, beat * 1.6, 0.06);
    });
    pluck(c, musicGain, HIJAZ[0]! / 2, t0, beat * 8, 0.035);
    for (let i = 0; i < 8; i += 1) if (i % 4 !== 2) drum(c, musicGain, t0 + i * beat, i % 4 === 0);
    bar += 1;
  }

  return {
    music(on: boolean) {
      try {
        if (on && musicTimer === null) {
          const c = ensure();
          musicGain = c.createGain();
          musicGain.gain.value = 0.5;
          musicGain.connect(c.destination);
          scheduleBar();
          musicTimer = window.setInterval(scheduleBar, 0.42 * 8 * 1000);
        } else if (!on && musicTimer !== null) {
          window.clearInterval(musicTimer);
          musicTimer = null;
          musicGain?.disconnect();
          musicGain = null;
        }
      } catch {
        /* audio unavailable */
      }
    },
    unlock() {
      try {
        ensure();
      } catch {
        /* ignore */
      }
    },
    play(kind: "place" | "road" | "collect" | "error" | "quest", mute: boolean) {
      // A light tap on phones that support it (set by the native app shell).
      soundHook?.(kind);
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
