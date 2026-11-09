# Mafia: Town Has a Problem — Android app (Expo)

The game is the React web app in `artifacts/game-lobby`, served by `artifacts/api-server`.
This Expo app opens that game in a full-screen WebView. You get one codebase: what works in
the browser works in the app, and server deploys update the app instantly with no store review.

- Expo SDK 58 / React Native 0.88 (matches the current Expo Go on Google Play)
- Game URL: `app.json → expo.extra.gameUrl` (live Oracle server), or override with
  `EXPO_PUBLIC_GAME_URL` in `.env.local`

## Test on your phone with Expo Go

1. Install **Expo Go** from the Play Store on your Android phone.
2. From the repo root:
   ```bash
   pnpm install
   pnpm --filter @workspace/mobile-app start
   ```
3. Scan the QR code with Expo Go. Phone and PC must be on the same Wi‑Fi;
   otherwise use `pnpm --filter @workspace/mobile-app start:tunnel`.

The app loads the live server by default. To test local changes instead, run the API and
Vite dev servers (see root README), then create `artifacts/mobile-app/.env.local`:

```
EXPO_PUBLIC_GAME_URL=http://<your-PC-LAN-IP>:5173
```

and restart `expo start`.

## Build for Google Play (EAS)

```bash
npm i -g eas-cli
eas login
cd artifacts/mobile-app
eas init                 # links the project to your Expo account (writes projectId)
pnpm build:apk           # installable APK for testers
pnpm build:aab           # signed .aab for Play Console (EAS manages the upload key)
eas submit -p android    # uploads to the Internal testing track
```

## Before the first Play Store upload

- [ ] **HTTPS**: point a domain at the server, enable TLS in `deploy/oracle/Caddyfile`,
      set `extra.gameUrl` to `https://…`, then remove the `expo-build-properties`
      `usesCleartextTraffic` plugin from `app.json`.
- [ ] **Package name**: `com.mafiawars.app` is permanent once uploaded. Change it now if
      you want something like `com.<yourname>.mafiawars`.
- [ ] **Icons/splash**: `assets/` still holds the Expo template images. Replace
      `icon.png` (1024×1024), `android-icon-foreground.png`, `android-icon-background.png`,
      `android-icon-monochrome.png` and `splash-icon.png`.
- [ ] Play Console → App content → **Data deletion**: use `https://<domain>/delete-account.html`.
- [ ] Play Console → **Privacy policy**: `https://<domain>/privacy.html`.
- [ ] **App access**: give reviewers a test login (email + password) since login is required.

## Ads

AdMob needs native code, so it **does not run in Expo Go**. When you add ads, switch to a
development build (`npx expo install expo-dev-client react-native-google-mobile-ads`,
then `eas build --profile development`). Expo Go keeps working for the game itself until then.
