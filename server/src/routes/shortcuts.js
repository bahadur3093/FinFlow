import { Router } from 'express';
import { prisma } from '../services/db.js';
import { io } from '../index.js';

const router = Router();

router.post('/transaction', async (req, res) => {
  try {
    const { amount, recipient, account, ref, type, date } = req.body;

    // Parse DD/MM/YYYY → JS Date
    const [day, month, year] = date.split('/');
    const parsedDate = new Date(`${year}-${month}-${day}`);

    const tx = await prisma.transaction.create({
      data: {
        description: ref ? `${recipient} (Ref: ${ref})` : recipient,
        amount:      parseFloat(amount),
        type:        type === 'Credit' ? 'income' : 'expense',
        category:    account ?? 'Uncategorized',
        date:        parsedDate,
        source:      'shortcut',
        userId:      process.env.SHORTCUT_USER_ID,
      },
    });

    io.to(process.env.SHORTCUT_USER_ID).emit('transaction:created', tx);
    res.status(201).json({ success: true, transaction: tx });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

export default router;