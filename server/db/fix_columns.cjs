const pg = require('pg');
require('dotenv').config({ path: 'd:/Focus Lens/.env' });

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/focuslens';

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');

    const res = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'activity_segments';
    `);

    const cols = res.rows.map(r => r.column_name);
    console.log('Current activity_segments columns:', cols);

    if (cols.includes('confidencetype') && !cols.includes('confidence_type')) {
      console.log('Renaming confidencetype to confidence_type...');
      await client.query('ALTER TABLE activity_segments RENAME COLUMN confidencetype TO confidence_type;');
      console.log('Renamed confidencetype to confidence_type!');
    } else if (!cols.includes('confidence_type')) {
      console.log('Adding confidence_type column...');
      await client.query("ALTER TABLE activity_segments ADD COLUMN IF NOT EXISTS confidence_type TEXT NOT NULL DEFAULT 'heuristic';");
      console.log('Added confidence_type column!');
    } else {
      console.log('confidence_type column is present.');
    }

    const updatedRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'activity_segments';
    `);
    console.log('Updated activity_segments columns:', updatedRes.rows.map(r => r.column_name));

    await client.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
