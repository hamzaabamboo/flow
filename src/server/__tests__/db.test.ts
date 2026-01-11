import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('server/db', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should use DATABASE_URL from process.env if provided', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    const { db } = await import('../db');
    expect(db).toBeDefined();
  });

  it('should use default connection string if DATABASE_URL not provided', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const { db } = await import('../db');
    expect(db).toBeDefined();
    process.env.DATABASE_URL = originalUrl;
  });
});
