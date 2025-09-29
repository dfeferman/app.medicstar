import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, json } = winston.format;

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = winston.createLogger({
  level: isDevelopment ? 'verbose' : 'error',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple(),
      ),
    }),
    new DailyRotateFile({
      filename: './logs/medicstar-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: isDevelopment ? 'info' : 'error',
    }),
  ],
});

export const orderLogger = winston.createLogger({
  level: isDevelopment ? 'verbose' : 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple(),
      ),
    }),
    new DailyRotateFile({
      filename: './logs/orders-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: 'info',
    }),
  ],
});

export const trackNumbersLogger = winston.createLogger({
  level: isDevelopment ? 'verbose' : 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple(),
      ),
    }),
    new DailyRotateFile({
      filename: './logs/track-numbers-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: 'info',
    }),
  ],
});

export const syncProductsLogger = winston.createLogger({
  level: isDevelopment ? 'verbose' : 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple(),
      ),
    }),
    new DailyRotateFile({
      filename: './logs/sync-products-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: 'info',
    }),
  ],
});

export default logger;
