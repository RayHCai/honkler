import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { createLogger } from './logger.js';

const log = createLogger('AgentClient');

export async function callAgent(path: string, body: object): Promise<unknown> {
  const url = `${env.AGENT_WORKER_URL}${path}`;
  const start = Date.now();

  log.info(`→ POST ${path}`, body);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const duration = Date.now() - start;

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error');
      log.error(`← ${res.status} from ${path} (${duration}ms)`, text);
      throw new AppError(502, `Agent returned ${res.status}: ${text}`);
    }

    const data = await res.json();
    log.info(`← ${res.status} from ${path} (${duration}ms)`, data);
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const duration = Date.now() - start;
    log.error(`Failed to reach agent at ${path} (${duration}ms)`, (err as Error).message);
    throw new AppError(502, `Failed to reach agent at ${url}: ${(err as Error).message}`);
  }
}
