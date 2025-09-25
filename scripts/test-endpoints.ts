#!/usr/bin/env bun
/**
 * Test script to verify all API endpoints are working
 * Run with: bun run scripts/test-endpoints.ts
 */

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Test user credentials
const testUser = {
  email: 'test@example.com',
  password: 'password123'
};

let authToken: string | null = null;
let userId: string | null = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message: string, type: 'success' | 'error' | 'info' | 'warn' = 'info') {
  const color = {
    success: colors.green,
    error: colors.red,
    info: colors.blue,
    warn: colors.yellow
  }[type];

  console.log(`${color}${message}${colors.reset}`);
}

async function testEndpoint(
  name: string,
  method: string,
  path: string,
  body?: any,
  requiresAuth = true
) {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (requiresAuth && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      log(`  ✗ ${name}: ${response.status} - ${JSON.stringify(data)}`, 'error');
      return false;
    }

    log(`  ✓ ${name}`, 'success');
    return data;
  } catch (error) {
    log(`  ✗ ${name}: ${error}`, 'error');
    return false;
  }
}

async function runTests() {
  log('\n🧪 Testing HamFlow API Endpoints\n', 'info');

  // Test 1: Health Check
  log('1. Testing Server Health...', 'info');
  const health = await testEndpoint('Server is running', 'GET', '/', null, false);

  // Test 2: Authentication
  log('\n2. Testing Authentication...', 'info');

  // Register user
  const registerResult = await testEndpoint(
    'Register user',
    'POST',
    '/auth/register',
    testUser,
    false
  );

  // Login
  const loginResult = await testEndpoint(
    'Login user',
    'POST',
    '/auth/login',
    testUser,
    false
  );

  if (loginResult) {
    authToken = loginResult.token;
    userId = loginResult.user?.id;
    log(`  Token received: ${authToken?.substring(0, 20)}...`, 'info');
  }

  // Test 3: Boards
  log('\n3. Testing Boards API...', 'info');

  const boardResult = await testEndpoint('Create board', 'POST', '/api/boards', {
    name: 'Test Board',
    space: 'work'
  });

  const boardId = boardResult?.id;

  await testEndpoint('Get boards', 'GET', '/api/boards?space=work');

  // Test 4: Columns (if board was created)
  if (boardId) {
    log('\n4. Testing Columns API...', 'info');

    const columnResult = await testEndpoint('Create column', 'POST', '/api/columns', {
      boardId,
      name: 'To Do',
      position: 0
    });

    const columnId = columnResult?.id;

    // Test 5: Tasks (if column was created)
    if (columnId) {
      log('\n5. Testing Tasks API...', 'info');

      const taskResult = await testEndpoint('Create task', 'POST', '/api/tasks', {
        columnId,
        title: 'Test Task',
        description: 'This is a test task'
      });

      const taskId = taskResult?.id;

      await testEndpoint('Get column tasks', 'GET', `/api/tasks/${columnId}`);

      if (taskId) {
        await testEndpoint('Update task', 'PATCH', `/api/tasks/${taskId}`, {
          completed: true
        });
      }
    }
  }

  // Test 6: Inbox
  log('\n6. Testing Inbox API...', 'info');

  const inboxResult = await testEndpoint('Create inbox item', 'POST', '/api/inbox', {
    title: 'Test Inbox Item',
    space: 'work',
    source: 'manual'
  });

  await testEndpoint('Get inbox items', 'GET', '/api/inbox?space=work');

  // Test 7: Command Processing
  log('\n7. Testing Command API...', 'info');

  await testEndpoint('Process command', 'POST', '/api/command', {
    command: 'Add task Buy groceries',
    space: 'personal'
  });

  // Test 8: Pomodoro
  log('\n8. Testing Pomodoro API...', 'info');

  await testEndpoint('Save pomodoro session', 'POST', '/api/pomodoro', {
    duration: 25,
    type: 'work'
  });

  await testEndpoint('Get pomodoro sessions', 'GET', '/api/pomodoro');
  await testEndpoint('Get pomodoro stats', 'GET', '/api/pomodoro/stats?period=week');

  // Test 9: WebSocket
  log('\n9. Testing WebSocket Connection...', 'info');

  try {
    const ws = new WebSocket('ws://localhost:3000/ws');

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        log('  ✓ WebSocket connected', 'success');
        ws.close();
        resolve();
      };
      ws.onerror = (error) => {
        log(`  ✗ WebSocket connection failed: ${error}`, 'error');
        reject(error);
      };

      setTimeout(() => {
        log('  ✗ WebSocket connection timeout', 'error');
        reject(new Error('Timeout'));
      }, 5000);
    });
  } catch (error) {
    // WebSocket error already logged
  }

  // Test 10: Webhooks (public endpoints)
  log('\n10. Testing Webhook Endpoints...', 'info');

  await testEndpoint('HamBot webhook', 'POST', '/webhook/hambot', {
    message: {
      text: 'Test message from HamBot',
      from: 'TestBot'
    },
    userId: userId || 'test-user'
  }, false);

  log('\n✅ API endpoint tests completed!\n', 'success');
}

// Run tests
runTests().catch((error) => {
  log(`\n❌ Test failed: ${error}`, 'error');
  process.exit(1);
});