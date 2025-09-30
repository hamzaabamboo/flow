import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../drizzle/schema';

// HamCloud database connection
const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hamflow';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export type Database = typeof db;
