# Firebase setup

The app uses **Google sign-in** in production live (plus **demo email/password
accounts** in `src/lib/demo-accounts.json` during local development) for
applicants and staff, and Cloud Firestore for applications. Anonymous sign-in is
not used. Private application documents are stored in Google Drive through the
verified upload route (OAuth as the Drive owner's account; see step 10).

## Create Firebase services

1. Create a Firebase project and register a Web app.
2. Enable **Google** and **Email/Password** sign-in in Authentication and
   disable **Anonymous**. Add your production domain to Authentication →
   Settings → Authorized domains so the Google popup can open.
3. Create a Cloud Firestore database.
4. Create a service account for the server runtime with Firestore read/write
   and Firebase Authentication session-cookie permissions.
5. Add the service account's email to `FIREBASE_CLIENT_EMAIL`; store its private
   key as `FIREBASE_PRIVATE_KEY`. Keep that private key server-only and configure
   it in Vercel's encrypted environment variables. Do not commit it or paste it
   into source files.
6. Staff access uses Google in production (and demo email/password in local
   development). `vworksofficial@gmail.com` is the built-in primary staff
   account and `demo.admin@venturego.id` is the demo admin; add any additional
   staff emails to `FIREBASE_ADMIN_EMAILS` as a comma-separated server-only
   allowlist.
7. Create the demo accounts with
   `node --env-file=.env.local scripts/seed-demo-accounts.mjs` (idempotent:
   updates existing accounts and creates missing ones).
8. Configure the Web app values listed below as `NEXT_PUBLIC_*` variables in
   Vercel. Firebase Web API keys identify the project and are public; server
   service-account credentials are private.
9. Deploy the included Firestore rules with the Firebase CLI:
   `firebase deploy --only firestore:rules`.
10. For Google Drive, create an OAuth client ID (type **Desktop app**) under
    APIs & Services → Credentials, set the OAuth consent screen to **Production**,
    and capture a one-time refresh token (`GDRIVE_REFRESH_TOKEN`). Store
    `GDRIVE_OAUTH_CLIENT_ID`, `GDRIVE_OAUTH_CLIENT_SECRET`, and
    `GDRIVE_REFRESH_TOKEN` as server-only encrypted variables in Vercel. The
    root `VSV.VentureGo.id [database]` folder is created automatically on first upload.

> Demo credentials live in `src/lib/demo-accounts.json` for local development.
> In production live (`NODE_ENV === 'production'`), the welcome page only
> renders the single `Masuk dengan Google` button.

## Environment variables

Server-only variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (preserve newlines or encode them as `\\n`)
- `FIREBASE_ADMIN_EMAILS` (additional staff emails; the primary staff email is built in)
- `GDRIVE_OAUTH_CLIENT_ID` / `GDRIVE_OAUTH_CLIENT_SECRET` (Google OAuth client)
- `GDRIVE_REFRESH_TOKEN` (one-time consent; Drive access as the file owner)

Public Web app variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_SITE_URL` (your canonical production URL)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional, public) — Web OAuth client ID used by the
  `Masuk dengan Google` button through Google Identity Services, so the Google popup says
  "continue to VentureGo" instead of showing `*.firebaseapp.com`. The Google token is then
  passed to Firebase Auth (`signInWithCredential`), so UIDs, `ownerFirebaseUid` data and the
  staff session are unchanged. Use the **Web client ID** shown in Firebase Console →
  Authentication → Sign-in method → Google → _Web SDK configuration_ (same project), and add
  every app origin (`http://localhost:3000`, `https://apps.venturego.id`, Vercel domains) to
  that client's **Authorized JavaScript origins** in Google Cloud → APIs & Services →
  Credentials. Set the app name/logo in Google Auth Platform → Branding. When this variable
  is empty the app falls back to the Firebase popup.

## Existing Payload data

Payload data and uploads remain in the existing Figma-managed backend until an
export/import is performed. The current environment has no Payload content
export tool or credentials, so this code does not attempt to read or delete
those records. Export applications and upload files from the current Payload
environment before retiring it. A data-import utility should be run only after
that export is available and verified.
