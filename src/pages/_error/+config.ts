import type { Config } from 'vike/types';

export default {
  // Make sure error page is rendered on client-side for proper error handling
  clientRouting: true,

  // Pass error context to client
  passToClient: ['is404', 'abortStatusCode', 'abortReason', 'errorWhileRendering']
} satisfies Config;
