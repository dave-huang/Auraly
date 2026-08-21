# Deploying Revely

Two things ship: the API server (Docker → Fly.io) and the iOS app (EAS →
TestFlight). The app cannot be built until the API has a public URL, because
`mobile/src/lib/config.ts` throws at startup when `EXPO_PUBLIC_API_URL` is
unset in a production build.

---

## 1. API server

### What is already done

- `Dockerfile` — two stages, production dependencies only in the runtime image.
- `fly.toml` — health check on `/api/healthz`, 1GB machine, one always warm.
- `.dockerignore` — excludes `mobile/` (4.7GB), `attached_assets/` (62MB) and
  every `.env`.
- `npm run build:server` — bundles the server without the legacy web client.
- `GET /api/healthz` — returns 503 if Postgres is unreachable.

Verified locally: the bundle boots with production dependencies only, loads the
substance registry, evidence records and knowledge base from `server/data`, and
answers the health check. **The Docker image itself has not been built** —
Docker is not installed on this machine.

### Steps

```bash
brew install flyctl && fly auth login
```

Create the app. Use `apps create` rather than `fly launch` — `launch` runs a
framework scanner that will rewrite the committed `fly.toml`, and the region,
memory size and health check in it were chosen deliberately.

```bash
fly apps create revely-api
```

Set every secret. These are read from the environment, never from a file:

```bash
fly secrets set DATABASE_URL="..." SESSION_SECRET="..." OPENAI_API_KEY="..." GEMINI_API_KEY="..." GOOGLE_CLOUD_VISION_API_KEY="..." RESEND_API_KEY="..." RESEND_FROM_EMAIL="..." FEEDBACK_EMAIL="..." PUBLIC_BASE_URL="https://revely-api.fly.dev"
```

Then:

```bash
fly deploy
```

```bash
curl https://revely-api.fly.dev/api/healthz && curl https://revely-api.fly.dev/api/readyz
```

`healthz` is liveness: 200 whenever the process serves HTTP, with database
status in the body. `readyz` is strict: 503 with the driver's own error message
when Postgres is unreachable. Monitoring goes on `readyz`, the platform health
check on `healthz` — gating the deploy on the database means a database problem
blocks deploying its own fix.

### Setting secrets: use single quotes

Both failures on the first deploy were shell quoting, not the application:

- A `$` or `&` inside double quotes is expanded or splits the command, which
  silently truncates the connection string. The symptom was
  `getaddrinfo ENOTFOUND base` — the driver resolving a host named `base`,
  the tail of a `database` that had been cut in half.
- `password authentication failed for user 'USER'` means a placeholder was
  pasted literally.

Copy the value across rather than retyping it. Command substitution inside
double quotes is not re-expanded, so this is safe:

```bash
fly secrets set -a revely-api DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)"
```

### Before the first deploy

- **Neon must be reachable from Fly.** It is a hosted Postgres over TLS, so it
  will be, but the connection string needs `sslmode=require`.
- **Run migrations against production** with `DATABASE_URL=<prod> npm run db:push`.
  Nothing in the container does this at boot, deliberately — a schema change
  should be a decision, not a side effect of a restart.
- **`SESSION_SECRET` must be a fresh random value**, not the local one.
- **Do not set `DEV_USER_ID` / `DEV_USER_EMAIL` / `ALLOW_DEV_LOGIN`.** They
  enable the sign-in shortcut in `server/localAuth.ts`.
- **`analysis_cache.json` is written to the working directory** and the
  container filesystem is ephemeral, so the disk cache resets on every deploy.
  Harmless — it is a cost optimisation, not state — but it means the first
  scans after a deploy are slower.

---

## 2. iOS app

### What is already done

- `mobile/eas.json` — `simulator`, `preview` and `production` profiles, each
  pointing `EXPO_PUBLIC_API_URL` at `https://revely-api.fly.dev`.
- `mobile/app.json` — bundle ID `life.revely.app`, icons, splash, Apple Sign-In
  entitlement, camera and photo-library usage strings.

### Steps only you can do

These need an Apple Developer account (US$99/year) and your credentials, so
they are yours to run — I cannot sign in to Apple or App Store Connect.

1. **Enrol in the Apple Developer Program** if you have not already.
2. **Create the app record** in App Store Connect with bundle ID
   `life.revely.app`. Note the numeric App ID it gives you.
3. **Fill in the three placeholders** in `mobile/eas.json` under
   `submit.production.ios`: your Apple ID email, that numeric App ID, and your
   Team ID (Apple Developer → Membership).
4. **Install and link EAS:**

```bash
npm install -g eas-cli && eas login
```

```bash
cd mobile && eas init
```

5. **First build:**

```bash
cd mobile && eas build --platform ios --profile production
```

6. **Submit to TestFlight:**

```bash
cd mobile && eas submit --platform ios --profile production
```

### Known gaps in the app config

- **`mobile/ios/` is a local build directory, not part of the build input.**
  `mobile/.gitignore` lists `/ios`, and EAS archives the project through git,
  so the cloud build never receives it and runs `prebuild` from `app.json`
  itself. That is the behaviour we want — `app.json` stays the single source of
  truth for icons, permissions and plugins. It also means a local
  `npx expo prebuild` is only ever for local `run:ios`, and never a
  prerequisite for an EAS build.
- **Google Sign-In has no client IDs, on either side.** Both
  `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_WEB_CLIENT_ID` in the repo-root `.env` are
  **empty strings** — checked 2026-08-15, not merely absent from `mobile/`.
  Google sign-in has therefore never worked, and the server would reject any
  token anyway (`server/mobileAuth.ts` throws when neither client ID is set).
  The sign-in screen now hides the Google button unless
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is set at build time, so a TestFlight
  tester sees Apple Sign-In only rather than a button that errors on tap.
  To enable it: create an OAuth client in Google Cloud Console, then put the
  iOS and web client IDs in the `env` block of each build profile in
  `mobile/eas.json` under their `EXPO_PUBLIC_` names, and set the matching
  `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_WEB_CLIENT_ID` as Fly secrets. OAuth client
  IDs are public identifiers that ship inside the app binary, so committing
  them is normal. Apple Sign-In needs nothing extra and already works — and is
  sufficient on its own for iOS.
- **Android has never been built.** There is no `mobile/android/` directory and
  no Android profile in `eas.json`.

---

## 3. App Store review blockers

These are not optional and none of them are built yet.

- **Privacy policy URL and terms URL.** Required at submission. Nothing in the
  app links to either.
- **Privacy nutrition labels** in App Store Connect — declare that the app
  collects health-related data (dietary conditions, allergies, pregnancy
  status) and account identifiers.
- **Screenshots** at the required sizes, description, keywords, support URL.
- **Age rating**, including the medical/treatment questions.
- **Account deletion** — already built (`DELETE /api/account`, reachable from
  the account screen). This is a hard requirement and it is met.
- **Health disclaimer** — `results.disclaimer` states the app gives ingredient
  information, not medical advice, and is shown on results. Expect review to
  look for it.
