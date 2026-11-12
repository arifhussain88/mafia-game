let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!_ctx) {
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      _ctx = new AudioContextClass();
    }
    return _ctx;
  } catch {
    return null;
  }
}

export function unlockAudio(): void {
  const ctx = getCtx();
  if (ctx?.state === "suspended") void ctx.resume();
}

const DEFAULT_VOLUME = 0.6;

const lobbyMusic = new Audio(`${import.meta.env.BASE_URL}audio/dark.mp3`);
lobbyMusic.loop = true;
lobbyMusic.preload = "auto";
lobbyMusic.volume = DEFAULT_VOLUME;

function getMuted(): boolean {
  try { return localStorage.getItem("mafia-muted") === "true"; } catch { return false; }
}

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem("mafia-volume");
    if (raw == null) return DEFAULT_VOLUME;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, n));
  } catch {
    return DEFAULT_VOLUME;
  }
}

let lobbyVolume = readStoredVolume();
lobbyMusic.volume = lobbyVolume;

export function isMuted(): boolean { return getMuted(); }

export function getLobbyVolume(): number {
  return lobbyVolume;
}

export function setLobbyVolume(v: number): void {
  lobbyVolume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem("mafia-volume", String(lobbyVolume)); } catch {}
  lobbyMusic.volume = lobbyVolume;
  if (lobbyVolume === 0) {
    if (!getMuted()) {
      setMuted(true);
      try { window.dispatchEvent(new CustomEvent("mafia-muted-changed", { detail: true })); } catch {}
    } else {
      lobbyMusic.pause();
    }
  } else if (getMuted()) {
    setMuted(false);
    try { window.dispatchEvent(new CustomEvent("mafia-muted-changed", { detail: false })); } catch {}
  }
}

export function setMuted(m: boolean): void {
  try { localStorage.setItem("mafia-muted", String(m)); } catch {}
  if (m) lobbyMusic.pause();
  else lobbyMusic.volume = lobbyVolume;
}

function sfxGain(): number {
  if (getMuted()) return 0;
  return Math.max(0.08, lobbyVolume);
}

function withAudio(play: (ctx: AudioContext, now: number, level: number) => void): void {
  if (getMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const level = sfxGain();
  const run = () => play(ctx, ctx.currentTime, level);
  if (ctx.state === "running") {
    run();
  } else {
    void ctx.resume().then(() => {
      if (ctx.state === "running") run();
    }).catch(() => {});
  }
}

/** Royalty-free: synthesized in-browser. No third-party audio asset. */
export function playAudioCheck(): void {
  withAudio((ctx, now, level) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.45 * level, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.55);
  });
}

/** Royalty-free: synthesized in-browser. No third-party audio asset. */
export function playCountdownTick(): void {
  withAudio((ctx, now, level) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.35 * level, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    const click = ctx.createOscillator();
    const clickEnv = ctx.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(1760, now);
    clickEnv.gain.setValueAtTime(0.0001, now);
    clickEnv.gain.exponentialRampToValueAtTime(0.12 * level, now + 0.005);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    click.connect(clickEnv);
    clickEnv.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.09);
  });
}

/** Tiny soft blip for an incoming chat message. */
export function playChatPing(): void {
  withAudio((ctx, now, level) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.18 * level, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  });
}

export type KeyStroke = {
  /** Seconds after the typing starts. */
  at: number;
  kind: KeyKind;
};

/* ---------------- Mechanical keyboard ----------------
 * Each key sound is rendered once into a short buffer (a few variants per key
 * type) and replayed with tiny pitch/level changes. Built from damped
 * resonances, like a real keycap and switch:
 *   - a sharp plastic "tick" (high modes, a few ms),
 *   - the "thock" as the key bottoms out (low body resonance),
 *   - a quieter release click as the key springs back.
 * Synthesized in-browser; no audio asset.
 */
type KeyKind = "key" | "space" | "enter";
const keyVoices = new Map<string, AudioBuffer[]>();

function renderKey(ctx: AudioContext, kind: KeyKind, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const seconds = kind === "key" ? 0.09 : 0.14;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  // Stable per-variant detune of about +/-6%.
  const rnd = (n: number) => 1 + Math.sin(seed * 12.9898 + n * 78.233) * 0.06;

  const tick: number[][] = kind === "key"
    ? [[2100, 0.009, 0.55], [3300, 0.006, 0.4], [4700, 0.004, 0.28], [6800, 0.0025, 0.15]]
    : [[1500, 0.012, 0.5], [2400, 0.008, 0.35], [3900, 0.005, 0.22]];
  const body: number[][] = kind === "key" ? [[210, 0.016, 0.55], [430, 0.009, 0.25]]
    : kind === "space" ? [[135, 0.03, 0.7], [290, 0.016, 0.3]]
    : [[160, 0.026, 0.8], [340, 0.014, 0.35]];
  const releaseAt = (kind === "key" ? 0.042 : 0.07) * rnd(9);
  const release: number[][] = kind === "key"
    ? [[3900, 0.004, 0.16], [5600, 0.0025, 0.1]]
    : [[2800, 0.006, 0.18], [4200, 0.004, 0.1]];

  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    // Contact transient: about 1 ms of bright noise.
    const n = Math.random() * 2 - 1;
    s += (n - lp) * Math.exp(-t / 0.0007) * 0.6;
    lp += 0.2 * (n - lp);
    tick.forEach(([f, tau, amp], k) => { s += Math.sin(2 * Math.PI * f * rnd(k) * t) * Math.exp(-t / tau) * amp; });
    const tb = t - 0.004; // the bottom-out lands a few ms after the tick
    if (tb > 0) {
      body.forEach(([f, tau, amp], k) => { s += Math.sin(2 * Math.PI * f * rnd(k + 5) * tb) * Math.exp(-tb / tau) * amp; });
      if (kind !== "key") s += (Math.random() * 2 - 1) * Math.exp(-tb / 0.012) * 0.08; // stabiliser rattle
    }
    const tr = t - releaseAt;
    if (tr > 0) release.forEach(([f, tau, amp], k) => { s += Math.sin(2 * Math.PI * f * rnd(k + 11) * tr) * Math.exp(-tr / tau) * amp; });
    d[i] = s;
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  const fade = Math.max(1, Math.floor(sr * 0.0004));
  for (let i = 0; i < len; i++) d[i] = (d[i] / (peak || 1)) * 0.9 * (i < fade ? i / fade : 1);
  return buf;
}

function keyVoice(ctx: AudioContext, kind: KeyKind): AudioBuffer {
  const id = kind + "@" + ctx.sampleRate;
  let voices = keyVoices.get(id);
  if (!voices) {
    voices = Array.from({ length: kind === "key" ? 6 : 3 }, (_, v) => renderKey(ctx, kind, v + 1));
    keyVoices.set(id, voices);
  }
  return voices[Math.floor(Math.random() * voices.length)];
}

/** One key press at AudioContext time t. */
function keyPress(ctx: AudioContext, out: AudioNode, t: number, kind: KeyKind, nodes: AudioScheduledSourceNode[]) {
  const src = ctx.createBufferSource();
  src.buffer = keyVoice(ctx, kind);
  src.playbackRate.setValueAtTime(0.97 + Math.random() * 0.06, t);
  const g = ctx.createGain();
  const level = kind === "key" ? 0.55 : kind === "space" ? 0.6 : 0.8;
  g.gain.setValueAtTime(level * (0.82 + Math.random() * 0.3), t);
  src.connect(g).connect(out);
  src.start(t);
  nodes.push(src);
}

/** How long the device takes to actually play a scheduled sound (Android can be 100 ms or more). */
function outputDelay(ctx: AudioContext): number {
  const c = ctx as AudioContext & { outputLatency?: number };
  return Math.min(0.25, (c.outputLatency || 0) + (ctx.baseLatency || 0));
}

/**
 * Schedule a run of key presses on the Web Audio clock (sample-accurate, no
 * timer drift, keeps going in background tabs). `startedAt` is the
 * performance.now() moment the visual typing started, so audio that had to
 * wait for the context to resume skips ahead instead of lagging the text.
 * Returns a cancel function. Synthesized in-browser; no audio asset.
 */
export function scheduleKeyStrokes(strokes: KeyStroke[], startedAt: number): () => void {
  const nodes: AudioScheduledSourceNode[] = [];
  let master: GainNode | null = null;
  let cancelled = false;

  withAudio((ctx, now, level) => {
    if (cancelled) return;
    // Start each sound early by the device's output delay, so the key is
    // heard the moment its letter appears, not a beat later.
    const lag = (performance.now() - startedAt) / 1000 + outputDelay(ctx);
    master = ctx.createGain();
    master.gain.setValueAtTime(0.45 * level, now);
    // Gentle limiter: overlapping fast keystrokes never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-14, now);
    limiter.ratio.setValueAtTime(6, now);
    master.connect(limiter);
    limiter.connect(ctx.destination);
    for (const s of strokes) {
      const at = s.at - lag;
      if (at < -0.03) continue; // already shown on screen; don't play late
      keyPress(ctx, master, now + Math.max(0, at), s.kind, nodes);
    }
  });

  const onMute = (e: Event) => {
    if ((e as CustomEvent<boolean>).detail) cancel();
  };
  window.addEventListener("mafia-muted-changed", onMute);

  function cancel() {
    cancelled = true;
    window.removeEventListener("mafia-muted-changed", onMute);
    for (const n of nodes) {
      try { n.stop(); } catch { /* already stopped */ }
    }
    nodes.length = 0;
    try { master?.disconnect(); } catch { /* ignore */ }
  }
  return cancel;
}

/* ---------------- Gunshot, vote-out impact, Mafia "target locked" ---------------- */

/**
 * Optional recorded gunshot. Drop a CC0 / public-domain file at
 * public/audio/gunshot.mp3 (record its source in public/audio/README.md) and
 * it replaces the synthesized shot below; if it's missing, the synth plays.
 */
const GUNSHOT_URL = `${import.meta.env.BASE_URL}audio/gunshot.mp3`;
let gunshotSample: AudioBuffer | null = null;
let gunshotLoading = false;

/** Fetch + decode the optional sample once, ahead of time, so the shot never lags. */
export function preloadGunshot(): void {
  if (gunshotSample || gunshotLoading) return;
  const ctx = getCtx();
  if (!ctx) return;
  gunshotLoading = true;
  fetch(GUNSHOT_URL)
    .then((res) => {
      const type = res.headers.get("content-type") ?? "";
      // The dev server and SPA fallback answer missing files with index.html.
      if (!res.ok || type.includes("text/html")) throw new Error("no sample");
      return res.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => { gunshotSample = buffer; })
    .catch(() => { /* synth fallback */ })
    .finally(() => { gunshotLoading = false; });
}

let reverbImpulse: AudioBuffer | null = null;
/** A short "night street" echo: decaying stereo noise used as a convolution reverb. */
function getReverb(ctx: AudioContext): AudioBuffer {
  if (reverbImpulse && reverbImpulse.sampleRate === ctx.sampleRate) return reverbImpulse;
  const seconds = 1.6;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // Fast early reflections, then a long soft tail.
      const early = i < ctx.sampleRate * 0.04 ? 0.6 : 0;
      d[i] = (Math.random() * 2 - 1) * (Math.pow(1 - t, 3.2) * 0.5 + early * (1 - t));
    }
  }
  reverbImpulse = buf;
  return buf;
}

function decayingNoise(ctx: AudioContext, seconds: number, shape: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, shape);
  return buf;
}

/** Output chain for big hits: dry + reverb send, then a limiter so it's loud but never clips. */
function hitBus(ctx: AudioContext, t: number, level: number, wet: number) {
  const input = ctx.createGain();
  input.gain.setValueAtTime(level, t);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-8, t);
  limiter.knee.setValueAtTime(4, t);
  limiter.ratio.setValueAtTime(12, t);
  limiter.attack.setValueAtTime(0.001, t);
  limiter.release.setValueAtTime(0.2, t);
  const verb = ctx.createConvolver();
  verb.buffer = getReverb(ctx);
  const wetGain = ctx.createGain();
  wetGain.gain.setValueAtTime(wet, t);
  input.connect(limiter);
  input.connect(verb);
  verb.connect(wetGain);
  wetGain.connect(limiter);
  limiter.connect(ctx.destination);
  return input;
}

let gunshotVoice: AudioBuffer | null = null;

/**
 * Synthesized pistol shot, rendered once: a supersonic crack, the muzzle
 * blast, a low boom you feel, and two slap-back echoes off the buildings.
 */
function renderGunshot(ctx: AudioContext): AudioBuffer {
  if (gunshotVoice && gunshotVoice.sampleRate === ctx.sampleRate) return gunshotVoice;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 1.1);
  const dry = new Float32Array(len);
  let lp1 = 0;
  let lp2 = 0;
  let hpPrev = 0;
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const n = Math.random() * 2 - 1;
    // Crack: a 1-2 ms bright snap with a sharp leading edge.
    const hp = n - hpPrev;
    hpPrev = n;
    let s = hp * Math.exp(-t / 0.0016) * 1.6;
    if (t < 0.0008) s += 1.2 * (1 - t / 0.0004);
    // Blast: noise that starts bright and gets duller as it decays.
    const cutoff = 0.08 + 0.5 * Math.exp(-t / 0.02);
    lp1 += cutoff * (n - lp1);
    lp2 += cutoff * (lp1 - lp2);
    s += lp2 * Math.exp(-t / 0.07) * 3.2;
    // Mid "pop" of the muzzle.
    s += Math.sin(2 * Math.PI * 950 * t) * Math.exp(-t / 0.01) * 0.35;
    // Boom: a falling low thump.
    const f = 42 + 80 * Math.exp(-t / 0.05);
    phase += (2 * Math.PI * f) / sr;
    s += Math.sin(phase) * Math.exp(-t / 0.13) * 1.1 * Math.min(1, t / 0.002);
    dry[i] = s;
  }
  const out = Float32Array.from(dry);
  // Two street echoes, darker and quieter each time.
  const echo = (delay: number, gain: number, smooth: number) => {
    const off = Math.floor(sr * delay);
    let y = 0;
    for (let i = off; i < len; i++) {
      y += smooth * (dry[i - off] - y);
      out[i] += y * gain;
    }
  };
  echo(0.19, 0.32, 0.18);
  echo(0.43, 0.16, 0.1);
  // Saturate for loudness without harsh clipping, then normalise.
  let peak = 0;
  for (let i = 0; i < len; i++) {
    out[i] = Math.tanh(out[i] * 1.6);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (out[i] / (peak || 1)) * 0.95;
  gunshotVoice = buf;
  return buf;
}

function synthGunshot(ctx: AudioContext, t: number, out: AudioNode, nodes?: AudioScheduledSourceNode[]): void {
  const src = ctx.createBufferSource();
  src.buffer = renderGunshot(ctx);
  src.playbackRate.setValueAtTime(0.96 + Math.random() * 0.06, t);
  src.connect(out);
  src.start(t);
  nodes?.push(src);
}

/**
 * Play a gunshot at `at` (AudioContext time; default now). Uses the recorded
 * sample when present, otherwise the synth. Synthesized fallback is original
 * work: no third-party audio.
 */
export function playGunshotAt(ctx: AudioContext, at: number, level: number, nodes?: AudioScheduledSourceNode[]): void {
  const out = hitBus(ctx, at, 0.95 * level, gunshotSample ? 0.15 : 0.28);
  if (gunshotSample) {
    const src = ctx.createBufferSource();
    src.buffer = gunshotSample;
    src.connect(out);
    src.start(at);
    nodes?.push(src);
    return;
  }
  synthGunshot(ctx, at, out, nodes);
}

/** The Mafia's shot, heard by the whole room the moment their turn ends. */
export function playMafiaKill(): void {
  withAudio((ctx, now, level) => playGunshotAt(ctx, now, Math.max(0.5, level)));
}

/** Day vote-out: a deep, heavy impact — distinct from the Mafia's gunshot. */
export function playVoteOutImpact(): void {
  withAudio((ctx, now, level) => {
    const out = hitBus(ctx, now, 0.8 * level, 0.45);
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(90, now);
    thud.frequency.exponentialRampToValueAtTime(32, now + 0.6);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(1.2, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    thud.connect(env).connect(out);
    thud.start(now);
    thud.stop(now + 0.95);

    const body = ctx.createBufferSource();
    body.buffer = decayingNoise(ctx, 0.5, 2.5);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, now);
    lp.frequency.exponentialRampToValueAtTime(120, now + 0.4);
    const bodyEnv = ctx.createGain();
    bodyEnv.gain.setValueAtTime(0.0001, now);
    bodyEnv.gain.exponentialRampToValueAtTime(0.7, now + 0.006);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    body.connect(lp).connect(bodyEnv).connect(out);
    body.start(now);
  });
}

/** Mafia only, on their own device: a quiet metallic double click when a target is locked in. */
export function playTargetLocked(): void {
  withAudio((ctx, now, level) => {
    [0, 0.07].forEach((offset, i) => {
      const t = now + offset;
      const src = ctx.createBufferSource();
      src.buffer = decayingNoise(ctx, 0.03, 6);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(i === 0 ? 3200 : 2400, t);
      bp.Q.setValueAtTime(4, t);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.35 * level, t + 0.001);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      src.connect(bp).connect(env).connect(ctx.destination);
      src.start(t);
    });
  });
}

export function playNightSting(): void {
  withAudio((ctx, now, level) => {
    const dur = 2.8;

    const osc1 = ctx.createOscillator();
    const env1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(72, now);
    osc1.frequency.exponentialRampToValueAtTime(48, now + dur);
    env1.gain.setValueAtTime(0, now);
    env1.gain.linearRampToValueAtTime(0.24 * level, now + 0.5);
    env1.gain.linearRampToValueAtTime(0.15 * level, now + 1.8);
    env1.gain.linearRampToValueAtTime(0, now + dur);
    osc1.connect(env1);
    env1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + dur + 0.1);

    const osc2 = ctx.createOscillator();
    const env2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(144, now);
    osc2.frequency.exponentialRampToValueAtTime(100, now + dur);
    env2.gain.setValueAtTime(0, now);
    env2.gain.linearRampToValueAtTime(0.07 * level, now + 0.9);
    env2.gain.linearRampToValueAtTime(0, now + dur);
    osc2.connect(env2);
    env2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + dur + 0.1);

    const osc3 = ctx.createOscillator();
    const env3 = ctx.createGain();
    osc3.type = "sawtooth";
    osc3.frequency.setValueAtTime(108, now + 0.3);
    osc3.frequency.exponentialRampToValueAtTime(72, now + dur);
    env3.gain.setValueAtTime(0, now + 0.3);
    env3.gain.linearRampToValueAtTime(0.04 * level, now + 0.8);
    env3.gain.linearRampToValueAtTime(0, now + dur);
    osc3.connect(env3);
    env3.connect(ctx.destination);
    osc3.start(now + 0.3);
    osc3.stop(now + dur + 0.1);
  });
}

export function playDayChime(): void {
  withAudio((ctx, now, level) => {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const t = now + i * 0.2;

      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.2 * level, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.0);

      const osc2 = ctx.createOscillator();
      const env2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 2.756, t);
      env2.gain.setValueAtTime(0, t);
      env2.gain.linearRampToValueAtTime(0.08 * level, t + 0.01);
      env2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc2.connect(env2);
      env2.connect(ctx.destination);
      osc2.start(t);
      osc2.stop(t + 0.4);
    });
  });
}

export function playTimerAlert(): void {
  withAudio((ctx, now, level) => {
    [0, 0.22, 0.44].forEach((offset) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.1 * level, t + 0.005);
      env.gain.linearRampToValueAtTime(0.08 * level, t + 0.13);
      env.gain.linearRampToValueAtTime(0, t + 0.16);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  });
}

export function startAmbientLoop(): void {
  if (getMuted() || lobbyVolume <= 0) return;
  lobbyMusic.volume = lobbyVolume;
  void lobbyMusic.play().catch(() => {});
}

export function stopAmbientLoop(): void {
  lobbyMusic.pause();
}
