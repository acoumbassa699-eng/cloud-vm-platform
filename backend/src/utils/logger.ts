import pino from 'pino';

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    singleLine: true,
    translateTime: 'SYS:standard'
  }
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info'
  },
  transport
);
