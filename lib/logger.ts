import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const { combine, timestamp, json } = winston.format;

const isDevelopment = process.env.NODE_ENV === 'development';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const logsDir = path.join(projectRoot, 'logs');

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
      filename: path.join(logsDir, 'medicstar-%DATE%.log'),
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
      filename: path.join(logsDir, 'orders-%DATE%.log'),
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
      filename: path.join(logsDir, 'track-numbers-%DATE%.log'),
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
      filename: path.join(logsDir, 'sync-products-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: 'info',
    }),
  ],
});

export default logger;
