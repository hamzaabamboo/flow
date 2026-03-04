#!/usr/bin/env bun

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  expect?: number[];
  required?: boolean;
  headers?: Record<string, string>;
  redirect?: RequestRedirect;
}

interface RequestResult {
  ok: boolean;
  status: number;
  payload: unknown;
  raw: string;
  headers: Headers;
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let failed = 0;
let warned = 0;
let passed = 0;
const cookieJar = new Map<string, string>();

function paint(message: string, color: string) {
  return `${color}${message}${colors.reset}`;
}

function info(message: string) {
  console.log(paint(message, colors.blue));
}

function pass(message: string) {
  passed++;
  console.log(paint(`  ✓ ${message}`, colors.green));
}

function fail(message: string) {
  failed++;
  console.log(paint(`  ✗ ${message}`, colors.red));
}

function warn(message: string) {
  warned++;
  console.log(paint(`  ! ${message}`, colors.yellow));
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function request(
  name: string,
  method: HttpMethod,
  pathOrUrl: string,
  options: RequestOptions = {}
): Promise<RequestResult> {
  const { body, expect = [200], required = true, headers: extraHeaders = {}, redirect = 'follow' } = options;
  const isAbsolute = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://');
  const url = isAbsolute ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (cookieHeader) {
    (headers as Record<string, string>).Cookie = cookieHeader;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect
  });

  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookieHeaders =
    typeof responseHeaders.getSetCookie === 'function'
      ? responseHeaders.getSetCookie()
      : response.headers.get('set-cookie')
        ? [response.headers.get('set-cookie') as string]
        : [];
  for (const cookie of setCookieHeaders) {
    const [pair] = cookie.split(';');
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      cookieJar.set(key.trim(), value.trim());
    }
  }

  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';

  let payload: unknown = raw;
  const trimmed = raw.trim();
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if ((contentType.includes('application/json') || looksLikeJson) && raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  const ok = expect.includes(response.status);
  if (ok) {
    pass(`${name} (${response.status})`);
  } else {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (required) {
      fail(`${name} (${response.status}) ${detail}`);
    } else {
      warn(`${name} (${response.status}) ${detail}`);
    }
  }

  return {
    ok,
    status: response.status,
    payload,
    raw,
    headers: response.headers
  };
}

async function run() {
  info('\n🧪 Consumer API Sweep\n');

  await request('Health HTML', 'GET', '/', { expect: [200] });
  await request('OIDC auth login redirect', 'GET', '/api/auth/login?space=work&returnUrl=%2F', {
    expect: [302],
    redirect: 'manual'
  });
  await request('OIDC auth me', 'GET', '/api/auth/me', { expect: [200, 401] });
  await request('OIDC auth refresh', 'POST', '/api/auth/refresh', { expect: [200, 401] });

  const boardCreate = await request('Create board', 'POST', '/api/boards', {
    body: { name: `API Sweep ${Date.now()}`, description: 'consumer test board', space: 'work' }
  });
  const board = unwrap<{ id: string; userId: string; columns?: Array<{ id: string; name: string }> }>(
    boardCreate.payload
  );
  const boardId = board?.id;
  const userId = board?.userId;

  await request('List boards', 'GET', '/api/boards?space=work');
  if (boardId) {
    await request('Get board by id', 'GET', `/api/boards/${boardId}`);
    await request('Patch board by id', 'PATCH', `/api/boards/${boardId}`, {
      body: { name: `API Sweep Updated ${Date.now()}`, description: 'updated by consumer sweep' }
    });
    await request('Get board summary', 'GET', `/api/boards/${boardId}/summary`);
  }

  const columnCreate = boardId
    ? await request('Create column', 'POST', '/api/columns', {
        body: { boardId, name: 'API Sweep Column', position: 99 }
      })
    : null;
  const column = unwrap<{ id: string }>(columnCreate?.payload);
  const columnId = column?.id;

  if (columnId) {
    await request('Get column by id', 'GET', `/api/columns/${columnId}`);
    await request('Patch column by id', 'PATCH', `/api/columns/${columnId}`, {
      body: { name: 'API Sweep Column Updated', position: 101, wipLimit: 9 }
    });
  }

  const secondColumnCreate = boardId
    ? await request('Create second column', 'POST', '/api/columns', {
        body: { boardId, name: 'Completed', position: 100 }
      })
    : null;
  const secondColumn = unwrap<{ id: string }>(secondColumnCreate?.payload);
  const secondColumnId = secondColumn?.id;

  if (boardId && columnId && secondColumnId) {
    await request('Reorder columns', 'POST', '/api/columns/reorder', {
      body: { boardId, columnOrder: [columnId, secondColumnId] }
    });
  }

  const recurringDue = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const recurringDate = recurringDue.toISOString().split('T')[0];

  const recurringTaskCreate = columnId
    ? await request('Create recurring task', 'POST', '/api/tasks', {
        body: {
          columnId,
          title: 'API Sweep Recurring',
          description: 'recurring consumer task',
          dueDate: recurringDue.toISOString(),
          priority: 'medium',
          recurringPattern: 'daily'
        }
      })
    : null;
  const recurringTask = recurringTaskCreate?.payload as { id?: string; columnId?: string };
  const recurringTaskId = recurringTask?.id;

  const regularTaskCreate = secondColumnId
    ? await request('Create regular task', 'POST', '/api/tasks', {
        body: {
          columnId: secondColumnId,
          title: 'API Sweep Regular',
          description: 'regular consumer task',
          dueDate: recurringDue.toISOString(),
          priority: 'high'
        }
      })
    : null;
  const regularTask = regularTaskCreate?.payload as { id?: string; columnId?: string };
  const regularTaskId = regularTask?.id;

  if (recurringTaskId) {
    await request('Get task by id', 'GET', `/api/tasks/${recurringTaskId}`);
    await request('Patch recurring task', 'PATCH', `/api/tasks/${recurringTaskId}`, {
      body: { description: 'recurring updated by API sweep' }
    });
    await request('Recurring completion by instance', 'POST', `/api/tasks/${recurringTaskId}/completion`, {
      body: { completed: true, instanceDate: recurringDate }
    });
    await request('Recurring uncomplete by instance', 'POST', `/api/tasks/${recurringTaskId}/completion`, {
      body: { completed: false, instanceDate: recurringDate }
    });
  }

  if (regularTaskId) {
    await request('Regular completion route', 'POST', `/api/tasks/${regularTaskId}/completion`, {
      body: { completed: true }
    });
    await request('Regular uncomplete route', 'POST', `/api/tasks/${regularTaskId}/completion`, {
      body: { completed: false }
    });
    if (secondColumnId) {
      await request(
        'Move regular task to Completed column before semantic checks',
        'PATCH',
        `/api/tasks/${regularTaskId}`,
        {
          body: { columnId: secondColumnId }
        }
      );
    }
  }

  await request('List tasks with filters', 'GET', '/api/tasks?space=all&sortBy=updatedAt&sortOrder=desc');
  const activeTasksResponse = await request(
    'List active tasks (semantic)',
    'GET',
    '/api/tasks?space=all&completed=false'
  );
  const completedTasksResponse = await request(
    'List completed tasks (semantic)',
    'GET',
    '/api/tasks?space=all&completed=true'
  );
  const activeTasks = activeTasksResponse.payload as Array<{
    id: string;
    completed?: boolean;
    completionState?: string;
  }>;
  const completedTasks = completedTasksResponse.payload as Array<{
    id: string;
    completed?: boolean;
    completionState?: string;
  }>;
  const hasNormalizedActive = Array.isArray(activeTasks)
    ? activeTasks.every(
        (task) => typeof task.completed === 'boolean' && typeof task.completionState === 'string'
      )
    : false;
  const hasNormalizedCompleted = Array.isArray(completedTasks)
    ? completedTasks.every(
        (task) => typeof task.completed === 'boolean' && typeof task.completionState === 'string'
      )
    : false;
  if (!hasNormalizedActive || !hasNormalizedCompleted) {
    fail('Task list responses missing normalized completion fields');
  } else {
    pass('Task list responses include normalized completion fields');
  }

  if (regularTaskId) {
    const completedIds = Array.isArray(completedTasks) ? completedTasks.map((task) => task.id) : [];
    if (!completedIds.includes(regularTaskId)) {
      fail('Semantic completed filter did not include task in Completed column');
    } else {
      pass('Semantic completed filter includes tasks in Completed column');
    }
  }

  if (regularTaskId && columnId && secondColumnId) {
    const statsBeforeMove = await request(
      'Get stats badges baseline for completion semantics',
      'GET',
      '/api/stats/badges?space=all'
    );
    const baselineTasks = unwrap<{ tasks?: number }>(statsBeforeMove.payload).tasks;

    await request('Move regular task to active column for stats semantics check', 'PATCH', `/api/tasks/${regularTaskId}`, {
      body: { columnId }
    });
    const statsAfterActivate = await request(
      'Get stats badges after moving to active column',
      'GET',
      '/api/stats/badges?space=all'
    );
    const activeTasks = unwrap<{ tasks?: number }>(statsAfterActivate.payload).tasks;

    await request('Move regular task back to Completed column for stats semantics check', 'PATCH', `/api/tasks/${regularTaskId}`, {
      body: { columnId: secondColumnId }
    });
    const statsAfterRestore = await request(
      'Get stats badges after moving back to Completed column',
      'GET',
      '/api/stats/badges?space=all'
    );
    const restoredTasks = unwrap<{ tasks?: number }>(statsAfterRestore.payload).tasks;

    if (
      typeof baselineTasks === 'number' &&
      typeof activeTasks === 'number' &&
      typeof restoredTasks === 'number'
    ) {
      if (activeTasks !== baselineTasks + 1 || restoredTasks !== baselineTasks) {
        fail('Stats badges task count is inconsistent for Completed column semantics');
      } else {
        pass('Stats badges respect Completed column semantics');
      }
    } else {
      warn('Skipped stats completion semantics assertion due to unexpected payload shape');
    }
  }

  if (recurringTaskId || regularTaskId) {
    await request('Bulk complete tasks', 'POST', '/api/tasks/bulk-complete', {
      body: {
        taskIds: [recurringTaskId, regularTaskId].filter(Boolean),
        completed: true,
        instanceDate: recurringDate
      }
    });
  }

  if (columnId) {
    const columnTasks = await request('List tasks in column', 'GET', `/api/tasks/column/${columnId}`);
    const taskList = (columnTasks.payload as Array<{ id: string }> | null) || [];
    if (taskList.length > 0) {
      await request('Reorder tasks in column', 'POST', '/api/tasks/reorder', {
        body: { columnId, taskIds: taskList.map((t) => t.id).toReversed() }
      });
    }
  }

  const subtaskCreate = regularTaskId
    ? await request('Create subtask', 'POST', '/api/subtasks', {
        body: { taskId: regularTaskId, title: 'API Sweep Subtask' }
      })
    : null;
  const subtask = unwrap<{ id: string }>(subtaskCreate?.payload);
  const subtaskId = subtask?.id;

  if (regularTaskId) {
    await request('List subtasks for task', 'GET', `/api/subtasks/task/${regularTaskId}`);
  }
  if (subtaskId) {
    await request('Patch subtask', 'PATCH', `/api/subtasks/${subtaskId}`, {
      body: { completed: true, title: 'API Sweep Subtask Updated' }
    });
    if (regularTaskId) {
      await request('Reorder subtasks', 'POST', '/api/subtasks/reorder', {
        body: { taskId: regularTaskId, subtaskIds: [subtaskId] }
      });
    }
    await request('Delete subtask', 'DELETE', `/api/subtasks/${subtaskId}`);
  }

  const inboxCreate = await request('Create inbox item', 'POST', '/api/inbox', {
    body: { content: 'API Sweep Inbox Item', space: 'work' }
  });
  const inboxItem = unwrap<{ id: string }>(inboxCreate.payload);
  const inboxItemId = inboxItem?.id;

  await request('List inbox items', 'GET', '/api/inbox?space=work');

  if (inboxItemId && columnId) {
    await request('Convert inbox to task', 'POST', '/api/inbox/convert', {
      body: { itemId: inboxItemId, columnId }
    });
  }

  const inboxDeleteCandidate = await request('Create inbox item for delete', 'POST', '/api/inbox', {
    body: { content: 'API Sweep Inbox Delete', space: 'work' }
  });
  const inboxDeleteItem = unwrap<{ id: string }>(inboxDeleteCandidate.payload);
  if (inboxDeleteItem?.id) {
    await request('Delete inbox item', 'POST', '/api/inbox/delete', {
      body: { itemIds: [inboxDeleteItem.id] }
    });
  }

  await request('Create pomodoro session', 'POST', '/api/pomodoro', {
    body: {
      duration: 25,
      startTime: new Date().toISOString(),
      taskId: regularTaskId || undefined
    }
  });
  await request('List pomodoro sessions', 'GET', '/api/pomodoro');
  await request('Set pomodoro active state', 'POST', '/api/pomodoro/active', {
    body: {
      type: 'work',
      duration: 25,
      timeLeft: 1500,
      isRunning: true,
      completedSessions: 0,
      taskId: regularTaskId || undefined,
      taskTitle: 'API Sweep Regular'
    }
  });
  await request('Get pomodoro active state', 'GET', '/api/pomodoro/active');
  await request('Delete pomodoro active state', 'DELETE', '/api/pomodoro/active');

  const habitCreate = await request('Create habit', 'POST', '/api/habits', {
    body: {
      name: 'API Sweep Habit',
      frequency: 'daily',
      space: 'work',
      color: '#22c55e'
    }
  });
  const habit = habitCreate.payload as { id?: string };
  const habitId = habit?.id;

  const today = new Date().toISOString().split('T')[0];
  await request('List habits for day', 'GET', `/api/habits?date=${today}&space=work&view=day`);
  await request('List habits for week', 'GET', `/api/habits?date=${today}&space=work&view=week`);
  if (habitId) {
    await request('Log habit completion', 'POST', `/api/habits/${habitId}/log`, {
      body: { date: today, completed: true }
    });
    await request('Get habit stats', 'GET', `/api/habits/${habitId}/stats`);
    await request('Patch habit', 'PATCH', `/api/habits/${habitId}`, {
      body: { description: 'updated by API sweep' }
    });
  }

  await request('Search all', 'GET', '/api/search?q=API%20Sweep&type=all&space=all&limit=10');

  const settingsGet = await request('Get settings', 'GET', '/api/settings');
  const settingsPayload = settingsGet.payload as {
    notifications?: {
      enabled: boolean;
      reminders: boolean;
      pomodoroComplete: boolean;
      taskDue: boolean;
      morningSummary?: boolean;
      eveningSummary?: boolean;
      summarySpaces?: ('work' | 'personal')[];
    };
  };

  await request('Patch settings', 'PATCH', '/api/settings', {
    body: {
      notifications: {
        enabled: settingsPayload.notifications?.enabled ?? true,
        reminders: settingsPayload.notifications?.reminders ?? true,
        pomodoroComplete: settingsPayload.notifications?.pomodoroComplete ?? true,
        taskDue: settingsPayload.notifications?.taskDue ?? true,
        morningSummary: settingsPayload.notifications?.morningSummary ?? false,
        eveningSummary: settingsPayload.notifications?.eveningSummary ?? false,
        summarySpaces: settingsPayload.notifications?.summarySpaces ?? ['work', 'personal']
      }
    }
  });

  await request('Get shortcuts', 'GET', '/api/settings/shortcuts');
  await request('Post shortcuts', 'POST', '/api/settings/shortcuts', {
    body: {
      shortcuts: [{ key: 'cmd+alt+t', action: 'api_sweep_test', description: 'api sweep shortcut' }]
    }
  });
  await request('Export settings data', 'GET', '/api/settings/export');
  await request('Import settings data', 'POST', '/api/settings/import', {
    body: { data: { boards: [], tasks: [], inboxItems: [], reminders: [] } }
  });
  await request('Trigger test summary', 'POST', '/api/settings/test-summary', {
    body: { type: 'morning', spaces: ['work'] },
    expect: [200, 500],
    required: false
  });

  const feedUrlResponse = await request('Get calendar feed URL', 'GET', '/api/calendar/feed-url');
  const feed = unwrap<{ url?: string }>(feedUrlResponse.payload);

  const now = new Date();
  const startUnix = Math.floor(new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime() / 1000);
  const endUnix = Math.floor(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).getTime() / 1000);

  await request(
    'Get calendar events',
    'GET',
    `/api/calendar/events?start=${startUnix}&end=${endUnix}&space=all&includeOverdue=true&includeNoDueDate=true&includeUpcoming=true`
  );

  let normalizedFeedUrl: string | null = null;
  if (feed.url) {
    try {
      const base = new URL(BASE_URL);
      const parsed = new URL(feed.url, base);
      normalizedFeedUrl =
        parsed.origin === base.origin
          ? parsed.toString()
          : `${base.origin}${parsed.pathname}${parsed.search}`;
    } catch {
      normalizedFeedUrl = null;
    }
  }

  if (normalizedFeedUrl) {
    await request('Fetch public iCal feed', 'GET', normalizedFeedUrl, { expect: [200] });
  } else {
    fail('Fetch public iCal feed skipped (missing feed URL)');
  }

  const reminderCreate = await request('Create reminder', 'POST', '/api/reminders', {
    body: {
      taskId: regularTaskId || undefined,
      reminderTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      message: 'API Sweep Reminder'
    }
  });
  const reminder = reminderCreate.payload as { id?: string };
  const reminderId = reminder?.id;

  await request('List reminders', 'GET', '/api/reminders');
  if (reminderId) {
    await request('Get reminder by id', 'GET', `/api/reminders/${reminderId}`);
    await request('Patch reminder', 'PATCH', `/api/reminders/${reminderId}`, {
      body: { message: 'API Sweep Reminder Updated' }
    });
    await request('Delete reminder', 'DELETE', `/api/reminders/${reminderId}`);
  }

  await request('Get stats test', 'GET', '/api/stats/test');
  await request('Get stats badges', 'GET', '/api/stats/badges?space=all');
  await request(
    'Get completion analytics',
    'GET',
    `/api/stats/analytics/completions?startDate=${today}&endDate=${today}&space=all`
  );

  await request('List API tokens', 'GET', '/api/api-tokens');
  const tokenCreate = await request('Create API token', 'POST', '/api/api-tokens', {
    body: { name: `API Sweep Token ${Date.now()}` }
  });
  const token = tokenCreate.payload as { id?: string; token?: string };
  if (token?.id) {
    await request('Delete API token', 'DELETE', `/api/api-tokens/${token.id}`);
  }

  await request('List external calendars', 'GET', '/api/external-calendars');

  if (feed.url) {
    const extCreate = await request('Create external calendar', 'POST', '/api/external-calendars', {
      body: {
        name: `API Sweep External ${Date.now()}`,
        icalUrl: feed.url,
        space: 'work',
        color: '#3b82f6'
      },
      expect: [200, 400, 500],
      required: false
    });

    const ext = extCreate.payload as { id?: string };
    if (ext?.id) {
      await request('Patch external calendar', 'PATCH', `/api/external-calendars/${ext.id}`, {
        body: { enabled: false },
        required: false
      });
      await request('Delete external calendar', 'DELETE', `/api/external-calendars/${ext.id}`, {
        required: false
      });
    }
  }

  await request('Check notes enabled', 'GET', '/api/notes/enabled');
  await request('List note collections', 'GET', '/api/notes/collections', {
    expect: [200, 400],
    required: false
  });
  await request('Search notes', 'POST', '/api/notes/search', {
    body: { query: 'API Sweep Notes', limit: 5, offset: 0 },
    expect: [200, 400],
    required: false
  });
  if (regularTaskId) {
    await request('Get note for task', 'GET', `/api/notes/task/${regularTaskId}`);
    await request('Create note', 'POST', '/api/notes/create', {
      body: { title: 'API Sweep Note', text: 'Consumer notes flow', taskId: regularTaskId },
      expect: [200, 400],
      required: false
    });
    await request('Link note to task', 'POST', '/api/notes/link', {
      body: { taskId: regularTaskId, noteId: 'api-sweep-note-id' },
      expect: [200, 400, 404],
      required: false
    });
    await request('Unlink note from task', 'DELETE', `/api/notes/unlink/${regularTaskId}`, {
      expect: [200, 400],
      required: false
    });
  }

  const commandParse = await request('Command parse', 'POST', '/api/command', {
    body: { command: 'add api sweep inbox item', space: 'work' },
    required: false
  });

  const commandPayload = commandParse.payload as { action?: string; data?: Record<string, unknown> };
  if (commandPayload.action && commandPayload.data) {
    await request('Command execute', 'POST', '/api/command/execute', {
      body: {
        action: commandPayload.action,
        data: commandPayload.data,
        space: 'work'
      },
      required: false
    });
  }

  if (userId) {
    await request('Webhook HamBot', 'POST', '/webhook/hambot', {
      body: {
        userId,
        message: {
          id: `api-sweep-${Date.now()}`,
          text: 'API sweep webhook message',
          from: 'API Sweep'
        }
      }
    });
  }

  await request('Webhook GitHub', 'POST', '/webhook/github', {
    body: {
      action: 'closed',
      repository: { full_name: 'hamflow/test' }
    }
  });

  await request('Auto organize API', 'POST', '/api/tasks/auto-organize', {
    body: {
      space: 'work',
      startDate: startUnix,
      endDate: endUnix
    },
    required: false
  });

  if (habitId) {
    await request('Delete habit', 'DELETE', `/api/habits/${habitId}`);
  }

  if (regularTaskId) {
    await request('Delete regular task', 'DELETE', `/api/tasks/${regularTaskId}`);
  }
  if (recurringTaskId) {
    await request('Delete recurring task', 'DELETE', `/api/tasks/${recurringTaskId}`);
  }

  for (const cleanupColumnId of [columnId, secondColumnId].filter(Boolean)) {
    const cleanupTasks = await request(
      `List cleanup tasks in column ${cleanupColumnId}`,
      'GET',
      `/api/tasks/column/${cleanupColumnId}`
    );
    const cleanupTaskList = (cleanupTasks.payload as Array<{ id: string }> | null) || [];
    for (const cleanupTask of cleanupTaskList) {
      await request(`Delete cleanup task ${cleanupTask.id}`, 'DELETE', `/api/tasks/${cleanupTask.id}`);
    }
  }

  if (secondColumnId) {
    await request('Delete second column', 'DELETE', `/api/columns/${secondColumnId}`);
  }
  if (columnId) {
    await request('Delete first column', 'DELETE', `/api/columns/${columnId}`);
  }
  if (boardId) {
    await request('Delete board', 'DELETE', `/api/boards/${boardId}`);
  }

  await request('OIDC auth logout', 'POST', '/api/auth/logout', {
    expect: [302],
    redirect: 'manual'
  });
  await request('OIDC auth me after logout', 'GET', '/api/auth/me', { expect: [401] });

  info(`\nDone. Passed: ${passed}, Warnings: ${warned}, Failed: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  fail(`Unhandled test runner error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
