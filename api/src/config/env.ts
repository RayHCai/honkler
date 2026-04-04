import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().optional().default('dev-secret-not-for-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  UPLOAD_DIR: z.string().default('./uploads'),
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_PHONE_NUMBER: z.string(),
  AGENT_WORKER_URL: z.string().url(),
  AGENT_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  ELEVENLABS_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
