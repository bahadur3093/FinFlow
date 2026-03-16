import webpush from 'web-push';
import { prisma } from './db.js';
export const checkBudgetAlert = async (userId, budgetId) => {
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) return;
  const pct = (budget.spent / budget.amount) * 100;
  if (pct < 80) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify({
    title: pct >= 100 ? 'Budget exceeded!' : 'Budget alert',
    body: `${budget.name}: ${Math.round(pct)}% used`
  });
  subs.forEach(sub =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    ).catch(console.error));
};
