import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { initSessionState } from './middleware/sessionState.js';
import apiRouter from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});
app.use('/api/', apiLimiter);

// Session Store
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'authswitch-demo-secret-key-super-secure',
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Initialize Auth State Machine in Session
app.use(initSessionState);

// API Endpoints
app.use('/api', apiRouter);

// Static Assets
app.use(express.static(path.join(rootDir, 'public')));

// SPA Wildcard Route Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

// Only listen if executed directly, not imported in tests
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 AuthSwitch Demo Server running on http://localhost:${PORT}`);
    console.log(`==================================================\n`);
  });
}

export default app;
