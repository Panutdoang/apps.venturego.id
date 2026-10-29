# Firebase setup

The app uses Firebase Authentication for anonymous applicant upload sessions
and staff email/password sign-in, Cloud Firestore for applications, and Cloud
Storage for private application documents.

## Create Firebase services

1. Create a Firebase project and register a Web app.
2. Enable **Anonymous** and **Email/Password** sign-in in Authentication.
3. Create a Cloud Firestore database.
4. Create a Cloud Storage bucket in the same Google Cloud project.
5. Create a service account for the server runtime with Firestore read/write,
   Firebase Authentication session-cookie, and bucket object read permissions.
6. Add the service account's email to `FIREBASE_CLIENT_EMAIL`; store its private
   key as `FIREBASE_PRIVATE_KEY`. Keep that private key server-only and configure
   it in Vercel's encrypted environment variables. Do not commit it or paste it
   into source files.
7. Add the staff email addresses to `FIREBASE_ADMIN_EMAILS` as a comma-separated
   server-only allowlist. Create those staff accounts in Firebase Authentication
   with email/password sign-in.
8. Configure the Web app values listed below as `NEXT_PUBLIC_*` variables in
   Vercel. Firebase Web API keys identify the project and are public; server
   service-account credentials are private.
9. Deploy the included Firestore and Storage rules with the Firebase CLI:
   `firebase deploy --only firestore:rules,storage`.
10. Configure Cloud Storage CORS for the exact production and preview origins
    that will upload files. Allow the Firebase Storage SDK's browser upload
    requests; Firebase Web uploads require bucket CORS for the app's origins.
    Keep the list limited to your deployed site domains.

## Environment variables

Server-only variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (preserve newlines or encode them as `\\n`)
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_ADMIN_EMAILS`

Public Web app variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_SITE_URL` (your canonical production URL)

## Existing Payload data

Payload data and uploads remain in the existing Figma-managed backend until an
export/import is performed. The current environment has no Payload content
export tool or credentials, so this code does not attempt to read or delete
those records. Export applications and upload files from the current Payload
environment before retiring it. A data-import utility should be run only after
that export is available and verified.
