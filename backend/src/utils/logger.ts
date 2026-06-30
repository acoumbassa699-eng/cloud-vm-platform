import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

const pinoLogger = pino(
  {
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  }
);

export const logger = pinoLogger;
