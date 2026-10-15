import { Pool } from 'pg'

const globalForPostgres = globalThis

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to web/.env.local.')
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
}

export const pool = globalForPostgres.roadRescuePostgresPool || createPool()

if (process.env.NODE_ENV !== 'production') {
  globalForPostgres.roadRescuePostgresPool = pool
}

export function query(text, values) {
  return pool.query(text, values)
}
