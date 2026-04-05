import { Router } from 'express';
import { prisma } from '../services/db.js';
import { io } from '../index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const parseAndCategorize = async (message) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Extract transaction details from this bank SMS and return ONLY a valid JSON object, no markdown, no explanation:

SMS: "${message}"

Return this exact structure:
{
  "amount": <number>,
  "recipient": "<merchant/person name>",
  "account": "<last 4 digits of account>",
  "ref": "<reference number>",
  "type": "<Credit or Debit>",
  "date": "<DD/MM/YYYY>",
  "category": "<one of: Food & Dining, Transport, Shopping, Entertainment, Utilities, Health, Travel, Education, Groceries, Rent, Salary, Freelance, Investment, Transfer, Other>"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  return JSON.parse(text.replace(/```json|```/g, '').trim());
};

router.post('/transaction', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const parsed = await parseAndCategorize(message);

    const [day, month, year] = parsed.date.split('/');
    // handle both YY and YYYY
    const fullYear = year.length === 2 ? `20${year}` : year;
    const parsedDate = new Date(`${fullYear}-${month}-${day}`);

    const tx = await prisma.transaction.create({
      data: {
        description: parsed.ref
          ? `${parsed.recipient} (Ref: ${parsed.ref})`
          : parsed.recipient,
        amount:   parsed.amount,
        type:     parsed.type === 'Credit' ? 'income' : 'expense',
        category: parsed.category,
        date:     parsedDate,
        source:   'shortcut',
        userId:   process.env.SHORTCUT_USER_ID,
      },
    });

    io.to(process.env.SHORTCUT_USER_ID).emit('transaction:created', tx);
    res.status(201).json({ success: true, transaction: tx });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse or save transaction' });
  }
});

export default router;