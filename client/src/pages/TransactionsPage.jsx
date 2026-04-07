import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import api from "../services/api.js";
import { useSocket } from '../context/SocketContext.jsx';

const CATEGORIES = [
  "All",
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Utilities",
  "Salary",
  "Other",
];

const CATEGORY_COLORS = {
  Food: { bg: "bg-red-50", text: "text-red-500" },
  Transport: { bg: "bg-blue-50", text: "text-blue-500" },
  Shopping: { bg: "bg-purple-50", text: "text-purple-500" },
  Entertainment: { bg: "bg-orange-50", text: "text-orange-500" },
  Health: { bg: "bg-green-50", text: "text-green-500" },
  Utilities: { bg: "bg-yellow-50", text: "text-yellow-600" },
  Salary: { bg: "bg-brand-50", text: "text-brand" },
  Other: { bg: "bg-gray-50", text: "text-gray-500" },
};

const CATEGORY_HEX = {
  Food: "#EF4444",
  Transport: "#3B82F6",
  Shopping: "#A855F7",
  Entertainment: "#F97316",
  Health: "#22C55E",
  Utilities: "#CA8A04",
  Other: "#6B7280",
};

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const groupByDate = (txns) => {
  const groups = {};
  txns.forEach((tx) => {
    const date = new Date(tx.date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
  });
  return groups;
};

const EMPTY_FORM = {
  description: "",
  amount: "",
  type: "expense",
  category: "Food",
  date: new Date().toISOString().split("T")[0],
  budgetId: "",
};

function AddTransactionSheet({ budgets, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/transactions", {
        ...form,
        amount: parseFloat(form.amount),
        budgetId: form.budgetId || undefined,
      });
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-bold text-gray-900 mb-5">
          Add transaction
        </h3>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-sm text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="flex bg-gray-100 rounded-2xl p-1">
            {["expense", "income"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                  form.type === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Description
            </label>
            <input
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              placeholder="e.g. Lunch at cafe"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Amount (₹)
            </label>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={handleChange}
              required
              placeholder="500"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`py-2 rounded-2xl text-xs font-medium transition-all ${
                    form.category === cat
                      ? "bg-brand text-white"
                      : "bg-gray-50 text-gray-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Date
            </label>
            <input
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          {form.type === "expense" && budgets.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                Link to budget (optional)
              </label>
              <select
                name="budgetId"
                value={form.budgetId}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">No budget</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeOpacity="0.3"
                  />
                  <path
                    d="M12 2 a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Saving...
              </span>
            ) : (
              "Add transaction"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { socket } = useSocket();

  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const LIMIT = 20;

  const fetchTransactions = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams({
          limit: LIMIT,
          offset: currentOffset,
        });
        if (activeCategory !== "All") params.append("category", activeCategory);
        const { data } = await api.get(`/transactions?${params}`);
        setTransactions((prev) => (reset ? data : [...prev, ...data]));
        setHasMore(data.length === LIMIT);
        setOffset(currentOffset + data.length);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeCategory, offset],
  );

  useEffect(() => {
    setOffset(0);
    fetchTransactions(true);
  }, [activeCategory]);

  useEffect(() => {
    api
      .get("/budgets")
      .then((r) => setBudgets(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("transaction:created", (tx) =>
      setTransactions((prev) => [tx, ...prev]),
    );
    socket.on("transaction:deleted", (id) =>
      setTransactions((prev) => prev.filter((t) => t.id !== id)),
    );
    return () => {
      socket.off("transaction:created");
      socket.off("transaction:deleted");
    };
  }, [socket]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = search
    ? transactions.filter((t) =>
        t.description.toLowerCase().includes(search.toLowerCase()),
      )
    : transactions;

  const grouped = groupByDate(filtered);

  const totalIncome = filtered
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const expenseByCategory = Object.entries(
    filtered
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {})
  )
    .map(([name, value]) => ({ name, value, color: CATEGORY_HEX[name] || "#6B7280" }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="flex items-center justify-between mb-5 z-1 relative">
          <h1 className="text-white text-xl font-bold">Transactions</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Income / Expense summary */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white/15 backdrop-blur rounded-2xl px-4 py-3">
            <p className="text-white/70 text-xs mb-1">Income</p>
            <p className="text-white font-bold">{fmt(totalIncome)}</p>
          </div>
          <div className="flex-1 bg-white/15 backdrop-blur rounded-2xl px-4 py-3">
            <p className="text-white/70 text-xs mb-1">Expenses</p>
            <p className="text-white font-bold">{fmt(totalExpense)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-4">
        {/* Expense by Category chart */}
        {expenseByCategory.length > 0 && (
          <div className="card pt-4 pb-3">
            <p className="text-sm font-bold text-gray-800 mb-3 px-1">Expenses by Category</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expenseByCategory.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [fmt(value), "Amount"]}
                  contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 px-1">
              {expenseByCategory.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-gray-500 truncate">{entry.name}</span>
                  <span className="text-xs font-semibold text-gray-700 ml-auto">{fmt(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="card py-3 px-4 flex items-center gap-3 mt-6">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-400">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white text-gray-500 shadow-card"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Transactions grouped by date */}
        {loading ? (
          Array(5)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="card animate-pulse flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-2xl flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-100 rounded-full w-2/3 mb-2" />
                  <div className="h-2 bg-gray-100 rounded-full w-1/3" />
                </div>
                <div className="h-4 bg-gray-100 rounded-full w-16" />
              </div>
            ))
        ) : filtered.length === 0 ? (
          <div className="card text-center py-10">
            <div className="w-14 h-14 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1A6BFF"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <p className="text-gray-700 font-semibold mb-1">
              No transactions found
            </p>
            <p className="text-xs text-gray-400 mb-4">
              {search
                ? "Try a different search term"
                : "Add your first transaction"}
            </p>
            {!search && (
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm font-semibold text-white bg-brand px-6 py-2.5 rounded-2xl"
              >
                Add transaction
              </button>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([date, txns]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {date}
              </p>
              <div className="card p-0 overflow-hidden">
                {txns.map((tx, i) => {
                  const colors =
                    CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.Other;
                  return (
                    <div
                      key={tx.id}
                      className={`flex items-center gap-3 px-4 py-3.5 ${i < txns.length - 1 ? "border-b border-gray-50" : ""}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm flex-shrink-0 font-semibold ${colors.bg} ${colors.text}`}
                      >
                        {tx.category?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {tx.description}
                        </p>
                        <p className="text-xs text-gray-400">{tx.category}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-sm font-bold ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}
                        >
                          {tx.type === "income" ? "+" : "-"}
                          {fmt(tx.amount)}
                        </span>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Load more */}
        {hasMore && !loading && !search && (
          <button
            onClick={() => fetchTransactions(false)}
            disabled={loadingMore}
            className="w-full py-3 rounded-2xl bg-white text-brand text-sm font-semibold shadow-card"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        )}
      </div>

      {showAdd && (
        <AddTransactionSheet
          budgets={budgets}
          onClose={() => setShowAdd(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
