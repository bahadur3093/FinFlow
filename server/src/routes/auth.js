import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  updateProfile,
  generateMcpToken,
  revokeMcpToken,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.put('/profile', updateProfile);
router.post('/mcp-token', authenticateToken, generateMcpToken);
router.delete('/mcp-token', authenticateToken, revokeMcpToken);
export default router;
