import { Router } from 'express';
import { prisma } from '../services/db.js';
import { io } from '../index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const categorizeTransaction = async (recipient, type) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Categorize this ${type === 'Debit' ? 'expense' : 'income'} transaction for a personal finance app.
Recipient: "${recipient}"
Reply with ONLY one category from this list, nothing else:
Food & Dining, Transport, Shopping, Entertainment, Utilities, Health, Travel, Education, Groceries, Rent, Salary, Freelance, Investment, Transfer, Other`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return 'Other';
  }
};

router.post('/transaction', async (req, res) => {
  try {
    const { amount, recipient, account, ref, type, date } = req.body;

    const [day, month, year] = date.split('/');
    const parsedDate = new Date(`${year}-${month}-${day}`);

    // AI categorization
    const category = await categorizeTransaction(recipient, type);

    const tx = await prisma.transaction.create({
      data: {
        description: ref ? `${recipient} (Ref: ${ref})` : recipient,
        amount:      parseFloat(amount),
        type:        type === 'Credit' ? 'income' : 'expense',
        category,
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