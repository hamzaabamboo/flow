#!/usr/bin/env bun
/**
 * Seed script to populate the database with sample data
 * Run with: bun run scripts/seed-db.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { randomUUID } from 'crypto';
import { users, boards, columns, tasks, inboxItems, reminders, habits } from '../drizzle/schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hamflow';
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // Create test user
    console.log('Creating test user...');
    const [testUser] = await db.insert(users).values({
      email: 'demo@hamflow.app',
      name: 'Demo User',
      createdAt: new Date()
    }).returning();

    console.log('✓ User created:', testUser.email);

    // Create boards for both spaces
    console.log('\nCreating boards...');

    const workBoardColumns = [
      { id: randomUUID(), name: 'To Do', position: 0 },
      { id: randomUUID(), name: 'In Progress', position: 1 },
      { id: randomUUID(), name: 'Done', position: 2 }
    ];

    const personalBoardColumns = [
      { id: randomUUID(), name: 'Backlog', position: 0 },
      { id: randomUUID(), name: 'This Week', position: 1 },
      { id: randomUUID(), name: 'Complete', position: 2 }
    ];

    const [workBoard] = await db.insert(boards).values({
      name: 'Q1 Projects',
      space: 'work',
      userId: testUser.id,
      columnOrder: workBoardColumns.map(c => c.id)
    }).returning();

    const [personalBoard] = await db.insert(boards).values({
      name: 'Home Tasks',
      space: 'personal',
      userId: testUser.id,
      columnOrder: personalBoardColumns.map(c => c.id)
    }).returning();

    console.log('✓ Boards created:', workBoard.name, personalBoard.name);

    // Create columns for boards
    console.log('\nCreating columns...');
    const todoCol = (await db.insert(columns).values({
      ...workBoardColumns[0],
      boardId: workBoard.id,
      taskOrder: []
    }).returning())[0];

    const inProgressCol = (await db.insert(columns).values({
      ...workBoardColumns[1],
      boardId: workBoard.id,
      taskOrder: []
    }).returning())[0];

    const doneCol = (await db.insert(columns).values({
      ...workBoardColumns[2],
      boardId: workBoard.id,
      taskOrder: []
    }).returning())[0];

    await db.insert(columns).values(personalBoardColumns.map(c => ({
      ...c,
      boardId: personalBoard.id,
      taskOrder: []
    })));

    console.log('✓ Columns created for both boards');

    // Create sample tasks
    console.log('\nCreating tasks...');
    await db.insert(tasks).values([
      {
        title: 'Review Q1 OKRs',
        description: 'Review and update objectives for Q1',
        columnId: todoCol.id,
        userId: testUser.id,
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        title: 'Team sync meeting prep',
        description: 'Prepare agenda and materials for weekly sync',
        columnId: todoCol.id,
        userId: testUser.id,
        priority: 'medium'
      },
      {
        title: 'Code review PR #123',
        description: 'Review and provide feedback on feature branch',
        columnId: inProgressCol.id,
        userId: testUser.id,
        priority: 'high'
      },
      {
        title: 'Update documentation',
        description: 'Update API docs with new endpoints',
        columnId: doneCol.id,
        userId: testUser.id,
        completed: true
      }
    ]);

    console.log('✓ Sample tasks created');

    // Create inbox items
    console.log('\nCreating inbox items...');
    await db.insert(inboxItems).values([
      {
        title: 'Follow up with client about proposal',
        space: 'work',
        source: 'email',
        userId: testUser.id
      },
      {
        title: 'Book dentist appointment',
        space: 'personal',
        source: 'manual',
        userId: testUser.id
      },
      {
        title: 'Research new framework features',
        description: 'Check out the latest updates in React 19',
        space: 'work',
        source: 'command',
        userId: testUser.id
      }
    ]);

    console.log('✓ Inbox items created');

    // Create reminders
    console.log('\nCreating reminders...');
    await db.insert(reminders).values([
      {
        message: 'Stand-up meeting in 15 minutes',
        reminderTime: new Date(Date.now() + 15 * 60 * 1000),
        userId: testUser.id,
        taskId: null,
        sent: false
      },
      {
        message: 'Submit timesheet',
        reminderTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        userId: testUser.id,
        taskId: null,
        sent: false
      }
    ]);

    console.log('✓ Reminders created');

    // Create habits
    console.log('\nCreating habits...');
    await db.insert(habits).values([
      {
        name: 'Morning Exercise',
        frequency: 'daily',
        userId: testUser.id,
        space: 'personal'
      },
      {
        name: 'Read for 30 minutes',
        frequency: 'daily',
        userId: testUser.id,
        space: 'personal'
      },
      {
        name: 'Weekly Review',
        frequency: 'weekly',
        userId: testUser.id,
        space: 'personal'
      }
    ]);

    console.log('✓ Habits created');

    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest credentials:');
    console.log('  Email: demo@hamflow.app');
    console.log('  Password: demo123\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run seed
seed();