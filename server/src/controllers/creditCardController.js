import { GoogleGenerativeAI } from '@google/generative-ai';
import { ollamaGenerate } from '../services/ollamaService.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Prompt ──────────────────────────────────────────────────────────────────

const PROMPT = `You are a precise financial data extraction engine for Indian credit cards (HDFC, ICICI, Axis, SBI, Kotak, Yes Bank, AMEX India).

Extract ALL data from this credit card statement PDF. Return ONLY valid JSON — no markdown, no code fences, no explanation.

Rules:
- Parse every page of the document
- Amounts are always positive numbers; use the "type" field for debit/credit
- Dates must be in YYYY-MM-DD format; infer the year from statement_date context
- If a merchant name contains "EMI" or instalment metadata, set is_emi: true
- Reward point redemptions are credits — mark ai_category: "Rewards"
- Foreign transactions: extract original currency and amount if shown
- Reversed/refunded rows typically have "REV", "REVERSAL", or a negative sign — set is_reversal: true
- Charges (annual fee, late fee, interest) go in charges[], NOT transactions[]
- GST on charges is 18% — compute it if not shown explicitly
- If a field is not available, use null (never omit the key)
- Return amounts in INR only for the "amount" field; foreign amount goes in "foreign_amount"
- Do not invent data; only extract what is clearly shown in the PDF

Return ONLY this exact JSON structure:

{
  "summary": {
    "bank": "string",
    "card_last4": "string",
    "card_type": "string",
    "statement_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "total_due": 0.00,
    "minimum_due": 0.00,
    "credit_limit": 0.00,
    "available_credit": 0.00,
    "reward_points": 0,
    "opening_balance": 0.00,
    "payment_received": 0.00
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "string",
      "amount": 0.00,
      "type": "debit | credit",
      "raw_category": "string | null",
      "ai_category": "Food & Dining | Shopping | Transport | Entertainment | Health | Utilities | Education | Groceries | Savings | Rewards | Others",
      "reference_no": "string | null",
      "is_emi": false,
      "is_reversal": false,
      "currency": "INR",
      "foreign_amount": null,
      "foreign_currency": null,
      "note": "string | null"
    }
  ],
  "emis": [
    {
      "loan_ref": "string | null",
      "merchant": "string",
      "emi_number": 1,
      "total_emis": 12,
      "principal": 0.00,
      "interest": 0.00,
      "gst": 0.00,
      "total_emi_amount": 0.00,
      "original_purchase_date": "YYYY-MM-DD | null"
    }
  ],
  "charges": [
    {
      "type": "Annual Fee | Late Payment | Interest | Over Limit | Cash Advance | Other",
      "amount": 0.00,
      "gst": 0.00,
      "description": "string"
    }
  ]
}`;

// ─── Helper ──────────────────────────────────────────────────────────────────

function cleanJSON(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function validateParsed(data) {
  if (!data || typeof data !== 'object') throw new Error('Response is not an object');
  if (!data.summary) throw new Error('Missing summary block');
  if (!Array.isArray(data.transactions)) throw new Error('Missing transactions array');
  if (!Array.isArray(data.emis)) throw new Error('Missing emis array');
  if (!Array.isArray(data.charges)) throw new Error('Missing charges array');
  return data;
}

// ─── Model cascade (try in order until one succeeds) ─────────────────────────

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

async function callGeminiWithFallback(pdfBase64) {
  let lastErr;
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        PROMPT,
        { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
      ]);
      console.log(`[credit-card] parsed with ${modelName}`);
      return result.response.text();
    } catch (err) {
      const is503 = err.message?.includes('503') || err.message?.includes('Service Unavailable') || err.message?.includes('high demand');
      const is429 = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('rate');
      if (is503 || is429) {
        console.warn(`[credit-card] ${modelName} unavailable, trying next model…`);
        lastErr = err;
        continue;
      }
      throw err; // non-overload error — don't retry
    }
  }
  throw lastErr; // all models failed
}

// ─── Ollama fallback (text-only — Ollama cannot handle PDFs natively) ─────────

async function callOllamaForCreditStatement() {
  throw new Error(
    'PDF parsing is not supported by Ollama. Please switch to Gemini to parse credit card statements.'
  );
}

// ─── Controller ──────────────────────────────────────────────────────────────

export const parseCreditStatement = async (req, res) => {
  try {
    const { file } = req;
    if (!file) return res.status(400).json({ error: 'No PDF file uploaded' });
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Uploaded file must be a PDF' });
    }

    const provider = (req.headers['x-ai-provider'] || 'gemini').toLowerCase();

    if (provider === 'ollama') {
      await callOllamaForCreditStatement(); // throws with a friendly message
    }

    const pdfBase64 = file.buffer.toString('base64');
    const rawText = await callGeminiWithFallback(pdfBase64);
    const parsed = validateParsed(JSON.parse(cleanJSON(rawText)));

    res.json(parsed);
  } catch (err) {
    console.error('[credit-card] parse error:', err.message);

    const is503 = err.message?.includes('503') || err.message?.includes('Service Unavailable') || err.message?.includes('high demand');
    if (is503) {
      return res.status(503).json({ error: 'Gemini is currently overloaded. Please try again in a minute.' });
    }
    if (err instanceof SyntaxError) {
      return res.status(502).json({ error: 'AI returned unparseable response. Please try again.' });
    }
    if (err.message?.includes('Missing')) {
      return res.status(502).json({ error: `AI response incomplete: ${err.message}` });
    }
    res.status(500).json({ error: err.message || 'Failed to parse statement' });
  }
};
