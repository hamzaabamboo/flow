#!/usr/bin/env bun
/**
 * Seed script to populate the database with sample data
 * Run with: bun run scripts/seed-db.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, boards, columns, tasks, inboxItems, reminders, habits } from '../src/drizzle/schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hamflow';
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // Create test user
    console.log('Creating test user...');
    const [testUser] = await db.insert(users).values({
      id: 'test-user-1',
      email: 'demo@hamflow.app',
      name: 'Demo User',
      createdAt: new Date()
    }).returning();

    console.log('✓ User created:', testUser.email);

    // Create boards for both spaces
    console.log('\nCreating boards...');
    const [workBoard] = await db.insert(boards).values({
      name: 'Q1 Projects',
      space: 'work',
      userId: testUser.id,
      columnOrder: ['todo', 'in-progress', 'done']
    }).returning();

    const [personalBoard] = await db.insert(boards).values({
      name: 'Home Tasks',
      space: 'personal',
      userId: testUser.id,
      columnOrder: ['backlog', 'this-week', 'complete']
    }).returning();

    console.log('✓ Boards created:', workBoard.name, personalBoard.name);

    // Create columns for work board
    console.log('\nCreating columns...');
    const [todoCol] = await db.insert(columns).values({
      id: 'todo',
      name: 'To Do',
      boardId: workBoard.id,
      position: 0,
      taskOrder: []
    }).returning();

    const [inProgressCol] = await db.insert(columns).values({
      id: 'in-progress',
      name: 'In Progress',
      boardId: workBoard.id,
      position: 1,
      taskOrder: []
    }).returning();

    const [doneCol] = await db.insert(columns).values({
      id: 'done',
      name: 'Done',
      boardId: workBoard.id,
      position: 2,
      taskOrder: []
    }).returning();

    console.log('✓ Columns created for work board');

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
        targetCount: 1,
        userId: testUser.id,
        streak: 5
      },
      {
        name: 'Read for 30 minutes',
        frequency: 'daily',
        targetCount: 1,
        userId: testUser.id,
        streak: 3
      },
      {
        name: 'Weekly Review',
        frequency: 'weekly',
        targetCount: 1,
        userId: testUser.id,
        streak: 2
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