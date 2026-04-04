import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Auth');

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    log.warn(`Missing auth header on ${req.method} ${req.originalUrl}`);
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    log.debug(`Authenticated user ${payload.userId} for ${req.method} ${req.originalUrl}`);
    next();
  } catch {
    log.warn(`Invalid/expired token on ${req.method} ${req.originalUrl}`);
    throw new UnauthorizedError('Invalid or expired token');
  }
}
