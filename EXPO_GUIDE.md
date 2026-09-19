# Mafia Wars Expo Guide

This guide covers running the Expo React Native mobile app from Windows. The app is located in `artifacts/mobile-app`.

## What runs where

Expo runs from Windows through the project-local dependency. Expo Go is not a Windows desktop application; install Expo Go on an Android or iOS phone. Windows can also run the app in a browser or an Android emulator.

## 1. Install prerequisites

Install:

- Node.js LTS: https://nodejs.org/
- Git: https://git-scm.com/download/win
- VS Code: https://code.visualstudio.com/
- Expo Go from Google Play on an Android phone

Verify the tools in a new PowerShell window:

```powershell
node --version
pnpm --version
git --version
```

If `pnpm` is missing:

```powershell
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

The project already includes Expo in `artifacts/mobile-app/package.json`; do not install Expo globally.

## 2. Install the project

From the repository root:

```powershell
Set-Location "D:\Personal Repositories\Mafia-Wars"
pnpm install
pnpm --filter @workspace/mobile-app run typecheck
```

## 3. Run on a physical Android phone

Start Expo:

```powershell
pnpm --filter @workspace/mobile-app start
```

Then:

1. Connect the phone and PC to the same Wi-Fi network.
2. Open Expo Go on the phone.
3. Scan the QR code shown by Expo.
4. Test the app flow on the device.

If the phone cannot connect over local Wi-Fi:

```powershell
pnpm --filter @workspace/mobile-app exec expo start --tunnel
```

The tunnel is slower but works across many network configurations.

## 4. Run the browser preview

```powershell
pnpm --filter @workspace/mobile-app run web
```

The browser preview is useful for layout and basic JavaScript behavior. Always test mobile keyboard, touch, authentication, and room flows on a real Android device as well.

## 5. Run an Android emulator (optional)

Install Android Studio from https://developer.android.com/studio and install:

- Android SDK
- Android SDK Platform for a recent Android version
- Android SDK Platform-Tools
- Android Emulator

In Android Studio, open **Device Manager**, create a Pixel emulator, and start it. Then run:

```powershell
pnpm --filter @workspace/mobile-app run android
```

The first local Android build can take several minutes. This workflow needs Android Studio and its SDK; the Expo Go phone workflow does not.

## 6. Debugging

Run the TypeScript check:

```powershell
pnpm --filter @workspace/mobile-app run typecheck
```

Restart Expo and clear its cache:

```powershell
pnpm --filter @workspace/mobile-app exec expo start --clear
```

Use the Expo terminal for JavaScript errors and red-screen details. On the device, open the Expo development menu to reload the app or inspect logs. For emulator testing, Android Studio's **Logcat** shows native Android errors.

Common fixes:

- Phone cannot connect: use the same Wi-Fi, disable VPN temporarily, or use `--tunnel`.
- Changes do not appear: run Expo with `--clear` and reload Expo Go.
- Android build cannot find the SDK: set `ANDROID_HOME` to the Android SDK location and ensure Platform-Tools is installed.

## 7. Build Android packages

For cloud builds, install nothing globally:

```powershell
pnpm dlx eas-cli login
pnpm dlx eas-cli build:configure
```

For an installable testing APK:

```powershell
pnpm dlx eas-cli build --platform android --profile preview
```

For the Google Play Store, create a production Android App Bundle:

```powershell
pnpm dlx eas-cli build --platform android --profile production
```

The Play Store submission format is `.aab`; an `.apk` is primarily for direct testing.
