import { Router } from "express";
import { persistMatchEnd } from "../lib/game-persist";
import { getUserForToken } from "../lib/user-store";

/**
 * Development helpers. Mounted only when NODE_ENV is not "production"
 * (see app.ts), so none of this exists on the live server.
 */
const router = Router();

const ROLES = ["mafia", "detective", "doctor", "civilian", "civilian"] as const;
const OTHERS = ["Marco", "Lena", "Dev", "Rosa", "Viktor", "Nadia", "Sal", "Iris"];
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

/** POST /api/dev/demo-history: adds ~14 realistic past matches for the signed-in player. */
router.post("/demo-history", async (req, res) => {
  const header = req.headers.authorization ?? "";
  const user = await getUserForToken(header.startsWith("Bearer ") ? header.slice(7) : null);
  if (!user) return res.status(401).json({ message: "Sign in first" });

  const count = 14;
  let t = Date.now() - 45 * 60 * 1000;
  for (let i = 0; i < count; i++) {
    const role = pick(ROLES);
    const isMafia = role === "mafia";
    const draw = i === 6;
    const won = !draw && Math.random() < (role === "detective" ? 0.7 : 0.55);
    const alive = won ? Math.random() < 0.7 : Math.random() < 0.3;
    const day = 1 + Math.floor(Math.random() * 3);
    const winner = draw ? "draw" : won === isMafia ? "mafia" : "civilians";
    const me = {
      userId: user.id,
      name: user.name,
      role,
      alive,
      outcome: alive ? "survived" : Math.random() < 0.5 ? `killed night ${day}` : `voted out day ${day}`,
      saves: role === "doctor" ? Math.floor(Math.random() * 3) : 0,
      mafiaFound: role === "detective" && (won || Math.random() < 0.3) ? 1 : 0,
      kills: isMafia ? 1 + Math.floor(Math.random() * 3) : 0,
    };
    const others = OTHERS.slice(0, 5).map((name, k) => ({
      name,
      role: k === 0 && !isMafia ? "mafia" : "civilian",
      alive: Math.random() < 0.5,
    }));
    persistMatchEnd({
      roomCode: `DEMO${i}`.slice(0, 5),
      winner: winner as "mafia" | "civilians" | "draw",
      players: [me, ...others],
      endedAt: new Date(t),
    });
    t -= (2 + Math.random() * 20) * 60 * 60 * 1000; // a couple of hours to a day apart
  }
  return res.json({ ok: true, added: count });
});

export default router;
