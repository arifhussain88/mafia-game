# Mafia Wars - Development Guide

## Tech Stack Summary
React, Vite, Tailwind CSS, Node.js, Express, Socket.IO, pnpm workspaces.

## Game Description
A real-time multiplayer social deduction game where players are assigned roles such as Mafia, Doctor, Detective, and Civilian. The game alternates between night phases, where special roles perform secret actions, and day phases, where everyone discusses and votes to eliminate suspected Mafia members. The game continues until either the Mafia outnumbers the town or all Mafia members are eliminated.

---

## Features Checklist
- [x] Basic game structure with Express backend and React frontend.
- [x] Real-time multiplayer synchronization via Socket.IO.
- [x] Room creation and joining mechanics.
- [x] Game phase progression (Lobby, Night Phase, Day Phase, Game Over).
- [x] Host identity visually hidden from regular players.

---

## Changes Log

### July 16, 2026: Hide Host Identity & Add Dev Rules
- **Files Changed:**
  - `artifacts/game-lobby/src/pages/Lobby.tsx`
  - `artifacts/game-lobby/src/pages/GameStarted.tsx`
  - `.antigravity-rules`
- **What Changed & Why:** Removed the visual "HOST" badge from the player lists in the lobby and active game screens to ensure regular players cannot identify the host. The host's special controls (kick, start) remain functional and visible only to the host. Added new rules to `.antigravity-rules` to enforce the usage of this `DEV_GUIDE.md` file and prohibit the creation of test files or modification of `README.md`.
- **Manual Browser Testing Steps:**
  1. Open two browser tabs and navigate to the frontend URL (e.g., `http://localhost:5173`).
  2. In tab 1, enter a name (e.g., "Alice") and click "Create Room". Note the room code.
  3. In tab 2, enter a different name (e.g., "Bob") and the room code, then click "Join Room".
  4. View the player list in tab 2 and confirm that no "HOST" badge or label appears next to the host's name.
