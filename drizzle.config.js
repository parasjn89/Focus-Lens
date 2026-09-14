import 'dotenv/config';

export default {
  schema: './server/db/schema.js',
  out: './server/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/focuslens',
  },
};
