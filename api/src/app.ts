import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { join } from 'path';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { env } from './config/env.js';

const app = express();

// Twilio webhooks need urlencoded body for signature verification
app.use('/api/webhooks/twilio', express.urlencoded({ extended: false }));

// Standard middleware
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Request logging (after body parsers so req.body is available)
app.use(requestLogger);

// Serve uploaded files
app.use('/uploads', express.static(join(process.cwd(), env.UPLOAD_DIR)));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
