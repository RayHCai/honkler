import twilio from 'twilio';
import { env } from '../config/env.js';

export const twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export function validateTwilioWebhook(
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params);
}
