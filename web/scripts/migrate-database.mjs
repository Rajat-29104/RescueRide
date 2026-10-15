import { readdir, readFile } from 'node:fs/promises'
import { pool } from '../src/lib/db.js'

const migrationDirectory = new URL('../database/migrations/', import.meta.url)

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      migration_id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const migrationFiles = (await readdir(migrationDirectory))
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
    .sort()

  for (const migrationFile of migrationFiles) {
    const migrationId = migrationFile.replace(/\.sql$/i, '')
    const existing = await pool.query(
      'SELECT 1 FROM app_schema_migrations WHERE migration_id = $1',
      [migrationId]
    )

    if (existing.rowCount > 0) {
      console.log(`Migration ${migrationId} is already applied.`)
      continue
    }

    const sql = await readFile(new URL(migrationFile, migrationDirectory), 'utf8')
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO app_schema_migrations (migration_id) VALUES ($1)',
        [migrationId]
      )
      await client.query('COMMIT')
      console.log(`Applied migration ${migrationId}.`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
} finally {
  await pool.end()
}
