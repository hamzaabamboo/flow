import { vi, Mock, MockedFunction } from 'vitest';

// Helper to create a mocked route handler
// Eden Treaty routes can be called as functions (for path params)
// and have methods like get, post, patch, delete
const createMockRoute = () => {
  const route = vi.fn((..._args: any[]) => ({
    get: vi.fn().mockResolvedValue({ data: null, error: null }),
    post: vi.fn().mockResolvedValue({ data: null, error: null }),
    patch: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockResolvedValue({ data: null, error: null })
  }));

  return Object.assign(route, {
    get: vi.fn().mockResolvedValue({ data: null, error: null }),
    post: vi.fn().mockResolvedValue({ data: null, error: null }),
    patch: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockResolvedValue({ data: null, error: null })
  });
};

export const mockApi = {
  api: {
    auth: {
      me: { get: vi.fn() },
      logout: { post: vi.fn() },
      login: { get: vi.fn() },
      callback: { get: vi.fn() },
      refresh: { post: vi.fn() }
    },
    boards: createMockRoute(),
    columns: createMockRoute(),
    tasks: createMockRoute(),
    subtasks: createMockRoute(),
    inbox: createMockRoute(),
    pomodoro: createMockRoute(),
    habits: createMockRoute(),
    command: createMockRoute(),
    search: createMockRoute(),
    settings: createMockRoute(),
    calendar: createMockRoute(),
    reminders: createMockRoute(),
    stats: createMockRoute(),
    'api-tokens': createMockRoute(),
    'external-calendars': createMockRoute(),
    notes: createMockRoute()
  }
};

// Typed helpers for accessing mocks in tests
export function getMockRoute<T = any>(mock: T) {
  return mock as Mock & {
    get: Mock;
    post: Mock;
    patch: Mock;
    delete: Mock;
    [key: string]: any;
  };
}

export function getMockFn<T extends (...args: any[]) => any>(mock: T): MockedFunction<T> {
  return mock as unknown as MockedFunction<T>;
}

// Also mock some common sub-routes
Object.assign(mockApi.api.tasks, {
  reorder: { post: vi.fn() },
  'auto-organize': { post: vi.fn() }
});

Object.assign(mockApi.api.subtasks, {
  task: vi.fn(() => createMockRoute())
});

Object.assign(mockApi.api.columns, {
  reorder: { post: vi.fn() }
});

Object.assign(mockApi.api.boards, {
  summary: { get: vi.fn() }
});

Object.assign(mockApi.api.habits, {
  stats: { get: vi.fn() },
  log: { post: vi.fn() }
});

Object.assign(mockApi.api.pomodoro, {
  active: { get: vi.fn(), post: vi.fn() }
});

Object.assign(mockApi.api.calendar, {
  events: { get: vi.fn() },
  'feed-url': { get: vi.fn() }
});

Object.assign(mockApi.api.notes, {
  enabled: { get: vi.fn() },
  create: { post: vi.fn() },
  search: { post: vi.fn() },
  link: { post: vi.fn() },
  unlink: createMockRoute(),
  collections: { get: vi.fn() }
});

Object.assign(mockApi.api.command, {
  execute: { post: vi.fn() }
});

Object.assign(mockApi.api.inbox, {
  convert: { post: vi.fn() },
  delete: { post: vi.fn() }
});

Object.assign(mockApi.api.stats, {
  analytics: { completions: { get: vi.fn() } }
});

Object.assign(mockApi.api.settings, {
  'test-summary': { post: vi.fn() }
});
