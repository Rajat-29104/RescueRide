import { pool } from '../src/lib/db.js'

try {
  const { rows } = await pool.query(`
    SELECT
      current_database() AS database,
      current_user AS username,
      current_setting('server_version') AS postgres_version,
      (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis_version,
      (
        SELECT count(*)::integer
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ) AS public_table_count
  `)

  const database = rows[0]
  console.log(`Connected to database: ${database.database}`)
  console.log(`PostgreSQL version: ${database.postgres_version}`)

  if (!database.postgis_version) {
    throw new Error('PostGIS is not enabled in this database.')
  }

  console.log(`PostGIS version: ${database.postgis_version}`)
  console.log(`Public tables: ${database.public_table_count}`)
} finally {
  await pool.end()
}
