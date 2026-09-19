# Mafia Wars Firebase and Firestore Guide

This guide explains how to create the Firebase project used by the mobile MVP and connect it to `artifacts/mobile-app`.

## 1. Create the Firebase project

1. Open https://console.firebase.google.com/.
2. Click **Create a project**.
3. Use a name such as `mafia-wars-mvp`.
4. Google Analytics can be disabled for the MVP.
5. Click **Create project**.

## 2. Register the app configuration

Inside the Firebase project:

1. Click the gear beside **Project Overview**.
2. Open **Project settings**.
3. Under **Your apps**, click the Web icon: `</>`.
4. Use the nickname `Mafia Wars Mobile`.
5. Do not enable Firebase Hosting.
6. Copy the configuration object Firebase displays.

It will look similar to:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "mafia-wars-mvp.firebaseapp.com",
  projectId: "mafia-wars-mvp",
  storageBucket: "mafia-wars-mvp.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

The Firebase Web App configuration is intended to be included in the client app. Do not send or commit service-account private keys, passwords, or private JSON credentials.

## 3. Enable email authentication

1. Open **Build → Authentication**.
2. Click **Get started**.
3. Open the **Sign-in method** tab.
4. Select **Email/Password**.
5. Enable **Email/Password**.
6. Save.

## 4. Create Firestore

1. Open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location near the expected users.
4. Select **Start in production mode**.
5. Create the database.

## 5. Add the initial rules

Open the Firestore **Rules** tab and use these rules for initial authenticated testing:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /lobbies/{lobbyId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**. These rules should be tightened before public release so users cannot modify rooms or player lists arbitrarily.

## 6. Add the project configuration locally

Create this file:

`artifacts/mobile-app/.env.local`

Add the values from the Firebase Web App configuration:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

The variable names must match `artifacts/mobile-app/src/config/firebase.ts`. The local file is ignored by Git and must not be committed.

Restart Expo after creating or changing the file:

```powershell
pnpm --filter @workspace/mobile-app exec expo start --clear
```

## 7. Verify the connection

1. Open the mobile app.
2. Create a new account with email, password, display name, date of birth, and accepted terms.
3. Create a lobby room.
4. Open Firestore Console and confirm a document appears in the `lobbies` collection.
5. Sign in from another device or account and join the room.
6. Confirm the player list changes in Firestore.

If the app displays demo rooms, check that `.env.local` is in `artifacts/mobile-app`, that all variable names are exact, and that Expo was restarted after the file was created.

If Firestore reports `permission-denied`, confirm the user completed authentication and that the rules were published in the correct Firebase project.
