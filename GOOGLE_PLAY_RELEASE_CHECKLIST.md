# Google Play release checklist

Where the MVP stands for its first Play release. The Android app is the Expo project in `artifacts/mobile-app`: a WebView shell that loads the web game from the Oracle server. One web build serves both the website and the app.

## Done in the code

- [x] Android app project (Expo, EAS build profiles in `eas.json`), INTERNET permission only.
- [x] Accounts in Neon Postgres with bcrypt hashes; signup is atomic.
- [x] Login limits count failed attempts only (per email and per IP).
- [x] Account deletion in the app (Home → Delete account), plus the public page `/delete-account.html`.
- [x] Privacy policy (`/privacy.html`) and terms (`/terms.html`) linked before signup. The policy names Oracle, Neon and Google Fonts.
- [x] 13+ age gate at signup.
- [x] Chat report and block.
- [x] Server validates every socket payload and enforces roles and phases. One bad message can't crash it.
- [x] Seats are tied to accounts. Reconnects, app backgrounding and WebView reloads put the player back in their seat.
- [x] Android back button: closes panels, leaves the lobby, and asks before leaving a match.
- [x] Privacy, terms and delete pages open in the system browser, not inside the game.
- [x] Capacity caps protect the free VM: `MAX_SOCKETS`, `MAX_OPEN_ROOMS`, `MAX_SOCKETS_PER_IP`.
- [x] Dev test logins and the fixed test roles are off in production.

## Still to do before uploading

1. **HTTPS.** Create a DuckDNS name, put it in `deploy/oracle/game-host`, and deploy. Then set `expo.extra.gameUrl` in `artifacts/mobile-app/app.json` to the `https://` URL. Full steps are in `deploy/oracle/DEPLOY_ORACLE.md` → "HTTPS on a free subdomain". Once the URL is HTTPS, cleartext switches off automatically.
2. **Name and package ID.** Decided: store title "Mafia: Town Has a Problem", launcher label "Mafia Town", package `com.sayedarif.mafiatown` (set in `artifacts/mobile-app/app.json`). Search the exact title on the Play Store before the first upload; the package ID cannot change after it.
3. **Icon and splash.** `artifacts/mobile-app/assets/` still holds Expo template images. Replace them: a 1024×1024 icon, adaptive foreground and background, and a monochrome icon. Add a `splash` block to `app.json`.
4. **EAS project.** Run `pnpm dlx eas-cli init` in `artifacts/mobile-app`, which writes `extra.eas.projectId`. Either remove the `development` profile from `eas.json` or add `expo-dev-client`.
5. **Production build.** Run `pnpm dlx eas-cli build -p android --profile production` to get an `.aab`. Turn on Play App Signing.
6. **Reviewer account.** Create one normal account on the production server for Play's "App access" section. The `@test.local` logins are blocked in production.

## Play Console

- Privacy policy URL: `https://<game-host>/privacy.html`
- Account deletion URL: `https://<game-host>/delete-account.html`
- Data safety form:
  - Collected: email, display name, date of birth, in-game chat, and match history.
  - Encrypted in transit: yes, once on HTTPS.
  - Users can request deletion: yes.
  - No ads, no analytics SDKs.
- Content rating questionnaire: user-to-user chat, cartoon/fantasy crime theme.
- Target audience: 13+. Not designed for children.
- Ads declaration: no ads in this release.
- Store listing: short and full description, at least 2 phone screenshots, a 512×512 icon, and a 1024×500 feature graphic.
- Describe the app as a multiplayer party game that needs friends to join a room. This helps with the "minimum functionality" review that WebView apps sometimes get.
- New personal developer accounts must run a closed test with a minimum number of testers, for a minimum number of days, before production access. Check the current rule in Play Console.

## Test on a real phone before submitting

- Fresh install, then sign up, log out, log in, and use a wrong password.
- Create a room and join it from two or three other phones.
- Play a full match with every role.
- Background the app mid-match and come back: you should be back in your seat.
- Turn on airplane mode for 10 seconds mid-match and turn it off again.
- Press back on Home, in the lobby and in a match.
- Open the Privacy link: it should go to the browser.
- Delete the account from the app.
- Check sound on the phone speaker and with mute, and check the layout at small widths.
