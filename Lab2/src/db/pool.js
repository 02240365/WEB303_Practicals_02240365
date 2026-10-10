/**
 * db/pool.js
 * -----------------------------------------------------------------------
 * PostgreSQL connection pool setup for the Student Records module (Lab 5).
 *
 * getPool() / setPool() wrap a single mutable pool reference so the exact
 * same application code (src/routes/students.js) can be pointed at two
 * different databases without any code changes:
 *   1. A local PostgreSQL container started via docker-compose, while the
 *      app runs normally - this is the default, created automatically
 *      below from DATABASE_URL.
 *   2. An ephemeral Testcontainers PostgreSQL instance while integration
 *      tests run - the tests call setPool() to swap it before making
 *      requests (see tests/studentRoutes.integration.test.js).
 *
 * pg.Pool does NOT connect immediately when constructed - connections are
 * opened lazily on first query. This means simply requiring server.js (as
 * the existing Lab 2 Jest tests do) never needs a database to be running.
 * -----------------------------------------------------------------------
 */
const { Pool } = require('pg');

const DEFAULT_DATABASE_URL = 'postgresql://sms_user:sms_password@localhost:5432/sms_db';

function createPool(connectionString) {
  return new Pool({
    connectionString: connectionString || process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  });
}

/**
 * Creates the `student_records` table if it doesn't already exist.
 * Safe to call every time the app starts (idempotent).
 * @param {import('pg').Pool} targetPool
 */
async function initSchema(targetPool) {
  await targetPool.query(`
    CREATE TABLE IF NOT EXISTS student_records (
      id SERIAL PRIMARY KEY,
      student_id VARCHAR(8) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL,
      programme VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

let currentPool = createPool();

/** Returns the pool currently in use (read fresh on every call). */
function getPool() {
  return currentPool;
}

/** Swaps the pool used by the whole app - used by integration tests. */
function setPool(newPool) {
  currentPool = newPool;
}

module.exports = { getPool, setPool, createPool, initSchema };
