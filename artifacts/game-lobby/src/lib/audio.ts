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

const DEFAULT_VOLUME = 0.42;

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

/** Soft mechanical key — short enough to fire once per revealed character. */
export function playTypewriterTick(): void {
  withAudio((ctx, now, level) => {
    const noiseLen = Math.max(1, Math.floor(ctx.sampleRate * 0.014));
    const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      const t = i / noiseLen;
      data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(620 + Math.random() * 90, now);
    filter.Q.setValueAtTime(1.1, now);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.16 * level, now + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    noise.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.032);

    const thock = ctx.createOscillator();
    const thockEnv = ctx.createGain();
    thock.type = "triangle";
    thock.frequency.setValueAtTime(168 + Math.random() * 36, now);
    thock.frequency.exponentialRampToValueAtTime(110, now + 0.03);
    thockEnv.gain.setValueAtTime(0.0001, now);
    thockEnv.gain.exponentialRampToValueAtTime(0.14 * level, now + 0.002);
    thockEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.036);
    thock.connect(thockEnv);
    thockEnv.connect(ctx.destination);
    thock.start(now);
    thock.stop(now + 0.04);
  });
}

/** Muffled shot: low thump plus a short dull crack. Synthesized. No sample file. */
function playMuffledGunshot(ctx: AudioContext, now: number, level: number): void {
  const len = Math.max(1, Math.floor(ctx.sampleRate * 0.07));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(480, now);
  filter.frequency.exponentialRampToValueAtTime(180, now + 0.08);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.7 * level, now + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  noise.connect(filter);
  filter.connect(env);
  env.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.11);

  const thump = ctx.createOscillator();
  const thumpEnv = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(92, now);
  thump.frequency.exponentialRampToValueAtTime(46, now + 0.12);
  thumpEnv.gain.setValueAtTime(0.0001, now);
  thumpEnv.gain.exponentialRampToValueAtTime(0.62 * level, now + 0.008);
  thumpEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  thump.connect(thumpEnv);
  thumpEnv.connect(ctx.destination);
  thump.start(now);
  thump.stop(now + 0.18);
}

/** Short stab: a soft pitch drop and a dull impact. Synthesized. No sample file. */
function playStab(ctx: AudioContext, now: number, level: number): void {
  const len = Math.max(1, Math.floor(ctx.sampleRate * 0.04));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    data[i] = (Math.random() * 2 - 1) * (1 - t);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(360, now);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.48 * level, now + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  noise.connect(filter);
  filter.connect(env);
  env.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.08);

  const blade = ctx.createOscillator();
  const bladeEnv = ctx.createGain();
  blade.type = "sine";
  blade.frequency.setValueAtTime(168, now);
  blade.frequency.exponentialRampToValueAtTime(58, now + 0.12);
  bladeEnv.gain.setValueAtTime(0.0001, now);
  bladeEnv.gain.exponentialRampToValueAtTime(0.5 * level, now + 0.006);
  bladeEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  blade.connect(bladeEnv);
  bladeEnv.connect(ctx.destination);
  blade.start(now);
  blade.stop(now + 0.16);
}

/** Copyright-free kill hit. Gunshot or stab, chosen at random. No third-party sample. */
export function playMafiaKill(): void {
  withAudio((ctx, now, level) => {
    if (Math.random() < 0.5) playMuffledGunshot(ctx, now, level);
    else playStab(ctx, now, level);
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
