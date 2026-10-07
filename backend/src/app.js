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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true, // required for httpOnly cookie to be sent cross-origin
  })
);
app.use(express.json({ limit: '10kb' })); // prevent large payload attacks
app.use(cookieParser());

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 20 : 1000, standardHeaders: true, legacyHeaders: false });
// Sized for ~200 players at once behind one IP (venue/school Wi-Fi, carrier NAT): a game sends
// ~5 requests a minute, so ~1000/min, plus headroom for players who lose stages repeatedly
const gameLimiter = rateLimit({ windowMs: 60 * 1000, max: 1500, standardHeaders: true, legacyHeaders: false });

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/game', gameLimiter, gameRouter);
app.use('/api/analytics', analyticsRouter);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
