import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../services/db.js';
import { ollamaGenerate, ollamaChat } from '../services/ollamaService.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const cleanJSON = (text) => {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
};

// ── Bank statement parser ─────────────────────────────────────────────────────

const PARSE_PROMPT = `Analyze this bank statement. Return ONLY a JSON array, no markdown, no code fences, no explanation:
[{"description":"...","amount":0.00,"type":"income|expense","category":"Food|Transport|Shopping|Entertainment|Health|Utilities|Salary|Other","date":"YYYY-MM-DD"}]`;

async function parseWithGemini(file) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent([
    PARSE_PROMPT,
    { inlineData: { mimeType: file.mimetype, data: file.buffer.toString('base64') } },
  ]);
  return result.response.text();
}

async function parseWithOllama(file) {
  return ollamaGenerate(PARSE_PROMPT, {
    imageBase64: file.buffer.toString('base64'),
    mimeType:    file.mimetype,
  });
}

export const parseStatement = async (req, res) => {
  try {
    const { file } = req;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const provider = (req.headers['x-ai-provider'] || 'gemini').toLowerCase();

    let rawText;
    if (provider === 'ollama') {
      rawText = await parseWithOllama(file);
    } else {
      rawText = await parseWithGemini(file);
    }

    const transactions = JSON.parse(cleanJSON(rawText));
    const saved = await prisma.transaction.createMany({
      data: transactions.map(t => ({
        ...t,
        date:   new Date(t.date),
        source: 'ai_parsed',
        userId: req.user.id,
      })),
    });
    res.json({ message: `Imported ${saved.count} transactions`, transactions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── AI insights ───────────────────────────────────────────────────────────────

const INSIGHTS_PROMPT = (transactions) =>
  `Transactions: ${JSON.stringify(transactions)}. Give 3 actionable insights as a JSON array only, no markdown, no code fences, no explanation:
[{"title":"...","insight":"...","tip":"..."}]`;

async function insightsWithGemini(transactions) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(INSIGHTS_PROMPT(transactions));
  return result.response.text();
}

async function insightsWithOllama(transactions) {
  return ollamaGenerate(INSIGHTS_PROMPT(transactions));
}

export const getInsights = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id }, orderBy: { date: 'desc' }, take: 100,
    });

    const provider = (req.headers['x-ai-provider'] || 'gemini').toLowerCase();

    let rawText;
    if (provider === 'ollama') {
      rawText = await insightsWithOllama(transactions);
    } else {
      rawText = await insightsWithGemini(transactions);
    }

    res.json(JSON.parse(cleanJSON(rawText)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── Ollama chat ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are FinBot, a friendly personal finance assistant built into FinFlow.
You help users understand their spending, savings, budgets, loans, and financial habits.
Keep answers concise, practical, and encouraging. Use plain language — no jargon.
If you don't know something specific to the user's data, say so and suggest they check their FinFlow dashboard.
Never make up numbers or financial figures.`;

export const ollamaChatHandler = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Validate each message has role + content
    const valid = messages.every(
      (m) => m && typeof m.role === 'string' && typeof m.content === 'string'
    );
    if (!valid) {
      return res.status(400).json({ error: 'Each message must have role and content' });
    }

    // Prepend system prompt
    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    const reply = await ollamaChat(fullMessages);
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
