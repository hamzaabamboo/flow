// Test setup file for Vitest
import { afterEach, vi } from 'vitest';

import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    clone: () => ({ ok: true }),
    headers: new Headers(),
    redirected: false,
    status: 200,
    statusText: 'OK',
    type: 'basic' as ResponseType,
    url: '',
    body: null,
    bodyUsed: false
  })
) as unknown as typeof fetch;

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
})) as unknown as typeof WebSocket;

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock Bun global for Vitest environment
if (typeof (global as any).Bun === 'undefined') {
  (global as any).Bun = {
    version: '1.0.0',
    revision: 'mock',
    env: process.env,
    gc: () => {},
    CryptoHasher: class {
      private data: string = '';
      constructor(private algo: string) {}
      update(data: string) {
        this.data += data;
        return this;
      }
      digest(encoding: string = 'hex') {
        return `mock-hash-${this.algo}-${encoding}-${this.data}`;
      }
    }
  };
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as unknown as typeof IntersectionObserver;
