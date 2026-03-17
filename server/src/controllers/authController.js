import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db.js';

const signAccess  = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
const signRefresh = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(400).json({ error: 'Email already in use' });
    const user = await prisma.user.create({
      data: { email, password: await bcrypt.hash(password, 12), name }
    });
    res.status(201).json({
      accessToken: signAccess(user.id),
      refreshToken: signRefresh(user.id),
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    res.json({
      accessToken: signAccess(user.id),
      refreshToken: signRefresh(user.id),
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });
  try {
    const { id } = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    res.json({ accessToken: signAccess(id) });
  } catch { res.status(403).json({ error: 'Invalid refresh token' }); }
};

export const logout = (_, res) => res.json({ message: 'Logged out' });

export const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name }
    });
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
