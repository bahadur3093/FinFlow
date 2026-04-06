#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pg from 'pg';

const { Pool } = pg;

const connectionString = "postgresql://finflow_db_ggfz_user:4KUb9md97Vcufc1eRTP4VIRL77FaP4r4@dpg-d6sgr3juibrs73eb9hig-a.singapore-postgres.render.com/finflow_db_ggfz?ssl=true";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err.message);
});

const CURRENT_USER_ID = "cmnlkvkp30000hqm96cwu47rc";

const server = new Server({
  name: "finflow-backend-agent",
  version: "2.0.0",
}, {
  capabilities: { tools: {} },
});

// ─────────────────────────────────────────────
// TOOLS LIST
// ─────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [

    // ── BALANCE ──
    {
      name: "get_balance",
      description: "Get the current total balance (Income - Expenses)",
      inputSchema: { type: "object", properties: {} }
    },

    // ── TRANSACTIONS ──
    {
      name: "get_transactions",
      description: "Get transactions with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense"] },
          category: { type: "string" },
          from_date: { type: "string", description: "ISO date string" },
          to_date: { type: "string", description: "ISO date string" },
          limit: { type: "number", description: "Default 50" }
        }
      }
    },
    {
      name: "add_income",
      description: "Log a new income entry",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number" },
          description: { type: "string" },
          category: { type: "string" },
          budget_id: { type: "string", description: "Optional budget to link" }
        },
        required: ["amount", "description", "category"]
      }
    },
    {
      name: "add_expense",
      description: "Log a new expense entry",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number" },
          description: { type: "string" },
          category: { type: "string" },
          budget_id: { type: "string", description: "Optional budget to link and auto-update spent" }
        },
        required: ["amount", "description", "category"]
      }
    },
    {
      name: "update_transaction",
      description: "Update an existing transaction",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          amount: { type: "number" },
          description: { type: "string" },
          category: { type: "string" },
          type: { type: "string", enum: ["income", "expense"] }
        },
        required: ["id"]
      }
    },
    {
      name: "delete_transaction",
      description: "Delete a transaction by ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"]
      }
    },
    {
      name: "get_spending_summary",
      description: "Get spending grouped by category for a given month/year",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "number" },
          year: { type: "number" }
        }
      }
    },
    {
      name: "get_monthly_trend",
      description: "Get income vs expense totals month by month",
      inputSchema: {
        type: "object",
        properties: {
          months: { type: "number", description: "Past N months, default 6" }
        }
      }
    },

    // ── BUDGETS ──
    {
      name: "get_budgets",
      description: "Get all budgets, optionally filtered by month/year",
      inputSchema: {
        type: "object",
        properties: {
          month: { type: "number" },
          year: { type: "number" }
        }
      }
    },
    {
      name: "create_budget",
      description: "Create a new budget for a category and month",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          category: { type: "string" },
          month: { type: "number" },
          year: { type: "number" }
        },
        required: ["name", "amount", "category", "month", "year"]
      }
    },
    {
      name: "update_budget",
      description: "Update an existing budget's name, amount, or category",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          amount: { type: "number" },
          category: { type: "string" }
        },
        required: ["id"]
      }
    },
    {
      name: "delete_budget",
      description: "Delete a budget by ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"]
      }
    },

    // ── LOANS ──
    {
      name: "get_loans",
      description: "Get all loans for the current user",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "add_loan",
      description: "Add a new loan",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["home", "car", "personal", "education", "other"] },
          principal: { type: "number" },
          outstanding: { type: "number" },
          emi: { type: "number" },
          interest_rate: { type: "number" },
          tenure_months: { type: "number" },
          start_date: { type: "string", description: "ISO date string" }
        },
        required: ["name", "type", "principal", "outstanding", "emi", "interest_rate", "tenure_months", "start_date"]
      }
    },
    {
      name: "update_loan",
      description: "Update an existing loan (e.g. after EMI payment, update outstanding)",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          outstanding: { type: "number" },
          emi: { type: "number" },
          interest_rate: { type: "number" }
        },
        required: ["id"]
      }
    },
    {
      name: "delete_loan",
      description: "Delete a loan by ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"]
      }
    }

  ]
}));

// ─────────────────────────────────────────────
// TOOL HANDLERS
// ─────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {

    // ── BALANCE ──
    if (name === "get_balance") {
      const result = await pool.query(
        `SELECT
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
         FROM "Transaction" WHERE "userId" = $1`,
        [CURRENT_USER_ID]
      );
      const { income = 0, expenses = 0 } = result.rows[0];
      const balance = (Number(income) - Number(expenses)).toFixed(2);
      return { content: [{ type: "text", text: `Balance: ₹${balance} (Income: ₹${Number(income).toFixed(2)}, Expenses: ₹${Number(expenses).toFixed(2)})` }] };
    }

    // ── GET TRANSACTIONS ──
    if (name === "get_transactions") {
      const { type, category, from_date, to_date, limit = 50 } = args;
      let query = `SELECT * FROM "Transaction" WHERE "userId" = $1`;
      const params = [CURRENT_USER_ID];
      let i = 2;
      if (type)      { query += ` AND type = $${i++}`;           params.push(type); }
      if (category)  { query += ` AND category = $${i++}`;       params.push(category); }
      if (from_date) { query += ` AND date >= $${i++}`;          params.push(from_date); }
      if (to_date)   { query += ` AND date <= $${i++}`;          params.push(to_date); }
      query += ` ORDER BY date DESC LIMIT $${i}`;                params.push(limit);
      const result = await pool.query(query, params);
      return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
    }

    // ── ADD INCOME ──
    if (name === "add_income") {
      const { amount, description, category, budget_id } = args;
      await pool.query(
        `INSERT INTO "Transaction" (id, description, amount, type, category, date, source, "userId", "budgetId")
         VALUES (gen_random_uuid(), $1, $2, 'income', $3, NOW(), 'ai_parsed', $4, $5)`,
        [description, amount, category, CURRENT_USER_ID, budget_id || null]
      );
      return { content: [{ type: "text", text: `✅ Income of ₹${amount} logged: "${description}" under ${category}.` }] };
    }

    // ── ADD EXPENSE ──
    if (name === "add_expense") {
      const { amount, description, category, budget_id } = args;
      await pool.query(
        `INSERT INTO "Transaction" (id, description, amount, type, category, date, source, "userId", "budgetId")
         VALUES (gen_random_uuid(), $1, $2, 'expense', $3, NOW(), 'ai_parsed', $4, $5)`,
        [description, amount, category, CURRENT_USER_ID, budget_id || null]
      );
      if (budget_id) {
        await pool.query(
          `UPDATE "Budget" SET spent = spent + $1, "updatedAt" = NOW() WHERE id = $2 AND "userId" = $3`,
          [amount, budget_id, CURRENT_USER_ID]
        );
      }
      return { content: [{ type: "text", text: `✅ Expense of ₹${amount} logged: "${description}" under ${category}.` }] };
    }

    // ── UPDATE TRANSACTION ──
    if (name === "update_transaction") {
      const { id, amount, description, category, type } = args;
      const updates = [];
      const params = [];
      let i = 1;
      if (amount !== undefined) { updates.push(`amount = $${i++}`);      params.push(amount); }
      if (description)          { updates.push(`description = $${i++}`); params.push(description); }
      if (category)             { updates.push(`category = $${i++}`);    params.push(category); }
      if (type)                 { updates.push(`type = $${i++}`);        params.push(type); }
      if (updates.length === 0) return { content: [{ type: "text", text: "No fields to update." }] };
      params.push(id, CURRENT_USER_ID);
      await pool.query(
        `UPDATE "Transaction" SET ${updates.join(", ")} WHERE id = $${i++} AND "userId" = $${i}`,
        params
      );
      return { content: [{ type: "text", text: `✅ Transaction ${id} updated.` }] };
    }

    // ── DELETE TRANSACTION ──
    if (name === "delete_transaction") {
      await pool.query(`DELETE FROM "Transaction" WHERE id = $1 AND "userId" = $2`, [args.id, CURRENT_USER_ID]);
      return { content: [{ type: "text", text: `🗑️ Transaction ${args.id} deleted.` }] };
    }

    // ── SPENDING SUMMARY ──
    if (name === "get_spending_summary") {
      const { month, year } = args;
      let query = `SELECT category, SUM(amount) as total FROM "Transaction"
                   WHERE "userId" = $1 AND type = 'expense'`;
      const params = [CURRENT_USER_ID];
      let i = 2;
      if (month) { query += ` AND EXTRACT(MONTH FROM date) = $${i++}`; params.push(month); }
      if (year)  { query += ` AND EXTRACT(YEAR FROM date) = $${i++}`;  params.push(year); }
      query += ` GROUP BY category ORDER BY total DESC`;
      const result = await pool.query(query, params);
      return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
    }

    // ── MONTHLY TREND ──
    if (name === "get_monthly_trend") {
      const { months = 6 } = args;
      const result = await pool.query(
        `SELECT TO_CHAR(date, 'YYYY-MM') as month,
                SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
         FROM "Transaction"
         WHERE "userId" = $1 AND date >= NOW() - ($2 || ' months')::INTERVAL
         GROUP BY TO_CHAR(date, 'YYYY-MM')
         ORDER BY month ASC`,
        [CURRENT_USER_ID, months]
      );
      return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
    }

    // ── GET BUDGETS ──
    if (name === "get_budgets") {
      const { month, year } = args;
      let query = `SELECT * FROM "Budget" WHERE "userId" = $1`;
      const params = [CURRENT_USER_ID];
      let i = 2;
      if (month) { query += ` AND month = $${i++}`; params.push(month); }
      if (year)  { query += ` AND year = $${i++}`;  params.push(year); }
      query += ` ORDER BY year DESC, month DESC`;
      const result = await pool.query(query, params);
      return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
    }

    // ── CREATE BUDGET ──
    if (name === "create_budget") {
      const { name: bname, amount, category, month, year } = args;
      const result = await pool.query(
        `INSERT INTO "Budget" (id, name, amount, spent, category, month, year, "createdAt", "updatedAt", "userId")
         VALUES (gen_random_uuid(), $1, $2, 0, $3, $4, $5, NOW(), NOW(), $6)
         RETURNING id`,
        [bname, amount, category, month, year, CURRENT_USER_ID]
      );
      return { content: [{ type: "text", text: `✅ Budget created with ID: ${result.rows[0].id}` }] };
    }

    // ── UPDATE BUDGET ──
    if (name === "update_budget") {
      const { id, name: bname, amount, category } = args;
      const updates = [];
      const params = [];
      let i = 1;
      if (bname)            { updates.push(`name = $${i++}`);     params.push(bname); }
      if (amount !== undefined) { updates.push(`amount = $${i++}`); params.push(amount); }
      if (category)         { updates.push(`category = $${i++}`); params.push(category); }
      updates.push(`"updatedAt" = NOW()`);
      params.push(id, CURRENT_USER_ID);
      await pool.query(
        `UPDATE "Budget" SET ${updates.join(", ")} WHERE id = $${i++} AND "userId" = $${i}`,
        params
      );
      return { content: [{ type: "text", text: `✅ Budget ${id} updated.` }] };
    }

    // ── DELETE BUDGET ──
    if (name === "delete_budget") {
      await pool.query(`DELETE FROM "Budget" WHERE id = $1 AND "userId" = $2`, [args.id, CURRENT_USER_ID]);
      return { content: [{ type: "text", text: `🗑️ Budget ${args.id} deleted.` }] };
    }

    // ── GET LOANS ──
    if (name === "get_loans") {
      const result = await pool.query(
        `SELECT * FROM "Loan" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
        [CURRENT_USER_ID]
      );
      return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
    }

    // ── ADD LOAN ──
    if (name === "add_loan") {
      const { name: lname, type, principal, outstanding, emi, interest_rate, tenure_months, start_date } = args;
      const result = await pool.query(
        `INSERT INTO "Loan" (id, name, type, principal, outstanding, emi, "interestRate", "tenureMonths", "startDate", "createdAt", "updatedAt", "userId")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
         RETURNING id`,
        [lname, type, principal, outstanding, emi, interest_rate, tenure_months, start_date, CURRENT_USER_ID]
      );
      return { content: [{ type: "text", text: `✅ Loan added with ID: ${result.rows[0].id}` }] };
    }

    // ── UPDATE LOAN ──
    if (name === "update_loan") {
      const { id, outstanding, emi, interest_rate } = args;
      const updates = [];
      const params = [];
      let i = 1;
      if (outstanding !== undefined)  { updates.push(`outstanding = $${i++}`);    params.push(outstanding); }
      if (emi !== undefined)          { updates.push(`emi = $${i++}`);            params.push(emi); }
      if (interest_rate !== undefined){ updates.push(`"interestRate" = $${i++}`); params.push(interest_rate); }
      updates.push(`"updatedAt" = NOW()`);
      params.push(id, CURRENT_USER_ID);
      await pool.query(
        `UPDATE "Loan" SET ${updates.join(", ")} WHERE id = $${i++} AND "userId" = $${i}`,
        params
      );
      return { content: [{ type: "text", text: `✅ Loan ${id} updated.` }] };
    }

    // ── DELETE LOAN ──
    if (name === "delete_loan") {
      await pool.query(`DELETE FROM "Loan" WHERE id = $1 AND "userId" = $2`, [args.id, CURRENT_USER_ID]);
      return { content: [{ type: "text", text: `🗑️ Loan ${args.id} deleted.` }] };
    }

  } catch (error) {
    console.error("DB_ERROR:", error);
    return {
      content: [{ type: "text", text: `❌ Database Error: ${error.message}` }],
      isError: true
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ FinFlow MCP Server v2.0 running...");