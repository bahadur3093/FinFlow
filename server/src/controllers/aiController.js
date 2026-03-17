import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../services/db.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const cleanJSON = (text) => {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
};

export const parseStatement = async (req, res) => {
  try {
    const { file } = req;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Analyze this bank statement. Return ONLY a JSON array, no markdown, no code fences, no explanation:
[{"description":"...","amount":0.00,"type":"income|expense","category":"Food|Transport|Shopping|Entertainment|Health|Utilities|Salary|Other","date":"YYYY-MM-DD"}]`;
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: file.mimetype, data: file.buffer.toString('base64') } }
    ]);
    const transactions = JSON.parse(cleanJSON(result.response.text()));
    const saved = await prisma.transaction.createMany({
      data: transactions.map(t => ({ ...t, date: new Date(t.date), source: 'ai_parsed', userId: req.user.id }))
    });
    res.json({ message: `Imported ${saved.count} transactions`, transactions });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const getInsights = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id }, orderBy: { date: 'desc' }, take: 100
    });
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(
      `Transactions: ${JSON.stringify(transactions)}. Give 3 actionable insights as a JSON array only, no markdown, no code fences, no explanation:
[{"title":"...","insight":"...","tip":"..."}]`
    );
    res.json(JSON.parse(cleanJSON(result.response.text())));
  } catch (e) { res.status(500).json({ error: e.message }); }
};