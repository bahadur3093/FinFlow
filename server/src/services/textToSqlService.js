import { prisma } from './db.js';
import { ollamaGenerate, ollamaChat } from './ollamaService.js';

// ── Schema description sent to the model ────────────────────────────────────
// Uses exact PostgreSQL identifiers Prisma generates (PascalCase, double-quoted).

const SCHEMA = `
PostgreSQL schema (double-quote ALL identifiers exactly as shown):

Table "Transaction"
  "id"          TEXT PK
  "description" TEXT
  "amount"      FLOAT  -- always positive; use "type" to distinguish
  "type"        TEXT   -- 'income' or 'expense'
  "category"    TEXT   -- 'Food','Transport','Shopping','Entertainment','Health','Utilities','Salary','Other'
  "date"        TIMESTAMPTZ
  "source"      TEXT   -- 'manual','ai_parsed','credit_card'
  "createdAt"   TIMESTAMPTZ
  "userId"      TEXT   FK → "User"
  "budgetId"    TEXT?  FK → "Budget"

Table "Budget"
  "id"        TEXT PK
  "name"      TEXT
  "amount"    FLOAT  -- budget limit
  "spent"     FLOAT  -- cached; prefer summing Transaction for accuracy
  "category"  TEXT
  "month"     INT    -- 1-12
  "year"      INT
  "userId"    TEXT   FK → "User"

Table "Loan"
  "id"           TEXT PK
  "name"         TEXT
  "type"         TEXT   -- 'home','car','personal','education','other'
  "principal"    FLOAT
  "outstanding"  FLOAT
  "emi"          FLOAT  -- monthly EMI
  "interestRate" FLOAT  -- annual %
  "tenureMonths" INT
  "startDate"    TIMESTAMPTZ
  "userId"       TEXT   FK → "User"
`;

// ── Safety guards ─────────────────────────────────────────────────────────────

const ALLOWED_TABLES  = /("Transaction"|"Budget"|"Loan")/i;
const BLOCKED_TABLES  = /("User"|"PushSubscription"|"RefreshToken"|"McpToken")/i;
const ONLY_SELECT     = /^\s*SELECT\b/i;
const BAD_KEYWORDS    = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|UNION\s+ALL|UNION\s+SELECT)\b/i;

function stripFences(text) {
  return text
    .trim()
    .replace(/^```sql\s*/i, '')
    .replace(/^```\s*/i,    '')
    .replace(/```\s*$/i,    '')
    .trim()
    .replace(/;\s*$/, '');           // trailing semicolons are fine in PG but strip for cleanliness
}

function validateSQL(sql, userId) {
  if (!ONLY_SELECT.test(sql))      throw new Error('Only SELECT queries are permitted.');
  if (BAD_KEYWORDS.test(sql))      throw new Error('Query contains disallowed SQL keywords.');
  if (BLOCKED_TABLES.test(sql))    throw new Error('Query accesses a restricted table.');
  if (!ALLOWED_TABLES.test(sql))   throw new Error('Query must reference Transaction, Budget, or Loan.');
  if (!sql.includes(userId))       throw new Error('Query must be scoped to the authenticated user ID.');
}

// ── Helper: serialise BigInt (COUNT returns bigint in Prisma raw) ─────────────

const safeJSON = (v) => JSON.parse(JSON.stringify(v, (_, val) =>
  typeof val === 'bigint' ? Number(val) : val
));

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Agentic Text-to-SQL loop.
 *
 * Sends the user's question + DB schema to Ollama.
 * Ollama either:
 *   A) Returns  QUERY: <sql>   → we execute it and ask Ollama to explain the result
 *   B) Returns  ANSWER: <text> → we use it directly (general finance questions)
 *
 * @param {Array<{role,content}>} conversationHistory  Full chat history so far
 * @param {string}                userId               Authenticated user's ID
 * @returns {Promise<{reply: string, sql?: string, rows?: any[]}>}
 */
export async function agentAnswer(conversationHistory, userId) {
  const today     = new Date().toISOString().split('T')[0];
  const lastMsg   = conversationHistory.at(-1)?.content ?? '';

  // ── Step 1: Ask Ollama whether a DB query is needed ──────────────────────

  const routerPrompt = `You are FinBot, a personal finance assistant with access to the user's Supabase PostgreSQL database.

${SCHEMA}

Today is ${today}.
The authenticated user's ID is: '${userId}'

Instructions:
- If the user's question requires fetching their personal financial data (transactions, budgets, loans, balances, spending by category, etc.), respond with ONLY:
  QUERY: <a single valid PostgreSQL SELECT statement>
  Rules for the query:
    • Always filter "userId" = '${userId}'
    • Double-quote ALL table and column names exactly as shown in the schema
    • Use only Transaction, Budget, Loan tables — never User, RefreshToken, McpToken
    • No INSERT / UPDATE / DELETE / DROP / UNION
    • Return only the columns needed to answer the question
    • Use DATE_TRUNC, EXTRACT, NOW() for date math

- If the question is general financial knowledge (definitions, tips, rules of thumb) and needs no personal data, respond with ONLY:
  ANSWER: <your concise, friendly reply>

Conversation so far:
${conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

Respond with either QUERY: or ANSWER: — nothing else.`;

  const step1Raw  = await ollamaGenerate(routerPrompt);
  const step1Text = step1Raw.trim();

  // ── Branch A: direct answer ───────────────────────────────────────────────

  if (/^ANSWER:/i.test(step1Text)) {
    return { reply: step1Text.replace(/^ANSWER:\s*/i, '').trim() };
  }

  // ── Branch B: SQL query ───────────────────────────────────────────────────

  const sqlMatch = step1Text.match(/^QUERY:\s*([\s\S]+)/i);
  if (!sqlMatch) {
    // Model didn't follow the format — treat entire response as direct answer
    return { reply: step1Text };
  }

  const sql = stripFences(sqlMatch[1].trim());

  try {
    validateSQL(sql, userId);
  } catch (validationErr) {
    // Surface validation error as a friendly message instead of crashing
    return {
      reply: `I tried to look up your data but generated an unsafe query (${validationErr.message}). Please rephrase your question.`,
      sql,
    };
  }

  // ── Step 2: Execute the validated SQL ────────────────────────────────────

  let rows;
  try {
    rows = safeJSON(await prisma.$queryRawUnsafe(sql));
  } catch (dbErr) {
    return {
      reply: `I generated a query but it failed to run: ${dbErr.message}. Try rephrasing.`,
      sql,
    };
  }

  // ── Step 3: Natural language summary of the result ───────────────────────

  const summaryMessages = [
    {
      role: 'system',
      content: `You are FinBot, a friendly personal finance assistant.
You ran a database query to answer the user's question. Summarise the result in 1–4 short sentences.
- Use INR symbol ₹ for money amounts
- Do NOT mention SQL, databases, tables, or technical details
- Be warm and actionable where appropriate
- Today is ${today}`,
    },
    {
      role: 'user',
      content: `My question: ${lastMsg}

Query result:
${JSON.stringify(rows, null, 2)}

Please answer my question based on this data.`,
    },
  ];

  const reply = await ollamaChat(summaryMessages);
  return { reply, sql, rows };
}
