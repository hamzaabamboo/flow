import { pino } from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-http-print',
    options: {
      destination: 1, // optional (default stdout)
      all: true,
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      prettyOptions: {
        colorize: true,
        ignore: 'pid,hostname'
      }
    }
  }
});