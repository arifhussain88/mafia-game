# Plan checklist

Build the current plan, then the next one. Do not start a later plan early.

## Now

- [ ] [Finalizing UI](file:///C:/Users/ArifH/.cursor/plans/finalizing_ui_7c4e1a90.plan.md) — opening screen should hit like the game: suspense, a mafia night, amber and black. Music already starts on that first screen (after the first tap). Title, tagline, and the photo behind the card are still to do.
- [x] [Go live readiness](file:///C:/Users/ArifH/.cursor/plans/go_live_readiness_1c287349.plan.md) — live at https://mafia-wars.fly.dev/
  - Fly Machines app `mafia-wars`, region `sin`, volume `/data`
  - Hardened: bcrypt, socket auth, static SPA, Report/Block, terms chat copy, reconnect toasts
  - Cost floor: 1×256MB, auto-stop (min 0), no HA, app abuse caps; worst-case always-on ~$3–5/mo compute
  - True $0 after a test wave: `fly apps destroy mafia-wars` then confirm volume gone (`fly volumes destroy` if needed); redeploy later with `fly deploy --ha=false` + new volume

## Next (separate)

- [ ] [Neon Free safe migrate](file:///C:/Users/ArifH/.cursor/plans/neon_free_safe_migrate_2400676a.plan.md) — Neon Postgres + Drizzle for accounts, profiles, match history, and chat; JSON fallback so live games do not break
  - Org is already on Neon Free ($0). Do **not** delete or change existing projects (`northline-revamp`, `northlinestore`)
  - New project only: `mafia-wars`. Free stays $0 under ~1 GB/project, 100 CU-hours/month, 5 GB egress — **not** until 1M users
  - Live rooms stay in memory; durable writes are signup/session, match end, and day chat
  - Do not set Fly `DATABASE_URL` until local verify; no deploy until you say so

## Deferred (after live)

- [ ] [Google ads revenue](file:///C:/Users/ArifH/.cursor/plans/google_ads_revenue_628e3cc9.plan.md)
  - Do this yourself after the game is live on Fly
  - One ad at game over, optional rewarded ad, no ads during a live match
  - Not part of the first public upload / go-live pass

## Done

- [x] [Play readiness review](file:///C:/Users/ArifH/.cursor/plans/play_readiness_review_c312286b.plan.md). Store review. First privacy and terms drafts are in.
- [x] [Global legal documents](file:///C:/Users/ArifH/.cursor/plans/global_legal_documents_55d149fa.plan.md). Worldwide privacy and terms, linked before signup. Committed and pushed.
- [x] [Play Store must-haves](file:///C:/Users/ArifH/.cursor/plans/play_store_must-haves_1cdab4a4.plan.md). Four dev-only test logins, fixed roles, day chat with report and block. Committed and pushed.
- [x] [Game look and lobby volume](file:///C:/Users/ArifH/.cursor/plans/game_look_and_volume_744625fb.plan.md). UI skill, panels, volume, date picker, match countdown, kill sound, chat actions hidden.
- [x] [Phone and browser role test](file:///C:/Users/ArifH/.cursor/plans/phone_ui_testing_fd0edc00.plan.md). Four seats full round 16/16; phone viewport on LAN OK.
- [x] [How to play](file:///C:/Users/ArifH/.cursor/plans/how_to_play_a5802c97.plan.md). Guide on home and lobby with RoleCard thumbnails; hidden during match.
