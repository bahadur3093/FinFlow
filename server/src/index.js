import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import budgetRoutes from './routes/budgets.js';
import transactionRoutes from './routes/transactions.js';
import aiRoutes from './routes/ai.js';
import pushRoutes from './routes/push.js';
import { authenticateToken } from './middleware/auth.js';
import { setupSocketHandlers } from './services/socketService.js';
import loanRoutes from './routes/loans.js';
import shortcutsRouter from './routes/shortcuts.js';
import toolsRoutes from './routes/tools.js';

const app = express();
const httpServer = createServer(app);

const ALLOWED_ORIGINS = [
  'https://finflow-client-hbgk.onrender.com',
  process.env.CLIENT_URL,
].filter(Boolean);

export const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true }
});

// Trust Render's reverse proxy so express-rate-limit reads the real client IP
app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/budgets', authenticateToken, budgetRoutes);
app.use('/api/transactions', authenticateToken, transactionRoutes);
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/push', authenticateToken, pushRoutes);
app.use('/api/auth/profile', authenticateToken);
app.use('/api/auth', authRoutes);
app.use('/api/loans', authenticateToken, loanRoutes);
app.use('/api/shortcuts', shortcutsRouter);
app.use('/api/tools', authenticateToken, toolsRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Socket.io
setupSocketHandlers(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
