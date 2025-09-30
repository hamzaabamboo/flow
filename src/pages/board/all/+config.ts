import type { Config } from 'vike/types';

export default {
  // Use client-side routing for all tasks page
  clientRouting: true,
  // Pass user data to client for authentication
  passToClient: ['user', 'space']
  // Define the parameterized route
} satisfies Config;
