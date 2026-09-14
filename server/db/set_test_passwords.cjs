const pg = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: 'd:/Focus Lens/.env' });

async function setTestPasswords() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const saltRounds = 10;
  const hash = await bcrypt.hash('Password123!@#', saltRounds);

  // Ensure parasjainpj1905@gmail.com exists with password
  await client.query(`
    INSERT INTO users (id, email, name, password_hash, verification_status)
    VALUES (gen_random_uuid(), 'parasjainpj1905@gmail.com', 'Paras Jain', $1, 'VERIFIED')
    ON CONFLICT (email) DO UPDATE SET password_hash = $1, verification_status = 'VERIFIED';
  `, [hash]);

  // Ensure namand369@gmail.com exists with password
  await client.query(`
    INSERT INTO users (id, email, name, password_hash, verification_status)
    VALUES (gen_random_uuid(), 'namand369@gmail.com', 'Naman D', $1, 'VERIFIED')
    ON CONFLICT (email) DO UPDATE SET password_hash = $1, verification_status = 'VERIFIED';
  `, [hash]);

  console.log('Test passwords set for Paras and Naman successfully.');
  await client.end();
}

setTestPasswords().catch(console.error);
