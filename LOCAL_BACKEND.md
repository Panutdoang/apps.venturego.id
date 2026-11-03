# Local Firebase backend

Local development uses Firebase emulators for Authentication, Firestore, and
Storage. Development credentials and project settings are not sent to the
configured cloud Firebase project.

Requirements: Java 21 or later and the Firebase CLI.

1. In one terminal, run `npm run backend:local`. The first run may download
   emulator binaries. Keep this terminal open.
2. In another terminal, run `npm run dev`.
3. Open `http://localhost:3000/admin`. The local development bypass applies
   only when the app is running in development on localhost or 127.0.0.1.
4. Open `http://127.0.0.1:4000` to inspect emulator data.

The emulators bind to loopback only: Auth on port 9099, Firestore on 8080,
Storage on 9199, and the Emulator UI on 4000. Emulator data is imported at
startup and exported when the emulator process exits into the ignored
`.firebase-data` directory. Stop the emulator with Ctrl+C to export data.

The local Firestore starts empty. New application records, anonymous Auth users,
and uploaded files are stored in the emulators, not in the cloud project.
