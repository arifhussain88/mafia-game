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

const lobbyMusic = new Audio(`${import.meta.env.BASE_URL}audio/dark.mp3`);
lobbyMusic.loop = true;
lobbyMusic.preload = "auto";
lobbyMusic.volume = 0.42;

function getMuted(): boolean {
  try { return localStorage.getItem("mafia-muted") === "true"; } catch { return false; }
}

export function isMuted(): boolean { return getMuted(); }

export function setMuted(m: boolean): void {
  try { localStorage.setItem("mafia-muted", String(m)); } catch {}
}

export function playAudioCheck(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const play = () => {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.45, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.55);
  };

  if (ctx.state === "running") {
    play();
  } else {
    void ctx.resume().then(() => {
      if (ctx.state === "running") play();
    }).catch(() => {});
  }
}

export function playNightSting(): void {
  if (getMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 2.8;

  const osc1 = ctx.createOscillator();
  const env1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(72, now);
  osc1.frequency.exponentialRampToValueAtTime(48, now + dur);
  env1.gain.setValueAtTime(0, now);
  env1.gain.linearRampToValueAtTime(0.24, now + 0.5);
  env1.gain.linearRampToValueAtTime(0.15, now + 1.8);
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
  env2.gain.linearRampToValueAtTime(0.07, now + 0.9);
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
  env3.gain.linearRampToValueAtTime(0.04, now + 0.8);
  env3.gain.linearRampToValueAtTime(0, now + dur);
  osc3.connect(env3);
  env3.connect(ctx.destination);
  osc3.start(now + 0.3);
  osc3.stop(now + dur + 0.1);
}

export function playDayChime(): void {
  if (getMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const t = now + i * 0.2;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.2, t + 0.01);
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
    env2.gain.linearRampToValueAtTime(0.08, t + 0.01);
    env2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc2.connect(env2);
    env2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.4);
  });
}

export function playTimerAlert(): void {
  if (getMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  [0, 0.22, 0.44].forEach((offset) => {
    const t = now + offset;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.1, t + 0.005);
    env.gain.linearRampToValueAtTime(0.08, t + 0.13);
    env.gain.linearRampToValueAtTime(0, t + 0.16);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

export function startAmbientLoop(): void {
  if (getMuted()) return;
  lobbyMusic.volume = 0.42;
  void lobbyMusic.play().catch(() => {});
}

export function stopAmbientLoop(): void {
  lobbyMusic.pause();
}
