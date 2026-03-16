import { prisma } from '../services/db.js';
import { io } from '../index.js';

export const getBudgets = async (req, res) => {
  const { month, year } = req.query;
  const budgets = await prisma.budget.findMany({
    where: { userId: req.user.id, ...(month && { month: +month }), ...(year && { year: +year }) }
  });
  res.json(budgets);
};

export const createBudget = async (req, res) => {
  const budget = await prisma.budget.create({ data: { ...req.body, userId: req.user.id } });
  io.to(req.user.id).emit('budget:created', budget);
  res.status(201).json(budget);
};

export const updateBudget = async (req, res) => {
  const budget = await prisma.budget.update({ where: { id: req.params.id }, data: req.body });
  io.to(req.user.id).emit('budget:updated', budget);
  res.json(budget);
};

export const deleteBudget = async (req, res) => {
  await prisma.budget.delete({ where: { id: req.params.id } });
  io.to(req.user.id).emit('budget:deleted', req.params.id);
  res.json({ message: 'Deleted' });
};
