import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { signToken } from '../lib/jwt.js';
import { AppError, UnauthorizedError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('AuthController');

export async function register(req: Request, res: Response) {
  const { email, password, displayName } = req.body;
  log.info(`Registration attempt for email: ${email}`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    log.warn(`Registration rejected — email already registered: ${email}`);
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
    select: { id: true, email: true, displayName: true, createdAt: true },
  });

  const token = signToken({ userId: user.id, email: user.email });

  log.info(`User registered successfully: ${user.id} (${email})`);
  res.status(201).json({ success: true, data: { user, token } });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  log.info(`Login attempt for email: ${email}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    log.warn(`Login failed — user not found: ${email}`);
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    log.warn(`Login failed — invalid password for: ${email}`);
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signToken({ userId: user.id, email: user.email });

  log.info(`Login successful: ${user.id} (${email})`);
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        solanaAddress: user.solanaAddress,
      },
      token,
    },
  });
}

export async function getMe(req: Request, res: Response) {
  log.debug(`getMe for user ${req.user!.userId}`);
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      solanaAddress: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ success: true, data: user });
}
