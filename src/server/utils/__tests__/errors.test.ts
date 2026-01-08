import { describe, it, expect } from 'vitest';
import { 
  HTTPError, 
  notFound, 
  unauthorized, 
  forbidden, 
  badRequest, 
  conflict, 
  internalError,
  errorResponse,
  successResponse
} from '../errors';

describe('error utils', () => {
  it('should create HTTPError correctly', () => {
    const err = new HTTPError(418, 'I am a teapot');
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe('I am a teapot');
  });

  it('helper functions should return correct status codes', () => {
    expect(notFound().statusCode).toBe(404);
    expect(unauthorized().statusCode).toBe(401);
    expect(forbidden().statusCode).toBe(403);
    expect(badRequest().statusCode).toBe(400);
    expect(conflict().statusCode).toBe(409);
    expect(internalError().statusCode).toBe(500);
  });

  it('errorResponse should return correct object', () => {
    expect(errorResponse('error message')).toEqual({ error: 'error message' });
    expect(errorResponse('error', { id: 1 })).toEqual({ error: 'error', details: { id: 1 } });
  });

  it('successResponse should return correct object', () => {
    expect(successResponse({ id: 1 })).toEqual({ success: true, data: { id: 1 } });
    expect(successResponse({ id: 1 }, 'Saved')).toEqual({ success: true, message: 'Saved', data: { id: 1 } });
  });
});
