# HamFlow Testing Guide

## Test Coverage

HamFlow includes comprehensive testing across all layers of the application:

### Unit Tests
- **API Routes** (`src/server/routes/__tests__/`)
  - Tasks API: CRUD operations, validation, WebSocket broadcasting
  - Inbox API: Item management, moving to boards, batch operations
  - Boards API: Board and column management
  - Command API: Natural language processing
  - Pomodoro API: Session tracking, statistics

- **React Components** (`src/components/__tests__/`)
  - CommandBar: Input handling, voice commands, API integration
  - TaskCard: Drag & drop, priority display, date formatting
  - Column: Task management, drag over states
  - Board: Column rendering, real-time updates

- **Hooks** (`src/hooks/__tests__/`)
  - useWebSocket: Connection management, message handling, reconnection
  - useAuth: Authentication state, token management

### Integration Tests
- **Authentication Flow** (`src/__tests__/integration/`)
  - User registration and validation
  - Login with credentials
  - Protected route access
  - Token management
  - Session persistence
  - Password security

### End-to-End Tests
- **API Endpoints** (`scripts/test-endpoints.ts`)
  - Full API surface testing
  - Authentication flow
  - CRUD operations
  - WebSocket connections
  - Webhook endpoints

## Running Tests

### Local Development

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with UI
bun run test:ui

# Generate coverage report
bun run test:coverage

# Run integration tests only
bun run test:integration

# Test API endpoints (requires running server)
bun run test:endpoints
```

### Test Structure

```
src/
├── __tests__/
│   └── integration/       # Integration tests
├── components/
│   └── __tests__/         # Component tests
├── server/
│   └── routes/
│       └── __tests__/     # API route tests
├── hooks/
│   └── __tests__/         # Hook tests
└── test/
    └── setup.ts           # Test configuration
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeTruthy();
  });
});
```

### API Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { Elysia } from 'elysia';
import { myRoute } from '../myRoute';

describe('My Route', () => {
  let app: Elysia;

  beforeEach(() => {
    app = new Elysia()
      .use(myRoute);
  });

  it('should handle GET request', async () => {
    const response = await app.handle(
      new Request('http://localhost/my-route')
    );
    expect(response.status).toBe(200);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Flow', () => {
  it('should complete full user journey', async () => {
    // 1. Register user
    const registerResponse = await fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    // 2. Login
    const loginResponse = await fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    // 3. Create resource
    const token = await loginResponse.json();
    const resourceResponse = await fetch('/api/resource', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(resourceData)
    });

    expect(resourceResponse.status).toBe(200);
  });
});
```

## Mocking

### Database Mocking

```typescript
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn()
};
```

### WebSocket Mocking

```typescript
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}));
```

### Fetch Mocking

```typescript
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'mocked' })
  })
);
```

## Coverage Goals

- **Unit Tests**: 80% coverage minimum
- **Integration Tests**: Critical user flows
- **API Tests**: All endpoints
- **Component Tests**: User interactions

## CI/CD Integration

Tests run automatically on:
- Push to main/develop branches
- Pull request creation
- Manual workflow dispatch

GitHub Actions workflow includes:
1. Linting and type checking
2. Unit tests with coverage
3. Integration tests
4. Build verification
5. End-to-end API tests

## Performance Testing

For load testing, use the included script:

```bash
# Install k6
brew install k6

# Run load test
k6 run scripts/load-test.js
```

## Debugging Tests

### VSCode Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "bun",
  "runtimeArgs": ["test", "--watch"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Common Issues

1. **WebSocket tests failing**: Ensure mock is properly configured
2. **Database tests failing**: Check mock returns match schema
3. **Component tests failing**: Verify test utils are imported
4. **Integration tests timeout**: Increase timeout in vitest.config.ts

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Names**: Describe what the test verifies
3. **AAA Pattern**: Arrange, Act, Assert
4. **Mock External Dependencies**: Database, APIs, WebSockets
5. **Test User Behavior**: Not implementation details
6. **Cleanup**: Clear mocks between tests
7. **Async Handling**: Use proper async/await
8. **Error Cases**: Test both success and failure paths

## Maintenance

- Review test coverage weekly
- Update tests when features change
- Remove obsolete tests
- Keep mocks synchronized with actual implementations
- Document complex test scenarios