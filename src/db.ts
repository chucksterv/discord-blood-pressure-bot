import { Pool } from 'pg';

export const pool = new Pool();

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blood_pressure_readings 
    (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      l_systolic INTEGER,
      l_diastolic INTEGER,
      r_systolic INTEGER,
      r_diastolic INTEGER
    )
  `);
}

