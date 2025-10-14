/**
 * HTTP Error Helper Functions
 */

export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HTTPError';
  }
}

export const notFound = (message = 'Resource not found') => new HTTPError(404, message);
export const unauthorized = (message = 'Unauthorized') => new HTTPError(401, message);
export const forbidden = (message = 'Forbidden') => new HTTPError(403, message);
export const badRequest = (message = 'Bad request') => new HTTPError(400, message);
export const conflict = (message = 'Conflict') => new HTTPError(409, message);
export const internalError = (message = 'Internal server error') => new HTTPError(500, message);

/**
 * Error Response Handler
 * Usage in routes:
 *
 * if (!resource) {
 *   set.status = 404;
 *   return errorResponse('Resource not found');
 * }
 */
export const errorResponse = (message: string, details?: unknown) => ({
  error: message,
  ...(details && { details })
});

/**
 * Success Response Helper
 */
export const successResponse = <T>(data: T, message?: string) => ({
  success: true,
  ...(message && { message }),
  data
});
