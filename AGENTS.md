# figma-make-app

React + Next.js + Firebase + Tailwind CSS project running inside Figma Make.

This file is supplied as project instructions at the start of each task. Do not
reread it before opening source. Load `nextjs-docs` when the task involves
routing, pages, components, caching, images, or metadata.

For frontend work, keep a **Verify production delivery** todo pending until all
of these are done:

- Preview every requested route and fix every runtime or build error. Server
  Components cannot contain event handlers; use CSS interaction or a Client
  Component boundary.
- When a Client Component calls a Server Action inside `useTransition`, keep
  `revalidatePath` out of the action. Return a serializable result and call
  `router.refresh()` in the client after success.
- Run `figma make verify-deploy`, inspect its production route table, and visit
  every generated public route. `verify-bootstrap` and source inspection are
  not substitutes.

## Backend: Firebase (not Payload)

This project previously used Payload CMS; it now uses Firebase exclusively.
There is no `src/payload.config.ts`, no `src/collections/`, and no
`src/app/(payload)/`. Do not add Payload back unless the user explicitly asks.

Firebase services (see `FIREBASE_SETUP.md` and `LOCAL_BACKEND.md`):

- **Authentication** — anonymous sign-in for applicant upload sessions;
  email/password for staff, gated by the `FIREBASE_ADMIN_EMAILS` server
  allowlist.
- **Cloud Firestore** — the `applications` collection (and any future app
  records). Rules deny all client access (`firestore.rules`); all reads and
  writes go through the Admin SDK in Server Actions or route handlers.
- **Cloud Storage** — private applicant documents under
  `application-uploads/{uid}/…` (`storage.rules`: anonymous create-only,
  size/type limited; no client read). Staff access is proxied through
  authenticated server routes.

Local development uses the Auth/Firestore/Storage emulators
(`pnpm backend:local`, ports 9099/8080/9199/4000). The client SDK connects to
emulators automatically when `NODE_ENV === 'development'`.

## Payload Data Integrity (applies to Firebase mutations)

For user-facing mutations, validate and allowlist every submitted field on the
server and return structured errors the UI can display. Grant anonymous create
only through the narrow submit flow, and protect server-owned workflow fields
(`status`, `internalNotes`, `financialPlan`, `ownerFirebaseUid`, timestamps)
so clients cannot set them directly. Enforce ownership and other durable
invariants at the Server Action boundary, not only in UI checks.

Verify the anonymous ID token server-side with `firebase-admin`, and only for
users whose `sign_in_provider === 'anonymous'`. Staff actions must call
`getStaffSession()` and check `FIREBASE_ADMIN_EMAILS`. Never log, print, or
expose tokens, service-account keys, or `.env.local` values.

Do not create placeholder Firestore collections just because Firebase is
present. Add collections only when the user needs durable application data.

## Development Server

A Next.js development server is **always running** on `$PORT` (default 3000).
You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This project uses Next.js App Router route groups:

- `src/app/(frontend)/` - Public application pages, dashboards, admin UI
- `src/app/api/` - Internal API routes (staff session cookie, document proxy,
  Xendit webhook at `api/webhooks/xendit`)
- `src/lib/` - Shared utilities (`firebase-client.ts`, `firebase-admin.ts`,
  `firebase-session.ts`, `firebase-data.ts`, `financing-plan.ts`,
  `departure-financing.ts`, `documents.ts`, `xendit.ts`)
- `firestore.rules`, `storage.rules`, `firebase.json` - Firebase security and
  emulator configuration

## Key Files

- `src/app/(frontend)/layout.tsx` - Root layout component
- `src/app/(frontend)/page.tsx` - Public financing application form
- `src/app/(frontend)/actions.ts` - Application submit/discard Server Actions
- `src/app/(frontend)/admin/` - Staff review panel (sign-in, applications)
- `src/app/(frontend)/dashboard/` - Applicant dashboard pages and Server Actions
- `src/app/(frontend)/not-found.tsx` - Custom not-found page
- `src/app/(frontend)/styles.css` - Global styles and Tailwind CSS import
- `src/lib/firebase-admin.ts` - Admin SDK init, `isStaffEmail` allowlist
- `src/lib/firebase-session.ts` - Staff session cookie helpers
- `next.config.ts` - Next.js configuration
- `package.json` - Dependencies and scripts
- `.mise.toml` - Toolchain versions (Node.js, pnpm)
- `.figma/make/*` - Lifecycle scripts (install, dev, deploy, deploy-preview)

## Styling

This project uses **Tailwind CSS v4** for frontend styling. Tailwind and its
PostCSS plugin are already installed and configured, and Tailwind is loaded by
the `@import "tailwindcss"` directive in `src/app/(frontend)/styles.css`.

Use Tailwind utility classes directly in JSX for application UI. Keep
`styles.css` for the Tailwind import, shared theme tokens, and truly global base
styles; do not default to inline style objects, CSS-in-JS, or hand-written
component classes when Tailwind utilities express the same design.

## Data/Backend Decision

Use the lightest stack that satisfies the request:

- Static UI, local browser state, games, or offline tools: no backend.
- Server-side compute, secrets, OAuth, email, webhooks, or third-party API
  calls without durable local data: Next.js server components, server actions,
  or route handlers.
- Durable records, admin-managed content/data, uploads, users, bookings,
  inventory, saved preferences, or data that persists across devices/sessions:
  Firestore via Firebase Admin SDK in Server Actions/route handlers; Cloud
  Storage for files.
- Explicit Supabase request: use the Supabase flow instead.

## Auth Modeling

Keep three authorization concerns distinct:

- Figma/Make access controls who can view or edit the Make file.
- Staff Firebase Auth controls who can manage applications in `/admin`
  (email/password + `FIREBASE_ADMIN_EMAILS` allowlist + session cookie).
- Applicant sessions are anonymous Firebase Auth users tied to the upload and
  application flow; documents and records are scoped by `ownerFirebaseUid`.

Do not build public signup/login unless the user asks for it. Never grant
staff access to applicant accounts, and never bypass the allowlist for
`/admin`.

## Security Rules

- Keep `firestore.rules` deny-all and `storage.rules` create-only for
  anonymous applicants. Client code must never write Firestore directly.
- Private document bytes are only served through authenticated server routes
  (see `src/app/api/admin/...`), never from a public URL.
- Server-only values live in `FIREBASE_*` variables; web config lives in
  `NEXT_PUBLIC_FIREBASE_*` (public by design). Keep service-account keys out
  of source, client bundles, and Payload-like document data.

## Schema Safety

Before changing existing Firestore record shapes, classify the change:

- Greenfield: additive fields and starter records may proceed.
- Existing/follow-up: optional fields and new record types can usually
  proceed with a concise preview.
- Pause for confirmation: deletes, renames, type changes, `required`
  constraints, bulk document updates, and content deletes.

Treat follow-up requests after data exists as existing-app edits. Do not run
destructive or ambiguous document mutations until the user confirms. Route
that confirmation through `ask_user_question` with the affected records,
data-loss risk, and preservation plan, and pass exactly
`options: ["Yes", "No"]` with `multiSelect: false`. End the turn after the
tool call and wait for the user's answer before proceeding.

Firestore is schema-less but record meaning is not: when changing a field's
shape, plan migration or compatibility for existing `applications` documents
before editing code. Make code/version history and Firestore document data are
separate. Rolling back code does not roll back document data.

## Routing

Frontend pages live in `src/app/(frontend)/`. Pages are defined by creating
`page.tsx` files:

- `src/app/(frontend)/page.tsx` - `/`
- `src/app/(frontend)/dashboard/page.tsx` - `/dashboard`
- `src/app/(frontend)/dashboard/angsuran/page.tsx` - `/dashboard/angsuran`

Staff panel is at `/admin`. Dashboard pages that need applicant data are Client
Components: sign in anonymously with `firebase/auth`, obtain an ID token, and
call a `'use server'` action that verifies the token and queries Firestore with
the Admin SDK (see `dashboard/angsuran/actions.ts`,
`dashboard/actions.ts`). Do not query Firestore from the client directly.

## Preview/Proxy Configuration

Keep the Make preview origin configuration intact if present in
`next.config.ts`. If Payload/Make server actions log `Invalid Server Actions
request` with an `x-forwarded-host`/`origin` mismatch, treat it as preview
proxy configuration first. Do not rewrite app routes or disable Server Actions
to work around it.

## Figma Make Scripts

These scripts are called by sboxd to manage the project lifecycle:

- `.figma/make/install` - Install project dependencies (`pnpm install`)
- `.figma/make/dev` - Start the dev server (`next dev --port $PORT --hostname 0.0.0.0`)
- `.figma/make/deploy` - Build, upload, finalize, and report completion through `figma make deploy`
- `.figma/make/deploy-preview` - Build the platform-provided cached preview;
  keep its `.next`/`nextjs` contract intact and delegate packaging/upload
  through `figma make deploy-preview`

Do **not** remove or rename these scripts. They must remain executable.

## Environment Variables

These are injected by sboxd at runtime:

- `FIGMA` - Set to `"1"` when running inside sboxd
- `PORT` - The port to listen on (passed to `next dev` via the dev script)
- `FIGMA_PUBLIC_URL` - The public URL of the site
- `FIGMA_SITE_NAME` - The human-readable site name
- `FIGMA_SITE_DESCRIPTION` - Short site description
- `FIGMA_ASSETS_PATH` - Directory where exported Figma assets are written
- `FIGMA_FAVICON_PATH` - Path to the exported favicon
- `FIGMA_PREVIEW_IMAGE_PATH` - Path to the OG/social preview image
- `FIGMA_PREVIEW_OAUTH_REDIRECT_URI` - Register verbatim with the provider
- `FIGMA_PREVIEW_OAUTH_STATE_PREFIX` - Prefix the app's OAuth `state`

Firebase variables are documented in `FIREBASE_SETUP.md`:

- Server-only: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_ADMIN_EMAILS`
- Public web config: `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SITE_URL`

Xendit payment gateway variables are documented in `XENDIT_SETUP.md`:

- Server-only: `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN` (invoice creation
  and webhook verification for `/dashboard/pembayaran`; never expose them or
  prefix them with `NEXT_PUBLIC_`)

Do not ask the user to paste secret values into chat, code, comments, or docs.
Do not print, log, summarize, or expose secret values. Treat saved environment
variable values as write-only. Add, replace, or delete user-provided
environment variables only when the user explicitly asks for secret or
integration setup. Do not put private values in rendered props, browser
components, or `NEXT_PUBLIC_*` variables.

## File Writing

When writing multiple files, parallelize independent Write calls in a single
response. Files are independent when none depends on another's output at write
time. Batch by dependency layer — don't write files one at a time.

## Important

- The dev server must listen on `$PORT` - do not hardcode a port
- Use `pnpm install` to add new dependencies
- Do not weaken `firestore.rules` or `storage.rules` to make a feature work;
  route access through authenticated server code instead
- Toolchain versions are managed by `.mise.toml`, not installed manually
- This template is Next.js App Router + React 19 + Firebase + Tailwind CSS v4;
  check `package.json` before adding or using other dependencies
- Format changed files with `pnpm format` (oxfmt) before finishing
- Keep `src/app/(payload)/` absent; do not reintroduce Payload routes

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
