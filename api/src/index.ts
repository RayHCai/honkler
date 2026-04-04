import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { createLogger } from './lib/logger.js';

const log = createLogger('Server');

async function main() {
  log.info('Starting Honkler API...');
  log.info(`Environment: ${env.NODE_ENV}`);
  log.info(`Agent worker URL: ${env.AGENT_WORKER_URL}`);
  log.info(`Frontend URL: ${env.FRONTEND_URL}`);

  await prisma.$connect();
  log.info('Database connected');

  app.listen(env.PORT, () => {
    log.info(`Honkler API running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  log.error('Failed to start server', err);
  process.exit(1);
});
