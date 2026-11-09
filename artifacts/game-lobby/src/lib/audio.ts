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
  /** "gunshot" marks the Mafia kill, placed on the same clock as the typing. */
  kind: "key" | "space" | "enter" | "gunshot";
};

let noiseBuffer: AudioBuffer | null = null;
function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.25);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** Short filtered noise burst: the "tick" of a switch or the keycap hitting the plate. */
function noiseBurst(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  opts: { freq: number; q: number; peak: number; decay: number },
  nodes: AudioScheduledSourceNode[],
) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(opts.freq, t);
  bp.Q.setValueAtTime(opts.q, t);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(opts.peak, t + 0.0012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
  src.connect(bp);
  bp.connect(env);
  env.connect(out);
  // Random offset into the shared buffer so no two clicks are identical.
  src.start(t, Math.random() * 0.2, opts.decay + 0.01);
  nodes.push(src);
}

/** Low, fast-decaying body resonance: the "thock" when the key bottoms out. */
function thock(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  opts: { freq: number; peak: number; decay: number },
  nodes: AudioScheduledSourceNode[],
) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(opts.freq, t);
  osc.frequency.exponentialRampToValueAtTime(opts.freq * 0.6, t + opts.decay);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(opts.peak, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
  osc.connect(env);
  env.connect(out);
  osc.start(t);
  osc.stop(t + opts.decay + 0.01);
  nodes.push(osc);
}

/** One mechanical key press: switch click + keycap thock + a softer release click. */
function keyPress(ctx: AudioContext, out: AudioNode, t: number, kind: KeyStroke["kind"], nodes: AudioScheduledSourceNode[]) {
  const vel = 0.8 + Math.random() * 0.35; // human-ish variation in how hard each key is hit
  if (kind === "key") {
    noiseBurst(ctx, out, t, { freq: 3400 + Math.random() * 1600, q: 1.4, peak: 0.55 * vel, decay: 0.018 }, nodes);
    thock(ctx, out, t + 0.003, { freq: 230 + Math.random() * 70, peak: 0.32 * vel, decay: 0.04 }, nodes);
    noiseBurst(ctx, out, t + 0.03 + Math.random() * 0.012, { freq: 5200, q: 2, peak: 0.12 * vel, decay: 0.01 }, nodes);
  } else if (kind === "space") {
    // Space bar: longer stabiliser rattle, deeper body.
    noiseBurst(ctx, out, t, { freq: 1900 + Math.random() * 400, q: 0.9, peak: 0.45 * vel, decay: 0.03 }, nodes);
    thock(ctx, out, t + 0.004, { freq: 140 + Math.random() * 25, peak: 0.42 * vel, decay: 0.07 }, nodes);
    noiseBurst(ctx, out, t + 0.045, { freq: 3000, q: 1.2, peak: 0.14 * vel, decay: 0.015 }, nodes);
  } else {
    // Enter: the heavy, satisfying one at the end of a line.
    noiseBurst(ctx, out, t, { freq: 2600, q: 1.1, peak: 0.7, decay: 0.028 }, nodes);
    thock(ctx, out, t + 0.004, { freq: 170, peak: 0.55, decay: 0.08 }, nodes);
    noiseBurst(ctx, out, t + 0.07, { freq: 4200, q: 1.6, peak: 0.18, decay: 0.014 }, nodes);
  }
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
    const lag = (performance.now() - startedAt) / 1000;
    master = ctx.createGain();
    master.gain.setValueAtTime(0.5 * level, now);
    // Gentle limiter: overlapping fast keystrokes never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-14, now);
    limiter.ratio.setValueAtTime(6, now);
    master.connect(limiter);
    limiter.connect(ctx.destination);
    for (const s of strokes) {
      const at = s.at - lag;
      if (at < -0.005) continue; // already shown on screen; don't play late
      if (s.kind === "gunshot") playGunshotAt(ctx, now + Math.max(0, at), level, nodes);
      else keyPress(ctx, master, now + Math.max(0, at), s.kind, nodes);
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

/** Synthesized pistol shot: muzzle crack, chest-hitting boom, and a street echo. */
function synthGunshot(ctx: AudioContext, t: number, out: AudioNode, nodes?: AudioScheduledSourceNode[]): void {
  // 1. Crack: very short bright noise transient.
  const crack = ctx.createBufferSource();
  crack.buffer = decayingNoise(ctx, 0.05, 4);
  const crackHp = ctx.createBiquadFilter();
  crackHp.type = "highpass";
  crackHp.frequency.setValueAtTime(1800, t);
  const crackEnv = ctx.createGain();
  crackEnv.gain.setValueAtTime(0.0001, t);
  crackEnv.gain.exponentialRampToValueAtTime(1.4, t + 0.0008);
  crackEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  crack.connect(crackHp).connect(crackEnv).connect(out);
  crack.start(t);

  // 2. Blast: broadband noise swept down from bright to dull, with saturation for punch.
  const blast = ctx.createBufferSource();
  blast.buffer = decayingNoise(ctx, 0.35, 2.2);
  const blastLp = ctx.createBiquadFilter();
  blastLp.type = "lowpass";
  blastLp.frequency.setValueAtTime(6500, t);
  blastLp.frequency.exponentialRampToValueAtTime(380, t + 0.25);
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(3 * x);
  }
  shaper.curve = curve;
  const blastEnv = ctx.createGain();
  blastEnv.gain.setValueAtTime(0.0001, t);
  blastEnv.gain.exponentialRampToValueAtTime(1.0, t + 0.002);
  blastEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  blast.connect(blastLp).connect(shaper).connect(blastEnv).connect(out);
  blast.start(t);

  // 3. Boom: low sine thump with a pitch drop (the "felt" part).
  const boom = ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(150, t);
  boom.frequency.exponentialRampToValueAtTime(38, t + 0.22);
  const boomEnv = ctx.createGain();
  boomEnv.gain.setValueAtTime(0.0001, t);
  boomEnv.gain.exponentialRampToValueAtTime(1.1, t + 0.004);
  boomEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  boom.connect(boomEnv).connect(out);
  boom.start(t);
  boom.stop(t + 0.32);
  nodes?.push(crack, blast, boom);
}

/**
 * Play a gunshot at `at` (AudioContext time; default now). Uses the recorded
 * sample when present, otherwise the synth. Synthesized fallback is original
 * work: no third-party audio.
 */
export function playGunshotAt(ctx: AudioContext, at: number, level: number, nodes?: AudioScheduledSourceNode[]): void {
  const out = hitBus(ctx, at, 0.9 * level, gunshotSample ? 0.15 : 0.35);
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

/** Immediate gunshot (kept for any caller that just wants the bang now). */
export function playMafiaKill(): void {
  withAudio((ctx, now, level) => playGunshotAt(ctx, now, level));
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
