import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// HamCloud database connection
const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hamflow';

const client = postgres(connectionString);
export const db = drizzle(client);

export type Database = typeof db;
