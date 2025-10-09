import { pino } from 'pino';
import { httpPrintFactory } from 'pino-http-print';

const printer = httpPrintFactory(
  {
    destination: 1, // optional (default stdout)
    all: true,
    colorize: true,
    translateTime: 'yyyy-mm-dd HH:MM:ss'
  },
  {
    colorize: true,
    ignore: 'pid,hostname'
  }
);

export const logger = pino(printer());
