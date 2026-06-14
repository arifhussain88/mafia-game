let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!_ctx) _ctx = new AudioContext();
    if (_ctx.state === "suspended") void _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

function getMuted(): boolean {
  try { return localStorage.getItem("mafia-muted") === "true"; } catch { return false; }
}

export function isMuted(): boolean { return getMuted(); }

export function setMuted(m: boolean): void {
  try { localStorage.setItem("mafia-muted", String(m)); } catch {}
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
