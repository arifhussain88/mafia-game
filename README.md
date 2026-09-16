# 🎭 Mafia Wars

A real-time multiplayer social deduction game built with React, Socket.IO, and Express. Players are secretly assigned roles — **Mafia**, **Doctor**, **Detective**, or **Civilian** — and must figure out who is who before the Mafia eliminates everyone.

> **Target platforms:** Google Play Store (first), then Apple App Store.  
> This guide covers local development, testing, and sharing the game with testers before the final build.

---

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Quick Start (Local)](#-quick-start-local)
- [How to Play](#-how-to-play)
- [Sharing with Testers](#-sharing-with-testers)
- [Project Structure](#-project-structure)
- [Common Issues](#-common-issues)
- [Tech Stack](#-tech-stack)

---

## 🔧 Prerequisites

Make sure these are installed on your machine:

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 20+ (24 recommended) | [nodejs.org](https://nodejs.org/) |
| **pnpm** | 9+ | `npm install -g pnpm` |
| **Git** | any | [git-scm.com](https://git-scm.com/) |

> [!NOTE]
> This project **requires pnpm** — it will refuse to install with npm or yarn.

---

## 🚀 Quick Start (Local)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/Mafia-Wars.git
cd Mafia-Wars
```

### 2. Install dependencies

```bash
# Install packages
pnpm install

# If prompted with ERR_PNPM_IGNORED_BUILDS, approve dependencies to build:
pnpm approve-builds --all
```

### 3. Start the API server (Terminal 1)

```bash
pnpm --filter @workspace/api-server run dev
```

You should see output like:
```
Server listening on port 3001
```

### 4. Start the frontend dev server (Terminal 2)

```bash
pnpm --filter @workspace/game-lobby run dev
```

You should see output like:
```
  VITE v7.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
```

You should see:
```
  VITE v7.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### 5. Open the game

Open **http://localhost:5173** in your browser. That's it — you're in!

> [!IMPORTANT]
> The frontend connects to the API server via Socket.IO on `/socket.io`. By default Vite will proxy WebSocket requests to the same origin. If the API server runs on a different port/host, you may need to configure the Vite proxy or update the `io()` connection URL in `App.tsx`.

---

## 🎮 How to Play

### Minimum Players: **5**

### Game Flow

```
Home → Create/Join Room → Lobby → Role Reveal → Night Phase → Night Summary
  → Day Discussion → Day Vote → Elimination Reveal → (repeat or Game Over)
```

### Step-by-Step

1. **Create a Room** — Enter your display name and tap *Create Room*. Share the 5-character room code with friends.
2. **Join a Room** — Enter the room code and your name, then tap *Join Room*.
3. **Lobby** — The host waits for all players (min 5) and taps *Start Game*.
4. **Role Reveal** — Each player secretly sees their role for 6 seconds:
   - 🔴 **Mafia** (1–2 players) — Eliminate townspeople each night.
   - 🟢 **Doctor** (1 player) — Protect one person each night.
   - 🟡 **Detective** (1 player) — Investigate one person each night to learn if they're Mafia.
   - ⚪ **Civilian** (remaining) — Survive and vote out Mafia during the day.
5. **Night Phase** — Mafia picks a target → Doctor picks someone to protect → Detective investigates.
6. **Night Summary** — A dramatic typewriter reveals what happened overnight.
7. **Day Discussion** (60s) — Everyone discusses and debates who is suspicious.
8. **Day Vote** (30s) — Tap a player to vote them out. Majority vote eliminates immediately.
9. **Elimination Reveal** — See who was voted out (or if it was a tie/skip).
10. **Repeat** — Night and Day alternate until one side wins.

### Win Conditions

| Side | Condition |
|------|-----------|
| **Mafia wins** | Mafia members ≥ remaining townspeople |
| **Civilians win** | All Mafia members are eliminated |

---

## 🌐 Sharing with Testers

Since the game is multiplayer and requires at least 5 players on the **same server**, you need a way to expose your local server to others. Here are the recommended methods, from easiest to most robust:

---

### Option 1: Same Wi-Fi / LAN (Simplest)

If all testers are on the **same local network** (same Wi-Fi, office, etc.):

1. Start both servers as described above.
2. Find your local IP:
   ```bash
   # Windows
   ipconfig
   # Look for "IPv4 Address" under your Wi-Fi/Ethernet adapter (e.g., 192.168.1.42)

   # macOS / Linux
   ifconfig | grep "inet "
   ```
3. Share `http://<YOUR-LOCAL-IP>:5173` with testers (e.g., `http://192.168.1.42:5173`).
4. Everyone opens that URL on their phone or laptop browser.
5. One person creates a room, shares the 5-character code, and others join.

> [!TIP]
> Vite already binds to `0.0.0.0`, so LAN devices can connect immediately — no extra config needed.

---

### Option 2: ngrok (Share Over the Internet — Recommended for Remote Testers)

[ngrok](https://ngrok.com/) creates a secure public tunnel to your local machine.

#### Setup (one-time)

1. Sign up at [ngrok.com](https://ngrok.com/) (free tier is fine).
2. Download and install ngrok:
   ```bash
   # Windows (with Chocolatey)
   choco install ngrok

   # macOS (with Homebrew)
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```
3. Authenticate:
   ```bash
   ngrok config add-authtoken <YOUR_AUTH_TOKEN>
   ```

#### Run

1. Start both servers locally (see [Quick Start](#-quick-start-local)).
2. In a **third terminal**, expose the API server:
   ```bash
   ngrok http 5000
   ```
3. ngrok gives you a public URL like `https://abc123.ngrok-free.app`.
4. Update the frontend Socket.IO connection to use the ngrok URL. Open `artifacts/game-lobby/src/App.tsx` and temporarily change:
   ```typescript
   // FROM:
   const socket = io({ path: "/socket.io" });
   
   // TO:
   const socket = io("https://abc123.ngrok-free.app", { path: "/socket.io" });
   ```
5. Now expose the frontend too (in a **fourth terminal**):
   ```bash
   ngrok http 5173
   ```
6. Share the second ngrok URL (e.g., `https://def456.ngrok-free.app`) with your testers.

> [!WARNING]
> **Don't commit the hardcoded ngrok URL** — revert it before pushing code.  
> The free ngrok tier gives you one tunnel at a time. Use the paid plan or see the alternative below for two simultaneous tunnels.

#### Alternative: Single-tunnel approach

If you configure Vite to proxy API requests, you only need one ngrok tunnel for the frontend:

Add this to `vite.config.ts` inside the `server` block:
```typescript
proxy: {
  '/socket.io': {
    target: 'http://localhost:5000',
    ws: true,
  },
},
```
Then you only need `ngrok http 5173` — the frontend tunnel handles both the UI and the WebSocket proxy.

---

### Option 3: Cloudflare Tunnel (Free, No Account Needed for Quick Tests)

```bash
# Install cloudflared
# Windows: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
# macOS: brew install cloudflare/cloudflare/cloudflared

# Quick tunnel (no account needed!)
cloudflared tunnel --url http://localhost:5173
```

This instantly gives you a `https://xxxxx.trycloudflare.com` URL. Same proxy note as ngrok applies — set up the Vite proxy so Socket.IO works through the same tunnel.

---

### Option 4: VS Code Port Forwarding (If Using VS Code)

1. Open the project in VS Code.
2. Open the **Ports** panel (View → Terminal → Ports tab).
3. Forward ports **5000** and **5173**.
4. Set visibility to **Public**.
5. Share the generated `*.devtunnels.ms` URLs with testers.

---

## 📁 Project Structure
## 📁 Project Structure

```
Mafia-Wars/
├── artifacts/
│   ├── api-server/              # Express + Socket.IO backend
│   │   ├── src/
│   │   │   ├── index.ts         # Server entry — creates HTTP & Socket.IO
│   │   │   ├── app.ts           # Express app config
│   │   │   ├── socket-handlers.ts  # ⭐ Core game logic (all phases, voting, timers)
│   │   │   ├── routes/          # REST API routes
│   │   │   └── lib/             # Logger, utilities
│   │   ├── build.mjs            # esbuild config
│   │   └── package.json
│   │
│   └── game-lobby/              # React + Vite frontend
│       ├── src/
│       │   ├── App.tsx           # ⭐ Main app — state management, socket events
│       │   ├── pages/
│       │   │   ├── Home.tsx      # Create / Join room
│       │   │   ├── Lobby.tsx     # Waiting room
│       │   │   ├── RoleReveal.tsx
│       │   │   ├── NightPhase.tsx
│       │   │   ├── NightSummary.tsx
│       │   │   ├── DayPhase.tsx
│       │   │   ├── EliminationReveal.tsx
│       │   │   └── GameOver.tsx
│       │   ├── components/
│       │   │   ├── PlayerCircle.tsx  # Circular player layout for voting
│       │   │   ├── MuteToggle.tsx
│       │   │   └── ui/              # Radix UI primitives
│       │   ├── hooks/
│       │   │   ├── useCountdown.ts
│       │   │   └── useCircleSize.ts
│       │   └── lib/
│       │       └── audio.ts      # Sound effects
│       ├── vite.config.ts
│       └── package.json
│
├── lib/                          # Shared workspace packages
│   ├── api-client-react/         # Generated API hooks
│   ├── api-spec/                 # OpenAPI specification
│   ├── api-zod/                  # Zod validation schemas
│   └── db/                       # Drizzle ORM / DB schema
│
├── pnpm-workspace.yaml           # Monorepo workspace config
├── package.json                  # Root scripts
└── README.md                     # ← You are here
```

---

## ❗ Common Issues

### "PORT environment variable is required"
Both the API server and the Vite dev server require a `PORT` env var. See the [Quick Start](#-quick-start-local) commands above.

### "BASE_PATH environment variable is required"
The Vite config requires `BASE_PATH`. Set it to `/` for local development.

### WebSocket connection failed
- Make sure the API server is running on port 5000 before starting the frontend.
- If using ngrok or tunnels, ensure you've either updated the Socket.IO connection URL or configured the Vite proxy.

### Game stuck on second round
This was a known bug where the night phase would hang for 30–60 seconds if the Doctor or Detective was eliminated. **This has been fixed** — the server now uses shorter timers for dead roles.

### "Use pnpm instead" error
The project enforces pnpm. Run `npm install -g pnpm` and then use `pnpm install` instead of `npm install`.

### Minimum 5 players required
The game requires at least 5 players to start. For solo testing, open 5 browser tabs/windows to the same URL and create 5 different players.

> [!TIP]
> **Quick solo-testing trick:** Open 5 incognito/private windows (or different browsers) pointing at the same URL. Each window gets a unique Socket.IO connection, so they count as separate players.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, Tailwind CSS 4, Radix UI, Framer Motion |
| **Backend** | Node.js, Express 5, Socket.IO |
| **Build** | esbuild, pnpm workspaces, TypeScript 5.9 |
| **Fonts** | Inter (Google Fonts) |
| **Audio** | Web Audio API (procedural sound effects) |

---

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm --filter @workspace/api-server run dev` | Build & start the API server |
| `pnpm --filter @workspace/game-lobby run dev` | Start the frontend dev server |
| `pnpm --filter @workspace/game-lobby run build` | Production build of the frontend |

---

## 📄 License

MIT
