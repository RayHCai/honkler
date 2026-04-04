import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { env } from '../config/env.js';

const log = createLogger('ErrorHandler');

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    log.warn(`${req.method} ${req.originalUrl} → ${err.statusCode}: ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  log.error(`Unhandled error on ${req.method} ${req.originalUrl}`, {
    message: err.message,
    stack: err.stack,
  });
  res.status(500).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
