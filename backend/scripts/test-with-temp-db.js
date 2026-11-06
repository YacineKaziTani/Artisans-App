#!/usr/bin/env node
// Runs the integration tests against a brand-new, throwaway database, and
// always drops it afterwards — your real database is never touched.
//
// The database is created on the Postgres server named by TEST_DB_SERVER_URL,
// or, if that isn't set, the server in DATABASE_URL (backend/.env). Only a
// separate database called artisans_test_<timestamp> is created there; the
// database in the URL itself is never connected to for anything but the
// CREATE/DROP DATABASE statements.
//
//   npm run test:tempdb

const path = require("path");
const { spawnSync } = require("child_process");
const { Client } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const serverUrl = process.env.TEST_DB_SERVER_URL || process.env.DATABASE_URL;
if (!serverUrl) {
  console.error("Set TEST_DB_SERVER_URL (or DATABASE_URL in backend/.env) to a Postgres server URL.");
  process.exit(1);
}

const ssl = process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false };
const tempDb = `artisans_test_${Date.now()}`;

/** Same server, different database. Neon's pooler can't run CREATE DATABASE. */
function urlFor(database) {
  const url = new URL(serverUrl);
  url.hostname = url.hostname.replace("-pooler", "");
  if (database) url.pathname = `/${database}`;
  return url.toString();
}

async function admin(sql) {
  const client = new Client({ connectionString: urlFor(), ssl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

(async () => {
  console.log(`Creating throwaway database ${tempDb} on ${new URL(serverUrl).hostname}…`);
  await admin(`CREATE DATABASE ${tempDb}`);

  let status = 1;
  try {
    const result = spawnSync(
      process.execPath,
      ["-r", "ts-node/register/transpile-only", path.join("test", "run.ts")],
      {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
        env: {
          ...process.env,
          TEST_DATABASE_URL: urlFor(tempDb),
          DB_SSL: ssl ? "true" : "false",
          TS_NODE_PROJECT: "tsconfig.test.json",
        },
      },
    );
    status = result.status ?? 1;
  } finally {
    try {
      await admin(`DROP DATABASE IF EXISTS ${tempDb} WITH (FORCE)`);
      console.log(`Dropped ${tempDb}.`);
    } catch (err) {
      console.error(`Couldn't drop ${tempDb} — remove it by hand:`, err.message);
      status = status || 1;
    }
  }
  process.exit(status);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
