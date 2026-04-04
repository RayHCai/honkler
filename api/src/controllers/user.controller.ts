import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('UserController');

export async function getProfile(req: Request, res: Response) {
  log.debug(`Fetching profile for user ${req.user!.userId}`);
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

export async function updateProfile(req: Request, res: Response) {
  const { displayName, solanaAddress } = req.body;
  log.info(`Updating profile for user ${req.user!.userId}`, { displayName, hasSolana: !!solanaAddress });

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(solanaAddress !== undefined && { solanaAddress }),
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      solanaAddress: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  log.info(`Profile updated for user ${user.id}`);
  res.json({ success: true, data: user });
}
