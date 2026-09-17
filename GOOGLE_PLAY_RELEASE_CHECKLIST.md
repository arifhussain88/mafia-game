# Mafia Wars: Google Play Release Checklist

This guide reflects the current repository state as of 2026-09-18.

## Current Verification

The following checks pass locally:

```powershell
pnpm run typecheck
$env:PORT="5173"; $env:BASE_PATH="/"; pnpm --filter @workspace/game-lobby run build
pnpm --filter @workspace/api-server run build
```

The frontend is currently a Vite web app and the backend is an Express/Socket.IO server. There is no Android, Capacitor, Trusted Web Activity, or React Native project in this repository yet. A web build alone cannot be uploaded to Google Play; an Android app package and signing configuration are still required.

## Before Publishing

### 1. Choose the Android delivery approach

Choose one and document it in the repository:

- Capacitor wrapper around the Vite frontend.
- Trusted Web Activity for a deployed HTTPS web app.
- A native Android client using the existing API and Socket.IO backend.

For the fastest path, use Capacitor after the web deployment is stable. Configure a production API URL, Android application ID, app name, icons, splash screen, deep links if needed, and HTTPS-only networking.

### 2. Deploy production infrastructure

- Deploy the API server to a stable HTTPS host.
- Deploy the frontend to a stable HTTPS host.
- Configure the frontend proxy or production API/Socket.IO URL; do not rely on `localhost`.
- Configure production CORS to allow only the real frontend origin.
- Confirm WebSocket upgrades work through the production proxy.
- Add health checks, structured logs, uptime monitoring, and error alerts.
- Use environment variables or a secrets manager for production secrets.
- Back up the production database and define restore procedures.

### 3. Replace development authentication

The current authentication implementation is not ready for production:

- Replace SHA-256 password hashing with Argon2id or bcrypt.
- Replace `data/users.json` with PostgreSQL/Drizzle or another production database.
- Store only the minimum personal data needed.
- Add session expiration, logout/revocation, rotation, and server-side validation.
- Do not keep long-lived bearer tokens in `localStorage` if an HttpOnly, Secure, SameSite cookie session is practical.
- Add login/signup rate limiting, account lockout or progressive delays, and abuse monitoring.
- Normalize and validate names, email addresses, dates, and all API payloads with shared schemas.
- Add duplicate-account, password-reset, email-verification, and account-deletion flows as required by the product design.
- Never log passwords, tokens, raw authorization headers, or unnecessary personal data.

### 4. Harden the API and game server

- Remove tolerant malformed-JSON repair from production; clients should send valid JSON and invalid input should return `400`.
- Configure strict CORS instead of `cors()` with unrestricted defaults.
- Add security headers with Helmet or an equivalent configuration.
- Add request body size limits and rate limits per IP/account/socket.
- Validate Socket.IO events and enforce room membership, host permissions, role permissions, alive/dead state, and phase transitions server-side.
- Ensure room codes have sufficient entropy and expire when abandoned.
- Prevent users from changing another player's name, role, votes, or room state.
- Add replay, reconnect, duplicate-event, and disconnect tests.
- Use HTTPS/WSS in production and verify certificate handling.
- Review dependency vulnerabilities with the package manager and a CI security scan.

### 5. Finish privacy and legal documents

The current `privacy.html` and `terms.html` are placeholders and must not be published as final legal documents.

Create final documents reviewed for the countries where the game will be available. They should clearly state:

- Publisher/developer legal identity and contact method.
- Data collected: email, display name, date of birth, device/network data, diagnostics, and game activity as applicable.
- Why each data type is collected and the legal basis where applicable.
- Storage location, retention periods, processors, hosting providers, and security practices.
- Account deletion and personal-data deletion instructions.
- User rights and a privacy contact address.
- Children/teens policy, age gate, parental-consent handling, and whether the app is directed to children.
- Advertising, analytics, crash reporting, and third-party SDK disclosures.
- Changes to the policy and effective date.

Publish the final privacy policy at a stable public HTTPS URL. The same URL must be entered in Play Console and be reachable without login. Make the policy accessible from inside the app. Review the Terms of Service with legal counsel before launch.

### 6. Decide the age and audience policy

The current signup flow uses a 13+ age gate, but that alone does not establish full COPPA or regional child-safety compliance.

Before launch:

- Complete the Google Play target-audience questionnaire accurately.
- Decide whether children under 13 can use the app.
- If children may use it, implement the required parental-consent, data-minimization, and child-safe behavior.
- Avoid collecting DOB unless it is necessary; if retained, document retention and deletion.
- Add reporting, blocking, and moderation tools for multiplayer abuse.
- Define chat/content moderation rules if user-generated names or communication are allowed.

### 7. Complete Google Play declarations

In Play Console, prepare:

- Developer account verification.
- App name, short description, full description, category, tags, and contact email.
- Privacy policy URL.
- Data Safety form matching the actual SDKs, backend, retention, and deletion behavior.
- Content rating questionnaire.
- Target audience and news/app-content declarations where applicable.
- Ads declaration, even if the first release has no ads.
- App access instructions for reviewers if login is required.
- Permissions declaration; request only permissions the app truly needs.
- Support website/email and account deletion instructions.
- Store icon, feature graphic, phone/tablet screenshots, and promotional assets.
- Release notes and an accurate description of multiplayer behavior.

### 8. Build and sign Android release artifacts

After choosing Capacitor/TWA/native Android:

- Set a permanent application ID such as `com.yourcompany.mafiawars`.
- Create a secure upload key and store it outside the repository.
- Build a signed Android App Bundle (`.aab`), not only a debug APK.
- Enable Play App Signing and safely retain the upload key backup.
- Set a production version name and monotonically increasing version code.
- Test release builds, not only Vite development builds.
- Verify app icon, splash screen, back navigation, offline/error states, and deep links.
- Confirm the production API URL and Socket.IO connection are embedded correctly.
- Do not ship development URLs, debug logs, test accounts, placeholder legal text, or test data.

### 9. Test on real devices

Test at minimum on a low-end Android phone, a current Android phone, and a tablet-sized viewport:

- Fresh install, upgrade, uninstall/reinstall, and clear-data flows.
- Signup, login, logout, failed login, expired session, and account deletion.
- Create/join room with five or more devices or clients.
- Reconnect after backgrounding, network changes, and temporary server loss.
- Every role and every game phase, including eliminated players and game-over.
- Audio, mute state, Bluetooth/headphones, phone speaker, silent mode behavior, and app backgrounding.
- Accessibility: text contrast, font scaling, touch targets, screen reader labels, and reduced motion.
- Privacy links, terms links, support links, and all error states.
- Abuse cases: rapid requests, malformed payloads, unauthorized Socket.IO events, and room takeover attempts.

### 10. Release through testing tracks

1. Upload the signed `.aab` to Internal testing.
2. Add tester accounts and test the production backend.
3. Fix crashes, ANRs, authentication issues, and policy warnings.
4. Move to Closed testing if required by the Play account or release plan.
5. Complete the required testing period and feedback collection.
6. Submit the production release for review.
7. Monitor crashes, ANRs, reviews, support requests, and backend health after launch.

## Recommended Order

1. Finish production authentication and database migration.
2. Finish the real privacy policy, terms, age/child-safety decision, and account deletion flow.
3. Deploy the API and frontend over HTTPS with locked-down CORS.
4. Add an Android wrapper and produce a signed release build.
5. Complete security, accessibility, multiplayer, and real-device testing.
6. Complete Play Console declarations and internal testing.
7. Publish only after all placeholders and development infrastructure are removed.

## Current Known Blockers

- No Android packaging project exists yet.
- Authentication uses SHA-256 and a JSON file store.
- Sessions have no expiry or revocation flow.
- API CORS is unrestricted.
- Rate limiting, security headers, and production socket validation need review.
- Privacy Policy and Terms pages are placeholders.
- Account deletion and data-retention workflows are not complete.
- Production HTTPS deployment and monitoring are not configured in this repository.
- The current `data/users.json` contains local development state and must not be shipped or exposed.
