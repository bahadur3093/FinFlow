import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../services/db.js';
import { ollamaGenerate } from '../services/ollamaService.js';
import { agentAnswer } from '../services/textToSqlService.js';

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

// ── Gemini chat (context-injection, multi-turn) ───────────────────────────────

const INR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

async function buildFinancialContext(userId) {
  const now        = new Date();
  const year       = now.getFullYear();
  const month      = now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59);

  const [allTx, budgets, loans] = await Promise.all([
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 200 }),
    prisma.budget.findMany({ where: { userId, month, year } }),
    prisma.loan.findMany({ where: { userId } }),
  ]);

  const totalIncome  = allTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const thisMonthSpend = allTx
    .filter(t => { const d = new Date(t.date); return d >= monthStart && d <= monthEnd && t.type === 'expense'; })
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});

  const monthName = now.toLocaleString('en-IN', { month: 'long' });

  const budgetLines = budgets.length
    ? budgets.map(b => {
        const spent = thisMonthSpend[b.category] || 0;
        const pct   = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
        return `  • ${b.category}: ${INR(spent)} spent of ${INR(b.amount)} (${pct}%)`;
      }).join('\n')
    : Object.entries(thisMonthSpend).sort((a, b) => b[1] - a[1])
        .map(([c, a]) => `  • ${c}: ${INR(a)}`).join('\n') || '  None';

  const recentLines = allTx.slice(0, 30).map(t => {
    const d = new Date(t.date).toISOString().split('T')[0];
    return `  ${d}  ${t.type === 'income' ? '+' : '-'}${INR(t.amount)}  ${t.category}  ${t.description}`;
  }).join('\n') || '  No transactions.';

  const loanLines = loans.length
    ? loans.map(l => `  • ${l.name}: ${INR(l.outstanding)} outstanding, ${INR(l.emi)}/mo EMI`).join('\n')
    : '  No active loans.';

  return `
=== USER'S LIVE FINANCIAL DATA (${monthName} ${year}) ===
Net balance    : ${INR(totalIncome - totalExpense)}
Total income   : ${INR(totalIncome)}
Total expenses : ${INR(totalExpense)}

${monthName} spending${budgets.length ? ' vs budget' : ''}:
${budgetLines}

Recent transactions (last 30):
${recentLines}

Loans:
${loanLines}
=== END OF DATA — never invent figures not shown above ===`;
}

async function handleGeminiChat(messages, userId) {
  const context    = await buildFinancialContext(userId);
  const systemText = `You are FinBot, a friendly personal finance assistant built into FinFlow.
You have access to the user's real financial data below. Use it to give accurate, personalised answers.
Keep answers concise, practical, and encouraging. Use ₹ for money amounts. Plain language only.
${context}`;

  const model = genAI.getGenerativeModel({
    model:             'gemini-2.5-flash',
    systemInstruction: systemText,
  });

  // history = everything except the last user message
  const history = messages.slice(0, -1).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat   = model.startChat({ history });
  const result = await chat.sendMessage(messages.at(-1).content);
  return result.response.text();
}

// ── Shared chat handler — routes by x-ai-provider header ─────────────────────

export const ollamaChatHandler = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    if (!messages.every(m => m && typeof m.role === 'string' && typeof m.content === 'string')) {
      return res.status(400).json({ error: 'Each message must have role and content' });
    }

    const provider = (req.headers['x-ai-provider'] || 'ollama').toLowerCase();

    if (provider === 'gemini') {
      const reply = await handleGeminiChat(messages, req.user.id);
      return res.json({ reply });
    }

    // Default: Ollama Text-to-SQL agent
    const result = await agentAnswer(messages, req.user.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
