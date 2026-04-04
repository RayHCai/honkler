import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../lib/logger.js';

const log = createLogger('HTTP');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  // Log incoming request
  const logBody = !originalUrl.includes('/auth') || !req.body?.password;
  const bodySnippet = logBody && req.body && Object.keys(req.body).length > 0
    ? req.body
    : undefined;

  log.info(`→ ${method} ${originalUrl}`, bodySnippet);

  // Log response when finished
  const originalSend = res.send.bind(res);
  res.send = function (body: any) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    log[level](`← ${method} ${originalUrl} ${status} (${duration}ms)`);
    return originalSend(body);
  };

  next();
}
