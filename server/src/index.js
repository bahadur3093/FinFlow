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

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true }
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/budgets', authenticateToken, budgetRoutes);
app.use('/api/transactions', authenticateToken, transactionRoutes);
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/push', authenticateToken, pushRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Socket.io
setupSocketHandlers(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
