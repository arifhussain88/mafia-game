# Mafia Wars Firebase and Firestore Guide

This guide explains how to create the Firebase project used by the mobile MVP and connect it to `artifacts/mobile-app`.

## 1. Create the Firebase project

1. Open https://console.firebase.google.com/.
2. Click **Add project**.
3. Use a name such as `mafia-wars-mvp`.
4. If Firebase asks about Google Analytics, select **Not now** or disable it for this MVP.
5. Click **Create project** and wait for setup to finish.

Keep the generated **Project ID** available. It is different from the display name and cannot be changed after Firebase provisions the project.

## 2. Register the app configuration

Inside the Firebase project:

1. Click the gear beside **Project Overview**, then open **Project settings**.
2. On the **General** tab, scroll to **Your apps**.
3. If no web app is listed, click the Web icon: `</>` (**Add app** → Web). If the app is already listed, select it and choose **Config** to view its configuration.
4. Use the nickname `Mafia Wars Mobile`.
5. Leave **Also set up Firebase Hosting** unchecked, then click **Register app**.
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

1. In the left navigation, open **Security → Authentication**.
2. Click **Get started** if prompted.
3. Open the **Sign-in method** tab.
4. Select **Email/Password**.
5. Turn on **Email/Password**, leave **Email link** off, and click **Save**.

The app uses email and password accounts for sign-up and sign-in. Enable only **Email/Password** for this setup.

## 4. Create Firestore

1. Open **Databases & Storage → Firestore**.
2. Click **Create database**.
3. Choose **asia-south2 (Delhi)** for the initial Pakistan launch.
4. If Firebase asks for an edition, choose **Standard** for this app.
5. Select **Start in production mode**. This is the safer choice because step 5 adds the required authenticated rule.
6. Click **Create**.

The database location cannot be changed after creation. Delhi is the recommended starting location for users in Pakistan. If the primary audience later moves to the Middle East, create a separate production project in a nearby region such as **me-central1 (Doha)** or **me-central2 (Dammam)** and plan a data migration rather than expecting to move this database.

## 5. Add the initial rules

1. In **Databases & Storage → Firestore**, open the **Rules** tab. If the project has more than one database, select the default database first.
2. Replace the rules in the editor with these rules for initial authenticated testing:

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

3. Click **Publish** and confirm the release if prompted. Updates can take up to a minute to affect new requests.

These rules allow any signed-in user to read and modify lobby documents. They should be tightened before public release so users cannot modify rooms or player lists arbitrarily.

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

The variable names must match `artifacts/mobile-app/src/config/firebase.ts`. `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` is optional and is only needed if Google Analytics was enabled for the project. Leave it out when Firebase did not provide a `measurementId`. The local file is ignored by Git and must not be committed.

Restart Expo after creating or changing the file:

```powershell
pnpm --filter @workspace/mobile-app exec expo start --clear
```

## 7. Verify the connection

1. Start the mobile app after restarting Expo.
2. Create a new account with email, password, display name, date of birth, and accepted terms.
3. Create a lobby room.
4. In **Databases & Storage → Firestore → Data**, confirm a document appears in the `lobbies` collection.
5. Sign in from another device or account and join the room.
6. Confirm the player list changes in Firestore.

If the app displays demo rooms, check that `.env.local` is in `artifacts/mobile-app`, that all variable names are exact, and that Expo was restarted after the file was created.

If Firestore reports `permission-denied`, confirm the user completed authentication and that the rules were published in the correct Firebase project.
