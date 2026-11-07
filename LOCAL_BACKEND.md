# Local Firebase backend

Local development (`npm run dev`) connects directly to the Firebase project
configured in `.env.local` for Authentication and Cloud Firestore, and uses the
Google Drive OAuth credentials in `.env.local` for applicant uploads. No local
Firebase emulator or Java installation is required for standard development.

1. Ensure `.env.local` has your `FIREBASE_*` and `NEXT_PUBLIC_FIREBASE_*`
   variables configured.
2. Seed/update the demo email/password accounts in Firebase Auth (one-time):

   ```powershell
   node --env-file=.env.local scripts/seed-demo-accounts.mjs
   ```

3. Run `npm run dev` and open `http://localhost:3000`.
4. Use `Masuk User` (`demo.user@venturego.id`), `Masuk Admin`
   (`demo.admin@venturego.id`), or `Masuk dengan Google` from the welcome
   screen. In production live (`NODE_ENV === 'production'`), only the single
   `Masuk dengan Google` button is shown.
