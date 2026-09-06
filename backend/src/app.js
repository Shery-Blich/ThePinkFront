import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth.js';
import questionsRouter from './routes/questions.js';
import gameRouter from './routes/game.js';
import analyticsRouter from './routes/analytics.js';

const app = express();

app.set('trust proxy', 1);

/**
 * Build the allowed CORS origin list from CLIENT_ORIGIN.
 * Supports a single origin or a comma-separated list.
 * For localhost / 127.0.0.1, both hostnames are accepted on the same port
 * so local Node (localhost / 127.0.0.1) works either way.
 * @returns {string[]|boolean}
 */
function resolveCorsOrigins() {
  const raw = process.env.CLIENT_ORIGIN?.trim();
  if (!raw || raw === '*') return true;

  const origins = new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

  for (const origin of [...origins]) {
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost') {
        origins.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ''}`);
      } else if (url.hostname === '127.0.0.1') {
        origins.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ''}`);
      }
    } catch {
      // Keep the raw value if it is not a valid URL.
    }
  }

  return [...origins];
}

const corsOrigins = resolveCorsOrigins();

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
const gameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/game', gameLimiter, gameRouter);
app.use('/api/analytics', analyticsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
