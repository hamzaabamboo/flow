#!/usr/bin/env bun
/**
 * Script to clear all data from the database tables
 * Run with: bun run scripts/clear-db.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hamflow';
const client = postgres(connectionString);
const db = drizzle(client);

async function clearDb() {
  console.log('🧹 Clearing database...');

  try {
    const result = await client`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public';
    `
    const tableNames = result.map((row: { tablename: string }) => row.tablename);

    for (const tableName of tableNames) {
        if (tableName !== '__drizzle_migrations') {
            await db.execute(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
            console.log(`- Cleared table: ${tableName}`);
        }
    }

    console.log('\n✅ Database cleared successfully!');

  } catch (error) {
    console.error('❌ Clearing failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run clearDb
clearDb();