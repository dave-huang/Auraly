import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * The host that serves real users' data.
 *
 * Recorded here, in the open, because it is not a secret — it is the public
 * hostname half of a connection string whose password lives in the environment.
 * What it buys is the check below.
 */
const PRODUCTION_DB_HOST = 'ep-small-term-ayv7p5i8.c-5.us-east-2.aws.neon.tech';

/**
 * The database production used to live in, before 24 August 2026.
 *
 * Kept because it is still running and still holds every row it held at
 * cutover — it is the rollback, for as long as that is worth having. Pointing
 * anything at it now is a mistake in both directions: it is not production any
 * more, so writes there are lost, and it is not a scratch database either.
 */
const RETIRED_DB_HOST = 'ep-sparkling-boat-ae3ij9vz.c-2.us-east-2.aws.neon.tech';

/**
 * Refuse to run a development server against the production database.
 *
 * For a long time `.env` held the production connection string, so every local
 * run — every `npm run dev`, every one-off script, every experiment — read and
 * wrote the database real people's scans and allergy profiles live in. Nothing
 * went wrong, which is the only reason it lasted: the failure mode is not a
 * crash, it is a `drizzle-kit push` against the wrong database on an ordinary
 * afternoon, and by then it has already happened.
 *
 * Neon branches make the fix free — a branch is copy-on-write, so local dev
 * gets production-shaped data without touching production. This is what makes
 * remembering to use it unnecessary.
 *
 * Production is unaffected: NODE_ENV is `production` there, and this only
 * speaks up outside it. The escape hatch exists because reading production from
 * a local script is sometimes exactly the intent — measuring corpus coverage
 * against real scans, for one — and it has to be typed each time rather than
 * left set, which is the difference between a decision and a default.
 */
function assertNotProductionDatabase(url: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.ALLOW_PRODUCTION_DB === 'true') {
    console.warn(
      `[DB] Connecting to PRODUCTION (${PRODUCTION_DB_HOST}) because ` +
        'ALLOW_PRODUCTION_DB=true. Writes here reach real users.',
    );
    return;
  }
  if (url.includes(RETIRED_DB_HOST)) {
    throw new Error(
      `DATABASE_URL points at the RETIRED production database (${RETIRED_DB_HOST}).\n\n` +
        `Production moved to ${PRODUCTION_DB_HOST} on 2026-08-24. The old database is ` +
        `still running as a rollback and still holds the data it had at cutover, but it ` +
        `is no longer read by anything — writes there go nowhere.\n\n` +
        `Use the dev branch: npx neonctl connection-string dev --project-id icy-dust-42865450`,
    );
  }

  if (!url.includes(PRODUCTION_DB_HOST)) return;

  throw new Error(
    `DATABASE_URL points at the production database (${PRODUCTION_DB_HOST}) and ` +
      `NODE_ENV is not production.\n\n` +
      `Point .env at the dev branch instead — it is copy-on-write off production, ` +
      `so it costs nothing and starts with production's data:\n` +
      `  npx neonctl connection-string dev --project-id icy-dust-42865450\n\n` +
      `If reading production really is the intent, say so for this command only:\n` +
      `  ALLOW_PRODUCTION_DB=true npm run <script>`,
  );
}

assertNotProductionDatabase(process.env.DATABASE_URL);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
