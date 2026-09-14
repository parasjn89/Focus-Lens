const pg = require('pg');
require('dotenv').config({ path: 'd:/Focus Lens/.env' });

async function inspect() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('=== DATABASE INSPECTION ===');

  const colsRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log('\nUsers Table Columns:');
  console.table(colsRes.rows);

  const usersRes = await client.query(`
    SELECT id, email, name, phone_number, verification_status, created_at
    FROM users;
  `);
  console.log('\nExisting Users Count:', usersRes.rows.length);
  console.table(usersRes.rows);

  const phoneDupes = await client.query(`
    SELECT phone_number, COUNT(*)
    FROM users
    WHERE phone_number IS NOT NULL AND phone_number != ''
    GROUP BY phone_number
    HAVING COUNT(*) > 1;
  `);
  console.log('\nDuplicate Phone Numbers Count:', phoneDupes.rows.length);

  const emailDupes = await client.query(`
    SELECT email, COUNT(*)
    FROM users
    WHERE email IS NOT NULL AND email != ''
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1;
  `);
  console.log('Duplicate Emails Count:', emailDupes.rows.length);

  await client.end();
}

inspect().catch(console.error);
