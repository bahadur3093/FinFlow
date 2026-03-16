import { prisma } from '../services/db.js';
import { io } from '../index.js';
import { checkBudgetAlert } from '../services/pushService.js';

export const getTransactions = async (req, res) => {
  const { limit = 50, offset = 0, category } = req.query;
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.user.id, ...(category && { category }) },
    orderBy: { date: 'desc' }, take: +limit, skip: +offset
  });
  res.json(transactions);
};

export const createTransaction = async (req, res) => {
  const { description, amount, type, category, date, budgetId } = req.body;
  const tx = await prisma.transaction.create({
    data: { description, amount, type, category, date: new Date(date), budgetId, userId: req.user.id }
  });
  if (budgetId && type === 'expense') {
    await prisma.budget.update({ where: { id: budgetId }, data: { spent: { increment: amount } } });
    await checkBudgetAlert(req.user.id, budgetId);
  }
  io.to(req.user.id).emit('transaction:created', tx);
  res.status(201).json(tx);
};

export const deleteTransaction = async (req, res) => {
  await prisma.transaction.delete({ where: { id: req.params.id } });
  io.to(req.user.id).emit('transaction:deleted', req.params.id);
  res.json({ message: 'Deleted' });
};
