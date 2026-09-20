# The liveness probe that used up the database, 20 September 2026

Production could not reach Postgres for an unknown length of time, ending the
morning of 20 September. Nobody was using the app, so nobody reported it. The
one visitor who mattered was Apple: version 1.0.1 had been in App Review for
about a day, and a reviewer who tried to sign in would have found it broken.

The cause was our own health check.

No em dashes anywhere in this file.

## What happened

`fly.toml` polls `/api/healthz` every 30 seconds. That endpoint ran
`select 1` so it could report database state in its response body. Those two
facts together are 2,880 queries a day and 86,400 a month, arriving evenly
around the clock.

Neon suspends a compute after about five minutes of inactivity, which is what
makes its smaller plans cheap. Our probe never left a five minute gap, so the
compute never suspended. With no users, no scans and no traffic, the main
branch was awake an average of 16.3 hours a day.

By the time we looked, the project had been cut off with Postgres error
`53000`, quota exceeded, and the API had been answering `"database":"down"`
for long enough that nobody could have signed in.

The counters, read from the Neon API on 20 September, cover the project's life
since 24 August:

| | active time | compute | share |
|---|---|---|---|
| `main` | 441 hours, 16.3 h/day | 110.2 CU-hours | everything |
| `dev` | 0.08 hours | 0.02 CU-hours | nothing |

Storage was 38 MB against a 500 MB allowance, so storage was never the issue.
The exact limit that tripped is only visible in the Neon console: the
consumption API is gated to paid plans, which is its own small irony given
what the incident was about.

## Why it went unnoticed

Three things hid it, and all three are worth remembering.

**The endpoint reports `status: ok` while saying the database is down.** That
is deliberate, and the reasoning at `server/routes.ts` still holds: a liveness
probe that fails on a database outage turns every database problem into
"deploy timed out waiting for health checks", which is indistinguishable from
a container that never booted, and it blocks deploying the fix. The cost of
that design is that `"status":"ok"` sits at the front of the response and the
real news sits in the second field.

**The marketing site stayed up.** revely.life returns 200 without touching
Postgres, so the obvious check looked fine.

**Nobody was watching, because there is nobody yet.** Pre-launch, the app has
no users to report an outage, so there is no alarm except the one you build.

## Why it was found at all

By accident. We wanted to know whether the `ingredient-hierarchy` branch's
scan-history migration would need a backfill, which meant counting rows in
production.

The first attempt wrapped each count in `try/catch` and printed "no table" on
failure. Every table came back "no table", which read as an empty database and
was in fact an unreachable one: the catch swallowed the quota error and
replaced it with a wrong answer. A diagnostic that turns an unexpected failure
into a plausible-looking result is worse than one that crashes.

## The fix

Commit `e25daa4`, deployed 20 September.

`/api/healthz` no longer touches Postgres. It answers from memory: process
uptime, corpus versions, policy version. The `database` field now reads
`see /api/readyz` rather than being a value bought with a query every 30
seconds. The probe never used the answer anyway, since it returns 200 either
way by design.

`/api/readyz` is unchanged. It still runs `select 1` and still returns 503 when
that fails. The difference is that something calls it on purpose, rather than
a timer calling it forever.

Verified after deploy:

    /api/healthz  {"status":"ok","database":"see /api/readyz","uptimeSeconds":23}
    /api/readyz   {"status":"ready","database":"up","checkedInMs":102}  HTTP 200

The plan was separately upgraded from free to launch, which is what actually
restored service. The commit stops it recurring; it did not undo it.

## Rules this leaves behind

**A liveness probe must not touch the database.** It runs forever, on a timer,
whether or not anyone is using the product. Anything it touches is something
you are paying to keep awake. The rule is now written into `fly.toml` next to
the check itself, because that is where someone will be standing when they
consider adding one.

**Separate liveness from readiness, and point each at its own thing.**
Liveness answers "is this process alive", readiness answers "can it do useful
work". Only the second needs the database, and only it should be strict.

**Idle infrastructure is not free infrastructure.** Scale-to-zero only works
if something is actually allowed to reach zero. Before assuming a resource is
idle, check what is keeping it awake: health checks, connection pools with
long idle timeouts, cron jobs, uptime monitors.

**Make a diagnostic fail loudly.** The `catch` that printed "no table" cost a
round trip and pointed at the wrong conclusion. When a check cannot answer,
say why, do not substitute an answer that looks like data.

**Watch what the meter does after a fix.** The compute should now idle between
real requests. If the daily active time does not drop sharply over the next
few days, something else is holding a connection open, and the fix was
incomplete.
