# Plan checklist

Build the current plan, then the next one. Do not start a later plan early.

## Production

- **Live host:** Oracle Always Free VM — **http://141.148.204.30/** (HTTP; HTTPS when you add a domain)
- **Live / production git branch:** `feature/done-live`
- Do feature work on other branches. When you say a piece of work is **done**, merge that branch into `feature/done-live`, then deploy that tip to the Oracle VM.
- Deploy to **Oracle only**. Do not recreate or use Fly as a live host.
- **Former Fly app `mafia-wars`:** destroyed — not in use; do not bring Fly back for production unless you explicitly reverse this decision

## Now

- [ ] [Finalizing UI](file:///C:/Users/ArifH/.cursor/plans/finalizing_ui_7c4e1a90.plan.md) — implemented locally (host timers, 3D cards, detective Mafia flip). Mark done and merge into `feature/done-live` when you say so; deploy to Oracle from that branch
- [x] [Go live readiness](file:///C:/Users/ArifH/.cursor/plans/go_live_readiness_1c287349.plan.md) — was on Fly; superseded by Oracle host above
- [x] [Oracle Always Free cutover](file:///C:/Users/ArifH/.cursor/plans/oracle_always_free_cutover_385545c1.plan.md) — verified on Oracle; public play at http://141.148.204.30/; Fly app destroyed

## Next (separate)

- [ ] [Neon Free safe migrate](file:///C:/Users/ArifH/.cursor/plans/neon_free_safe_migrate_2400676a.plan.md) — single plan (recheck merged in): Neon Free Postgres for accounts, profiles, match history, chat
  - New project only: `mafia-wars` in **`aws-ap-southeast-1` (Singapore)** — closest Free region to Oracle Mumbai (no Neon Mumbai). Never touch `northline-revamp` / `northlinestore`
  - Stay Free ($0) until you upgrade org Sayed yourself; Postgres only (no Object Storage/Functions/AI Gateway); 0.25 CU + Free quotas; no Neon API key on Oracle
  - One store: unset `DATABASE_URL` → `users.json`; set → Neon only. Live rooms stay in memory; emit then async persist
  - Branch `feature/neon-migrate`; set Oracle `DATABASE_URL` only after local verify and only when you ask

## Deferred

- [ ] [Google ads revenue](file:///C:/Users/ArifH/.cursor/plans/google_ads_revenue_628e3cc9.plan.md)
  - After the game is stable on Oracle
  - One ad at game over, optional rewarded ad, no ads during a live match
- Domain + HTTPS (Caddy / Let’s Encrypt) when you have a domain pointing at `141.148.204.30`

## Done

- [x] [Splash screen impact](file:///C:/Users/ArifH/.cursor/plans/splash_screen_impact_af94db86.plan.md) — archived; home polish folded into Finalizing UI (not a separate track)
- [x] [Play readiness review](file:///C:/Users/ArifH/.cursor/plans/play_readiness_review_c312286b.plan.md). Store review. First privacy and terms drafts are in.
- [x] [Global legal documents](file:///C:/Users/ArifH/.cursor/plans/global_legal_documents_55d149fa.plan.md). Worldwide privacy and terms, linked before signup. Committed and pushed.
- [x] [Play Store must-haves](file:///C:/Users/ArifH/.cursor/plans/play_store_must-haves_1cdab4a4.plan.md). Four dev-only test logins, fixed roles, day chat with report and block. Committed and pushed.
- [x] [Game look and lobby volume](file:///C:/Users/ArifH/.cursor/plans/game_look_and_volume_744625fb.plan.md). UI skill, panels, volume, date picker, match countdown, kill sound, chat actions hidden.
- [x] [Phone and browser role test](file:///C:/Users/ArifH/.cursor/plans/phone_ui_testing_fd0edc00.plan.md). Four seats full round 16/16; phone viewport on LAN OK.
- [x] [How to play](file:///C:/Users/ArifH/.cursor/plans/how_to_play_a5802c97.plan.md). Guide on home and lobby with RoleCard thumbnails; hidden during match.
