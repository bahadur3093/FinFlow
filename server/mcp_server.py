#!/usr/bin/env python3
"""
FinFlow MCP Server v2.0 — Python / FastMCP
Connects Claude to the FinFlow PostgreSQL database.
Deploy on Render as a web service (SSE transport).
"""

import os
import json
from typing import Optional

import psycopg2
import psycopg2.extras
from psycopg2 import pool as pg_pool
from fastmcp import FastMCP

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

DATABASE_URL = os.environ["DATABASE_URL"]
CURRENT_USER_ID = os.environ.get("MCP_USER_ID", "cmnlkvkp30000hqm96cwu47rc")

connection_pool = pg_pool.ThreadedConnectionPool(
    1, 5,
    dsn=DATABASE_URL,
    cursor_factory=psycopg2.extras.RealDictCursor
)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def get_conn():
    return connection_pool.getconn()

def release_conn(conn):
    connection_pool.putconn(conn)

def query(sql: str, params: tuple = ()):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            conn.commit()
            try:
                rows = cur.fetchall()
                return [dict(r) for r in rows]
            except psycopg2.ProgrammingError:
                return []
    except Exception:
        conn.rollback()
        raise
    finally:
        release_conn(conn)

def rows_to_text(rows: list) -> str:
    return json.dumps(rows, indent=2, default=str)

def f(v): return float(v) if v is not None else None
def i(v): return int(v)   if v is not None else None

# ─────────────────────────────────────────────
# FASTMCP APP
# ─────────────────────────────────────────────

mcp = FastMCP(
    name="finflow-backend-agent",
    instructions="FinFlow personal finance assistant. Manages transactions, budgets, and loans."
)

# ═════════════════════════════════════════════
# BALANCE
# ═════════════════════════════════════════════

@mcp.tool(description="Get the current total balance (Income - Expenses)")
def get_balance() -> str:
    rows = query(
        """
        SELECT
            SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
        FROM "Transaction"
        WHERE "userId" = %s
        """,
        (CURRENT_USER_ID,)
    )
    income   = float(rows[0]["income"]   or 0)
    expenses = float(rows[0]["expenses"] or 0)
    balance  = income - expenses
    return f"Balance: ₹{balance:.2f} (Income: ₹{income:.2f}, Expenses: ₹{expenses:.2f})"

# ═════════════════════════════════════════════
# TRANSACTIONS
# ═════════════════════════════════════════════

@mcp.tool(description="Get transactions with optional filters")
def get_transactions(
    type: Optional[str] = None,
    category: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: Optional[str] = None
) -> str:
    lim = int(limit) if limit else 50
    sql    = 'SELECT * FROM "Transaction" WHERE "userId" = %s'
    params = [CURRENT_USER_ID]
    if type:      sql += " AND type = %s";      params.append(type)
    if category:  sql += " AND category = %s";  params.append(category)
    if from_date: sql += " AND date >= %s";     params.append(from_date)
    if to_date:   sql += " AND date <= %s";     params.append(to_date)
    sql += " ORDER BY date DESC LIMIT %s";      params.append(lim)
    rows = query(sql, tuple(params))
    return rows_to_text(rows)


@mcp.tool(description="Log a new income entry")
def add_income(
    amount: str,
    description: str,
    category: str,
    budget_id: Optional[str] = None
) -> str:
    amt = float(amount)
    query(
        """
        INSERT INTO "Transaction"
            (id, description, amount, type, category, date, source, "userId", "budgetId")
        VALUES (gen_random_uuid(), %s, %s, 'income', %s, NOW(), 'ai_parsed', %s, %s)
        """,
        (description, amt, category, CURRENT_USER_ID, budget_id)
    )
    return f'✅ Income of ₹{amt} logged: "{description}" under {category}.'


@mcp.tool(description="Log a new expense entry")
def add_expense(
    amount: str,
    description: str,
    category: str,
    budget_id: Optional[str] = None
) -> str:
    amt = float(amount)
    query(
        """
        INSERT INTO "Transaction"
            (id, description, amount, type, category, date, source, "userId", "budgetId")
        VALUES (gen_random_uuid(), %s, %s, 'expense', %s, NOW(), 'ai_parsed', %s, %s)
        """,
        (description, amt, category, CURRENT_USER_ID, budget_id)
    )
    if budget_id:
        query(
            'UPDATE "Budget" SET spent = spent + %s, "updatedAt" = NOW() WHERE id = %s AND "userId" = %s',
            (amt, budget_id, CURRENT_USER_ID)
        )
    return f'✅ Expense of ₹{amt} logged: "{description}" under {category}.'


@mcp.tool(description="Update an existing transaction")
def update_transaction(
    id: str,
    amount: Optional[str] = None,
    description: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None
) -> str:
    updates, params = [], []
    if amount is not None: updates.append("amount = %s");      params.append(float(amount))
    if description:        updates.append("description = %s"); params.append(description)
    if category:           updates.append("category = %s");    params.append(category)
    if type:               updates.append("type = %s");        params.append(type)
    if not updates:
        return "No fields to update."
    params.extend([id, CURRENT_USER_ID])
    query(
        f'UPDATE "Transaction" SET {", ".join(updates)} WHERE id = %s AND "userId" = %s',
        tuple(params)
    )
    return f"✅ Transaction {id} updated."


@mcp.tool(description="Delete a transaction by ID")
def delete_transaction(id: str) -> str:
    query('DELETE FROM "Transaction" WHERE id = %s AND "userId" = %s', (id, CURRENT_USER_ID))
    return f"🗑️ Transaction {id} deleted."


@mcp.tool(description="Get spending grouped by category for a given month/year")
def get_spending_summary(
    month: Optional[str] = None,
    year: Optional[str] = None
) -> str:
    sql    = 'SELECT category, SUM(amount) AS total FROM "Transaction" WHERE "userId" = %s AND type = \'expense\''
    params = [CURRENT_USER_ID]
    if month: sql += " AND EXTRACT(MONTH FROM date) = %s"; params.append(int(month))
    if year:  sql += " AND EXTRACT(YEAR FROM date) = %s";  params.append(int(year))
    sql += " GROUP BY category ORDER BY total DESC"
    rows = query(sql, tuple(params))
    return rows_to_text(rows)


@mcp.tool(description="Get income vs expense totals month by month")
def get_monthly_trend(months: Optional[str] = None) -> str:
    m = int(months) if months else 6
    rows = query(
        """
        SELECT
            TO_CHAR(date, 'YYYY-MM') AS month,
            SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
        FROM "Transaction"
        WHERE "userId" = %s
          AND date >= NOW() - (%s || ' months')::INTERVAL
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY month ASC
        """,
        (CURRENT_USER_ID, str(m))
    )
    return rows_to_text(rows)

# ═════════════════════════════════════════════
# BUDGETS
# ═════════════════════════════════════════════

@mcp.tool(description="Get all budgets, optionally filtered by month/year")
def get_budgets(
    month: Optional[str] = None,
    year: Optional[str] = None
) -> str:
    sql    = 'SELECT * FROM "Budget" WHERE "userId" = %s'
    params = [CURRENT_USER_ID]
    if month: sql += " AND month = %s"; params.append(int(month))
    if year:  sql += " AND year = %s";  params.append(int(year))
    sql += " ORDER BY year DESC, month DESC"
    rows = query(sql, tuple(params))
    return rows_to_text(rows)


@mcp.tool(description="Create a new budget for a category and month")
def create_budget(
    name: str,
    amount: str,
    category: str,
    month: str,
    year: str
) -> str:
    rows = query(
        """
        INSERT INTO "Budget"
            (id, name, amount, spent, category, month, year, "createdAt", "updatedAt", "userId")
        VALUES (gen_random_uuid(), %s, %s, 0, %s, %s, %s, NOW(), NOW(), %s)
        RETURNING id
        """,
        (name, float(amount), category, int(month), int(year), CURRENT_USER_ID)
    )
    return f"✅ Budget created with ID: {rows[0]['id']}"


@mcp.tool(description="Update an existing budget's name, amount, or category")
def update_budget(
    id: str,
    name: Optional[str] = None,
    amount: Optional[str] = None,
    category: Optional[str] = None
) -> str:
    updates, params = [], []
    if name:   updates.append("name = %s");   params.append(name)
    if amount: updates.append("amount = %s"); params.append(float(amount))
    if category: updates.append("category = %s"); params.append(category)
    updates.append('"updatedAt" = NOW()')
    params.extend([id, CURRENT_USER_ID])
    query(
        f'UPDATE "Budget" SET {", ".join(updates)} WHERE id = %s AND "userId" = %s',
        tuple(params)
    )
    return f"✅ Budget {id} updated."


@mcp.tool(description="Delete a budget by ID")
def delete_budget(id: str) -> str:
    query('DELETE FROM "Budget" WHERE id = %s AND "userId" = %s', (id, CURRENT_USER_ID))
    return f"🗑️ Budget {id} deleted."

# ═════════════════════════════════════════════
# LOANS
# ═════════════════════════════════════════════

@mcp.tool(description="Get all loans for the current user")
def get_loans() -> str:
    rows = query(
        'SELECT * FROM "Loan" WHERE "userId" = %s ORDER BY "createdAt" DESC',
        (CURRENT_USER_ID,)
    )
    return rows_to_text(rows)


@mcp.tool(description="Add a new loan")
def add_loan(
    name: str,
    type: str,
    principal: str,
    outstanding: str,
    emi: str,
    interest_rate: str,
    tenure_months: str,
    start_date: str
) -> str:
    rows = query(
        """
        INSERT INTO "Loan"
            (id, name, type, principal, outstanding, emi,
             "interestRate", "tenureMonths", "startDate",
             "createdAt", "updatedAt", "userId")
        VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), %s)
        RETURNING id
        """,
        (name, type, float(principal), float(outstanding), float(emi),
         float(interest_rate), int(tenure_months), start_date, CURRENT_USER_ID)
    )
    return f"✅ Loan added with ID: {rows[0]['id']}"


@mcp.tool(description="Update an existing loan (e.g. after EMI payment, update outstanding)")
def update_loan(
    id: str,
    outstanding: Optional[str] = None,
    emi: Optional[str] = None,
    interest_rate: Optional[str] = None
) -> str:
    updates, params = [], []
    if outstanding:   updates.append("outstanding = %s");    params.append(float(outstanding))
    if emi:           updates.append("emi = %s");            params.append(float(emi))
    if interest_rate: updates.append('"interestRate" = %s'); params.append(float(interest_rate))
    updates.append('"updatedAt" = NOW()')
    params.extend([id, CURRENT_USER_ID])
    query(
        f'UPDATE "Loan" SET {", ".join(updates)} WHERE id = %s AND "userId" = %s',
        tuple(params)
    )
    return f"✅ Loan {id} updated."


@mcp.tool(description="Delete a loan by ID")
def delete_loan(id: str) -> str:
    query('DELETE FROM "Loan" WHERE id = %s AND "userId" = %s', (id, CURRENT_USER_ID))
    return f"🗑️ Loan {id} deleted."

# ─────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"✅ FinFlow MCP Server v2.0 (Python/FastMCP) running on port {port}...")
    mcp.run(transport="sse", host="0.0.0.0", port=port)
