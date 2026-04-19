import { prisma } from '../services/db.js';
import { io } from '../index.js';
import { checkBudgetAlert } from '../services/pushService.js';

/**
 * For each expense transaction, find the matching budget (same category + month + year)
 * and increment its `spent`. Falls back to an explicit budgetId when provided.
 *
 * @param {string} userId
 * @param {Array<{ category, amount, date, type, budgetId? }>} transactions
 */
async function autoUpdateBudgets(userId, transactions) {
  // Group expenses by category + month + year → total amount
  const groups = {};
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const d = new Date(tx.date);
    const month = d.getMonth() + 1;
    const year  = d.getFullYear();
    const key   = `${tx.category}|${month}|${year}`;
    groups[key] = (groups[key] || { amount: 0, month, year, category: tx.category });
    groups[key].amount += Number(tx.amount);
  }

  for (const { category, month, year, amount } of Object.values(groups)) {
    const budget = await prisma.budget.findFirst({
      where: { userId, category, month, year },
    });
    if (!budget) continue;
    await prisma.budget.update({
      where: { id: budget.id },
      data:  { spent: { increment: amount } },
    });
    await checkBudgetAlert(userId, budget.id);
  }
}

export const getTransactions = async (req, res) => {
  const { limit = 50, offset = 0, category, source, month, year } = req.query;

  const where = { userId: req.user.id };
  if (category) where.category = category;
  if (source)   where.source   = source;
  if (month && year) {
    const from = new Date(+year, +month - 1, 1);
    const to   = new Date(+year, +month, 1);
    where.date = { gte: from, lt: to };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    take: +limit,
    skip: +offset,
  });
  res.json(transactions);
};

export const getCCMonths = async (req, res) => {
  // Returns distinct year-month combos that have credit_card transactions,
  // newest first — used to populate the month dropdown.
  const rows = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR  FROM date)::int AS year,
      EXTRACT(MONTH FROM date)::int AS month,
      COUNT(*)::int                 AS count,
      SUM(amount)::float            AS total
    FROM "Transaction"
    WHERE "userId" = ${req.user.id}
      AND source = 'credit_card'
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `;
  res.json(rows);
};

export const createTransaction = async (req, res) => {
  const { description, amount, type, category, date, budgetId } = req.body;
  const tx = await prisma.transaction.create({
    data: { description, amount, type, category, date: new Date(date), budgetId, userId: req.user.id }
  });
  if (type === 'expense') {
    if (budgetId) {
      // Explicit budget selected in UI
      await prisma.budget.update({ where: { id: budgetId }, data: { spent: { increment: amount } } });
      await checkBudgetAlert(req.user.id, budgetId);
    } else {
      // Auto-match by category + month + year
      await autoUpdateBudgets(req.user.id, [{ type, category, amount, date: date || new Date() }]);
    }
  }
  io.to(req.user.id).emit('transaction:created', tx);
  res.status(201).json(tx);
};

export const deleteTransaction = async (req, res) => {
  await prisma.transaction.delete({ where: { id: req.params.id } });
  io.to(req.user.id).emit('transaction:deleted', req.params.id);
  res.json({ message: 'Deleted' });
};

export const batchCreateTransactions = async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'transactions must be a non-empty array' });
  }
  if (transactions.length > 200) {
    return res.status(400).json({ error: 'Maximum 200 transactions per batch' });
  }

  const data = transactions.map((t) => ({
    description: t.description,
    amount:      t.amount,
    type:        t.type,
    category:    t.category,
    date:        new Date(t.date),
    source:      t.source || 'credit_card',
    userId:      req.user.id,
  }));

  const result = await prisma.transaction.createMany({ data, skipDuplicates: false });

  // Auto-update matching budgets by category + month + year
  await autoUpdateBudgets(req.user.id, data);

  io.to(req.user.id).emit('transactions:batch_created', { count: result.count });
  res.status(201).json({ count: result.count });
};
