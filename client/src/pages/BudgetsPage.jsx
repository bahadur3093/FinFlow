import { useState, useEffect } from "react";
import api from "../services/api.js";
import { useSocket } from '../context/SocketContext.jsx';

const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Utilities",
  "Other",
];

const CATEGORY_COLORS = {
  Food: { bg: "bg-red-50", text: "text-red-500", bar: "bg-red-400" },
  Transport: { bg: "bg-blue-50", text: "text-blue-500", bar: "bg-blue-400" },
  Shopping: {
    bg: "bg-purple-50",
    text: "text-purple-500",
    bar: "bg-purple-400",
  },
  Entertainment: {
    bg: "bg-orange-50",
    text: "text-orange-500",
    bar: "bg-orange-400",
  },
  Health: { bg: "bg-green-50", text: "text-green-500", bar: "bg-green-400" },
  Utilities: {
    bg: "bg-yellow-50",
    text: "text-yellow-500",
    bar: "bg-yellow-400",
  },
  Other: { bg: "bg-gray-50", text: "text-gray-500", bar: "bg-gray-400" },
};

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const EMPTY_FORM = {
  name: "",
  amount: "",
  category: "Food",
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
};

function BudgetCard({ budget, onDelete }) {
  const pct = Math.min((budget.spent / budget.amount) * 100, 100);
  const over = budget.spent > budget.amount;
  const warn = !over && pct >= 80;
  const colors = CATEGORY_COLORS[budget.category] || CATEGORY_COLORS.Other;
  const barColor = over ? "bg-red-400" : warn ? "bg-amber-400" : colors.bar;

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg ${colors.bg}`}
          >
            {budget.category?.[0]}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{budget.name}</p>
            <p className="text-xs text-gray-400">{budget.category}</p>
          </div>
        </div>
        <button
          onClick={() => onDelete(budget.id)}
          className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-400 transition-colors"
        >
          <svg
            width="12"
            height="12"
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

      <div className="flex justify-between items-end mb-2">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Spent</p>
          <p
            className={`text-lg font-bold ${over ? "text-red-500" : "text-gray-900"}`}
          >
            {fmt(budget.spent)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">Budget</p>
          <p className="text-lg font-bold text-gray-900">
            {fmt(budget.amount)}
          </p>
        </div>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            over
              ? "bg-red-50 text-red-500"
              : warn
                ? "bg-amber-50 text-amber-500"
                : "bg-green-50 text-green-500"
          }`}
        >
          {over
            ? "Over budget"
            : warn
              ? `${Math.round(pct)}% used`
              : `${Math.round(pct)}% used`}
        </span>
        <span className="text-xs text-gray-400">
          {fmt(Math.max(budget.amount - budget.spent, 0))} left
        </span>
      </div>
    </div>
  );
}

function AddBudgetSheet({ onClose, onSaved }) {
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
      const { data } = await api.post("/budgets", {
        ...form,
        amount: parseFloat(form.amount),
        month: +form.month,
        year: +form.year,
      });
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create budget");
    } finally {
      setLoading(false);
    }
  };

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-bold text-gray-900 mb-5">New budget</h3>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-sm text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Budget name
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Groceries"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`py-2 rounded-2xl text-xs font-medium transition-all ${
                    form.category === cat
                      ? "bg-brand text-white shadow-sm"
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
              Amount (₹)
            </label>
            <input
              name="amount"
              type="number"
              min="1"
              value={form.amount}
              onChange={handleChange}
              required
              placeholder="5000"
              className="input-field"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                Month
              </label>
              <select
                name="month"
                value={form.month}
                onChange={handleChange}
                className="input-field"
              >
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                Year
              </label>
              <input
                name="year"
                type="number"
                value={form.year}
                onChange={handleChange}
                required
                className="input-field"
              />
            </div>
          </div>

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
              "Create budget"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { socket } = useSocket();

  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const now = new Date();
  const [filter, setFilter] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  useEffect(() => {
    const fetchBudgets = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(
          `/budgets?month=${filter.month}&year=${filter.year}`,
        );
        setBudgets(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBudgets();
  }, [filter]);

  useEffect(() => {
    if (!socket) return;
    socket.on("budget:created", (b) => setBudgets((prev) => [...prev, b]));
    socket.on("budget:updated", (b) =>
      setBudgets((prev) => prev.map((b2) => (b2.id === b.id ? b : b2))),
    );
    socket.on("budget:deleted", (id) =>
      setBudgets((prev) => prev.filter((b) => b.id !== id)),
    );
    return () => {
      socket.off("budget:created");
      socket.off("budget:updated");
      socket.off("budget:deleted");
    };
  }, [socket]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/budgets/${id}`);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct =
    totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="flex items-center justify-between mb-6 z-1 relative">
          <h1 className="text-white text-xl font-bold">Budgets</h1>
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

        {/* Month selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {months.map((m, i) => (
            <button
              key={m}
              onClick={() => setFilter((f) => ({ ...f, month: i + 1 }))}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter.month === i + 1
                  ? "bg-white text-brand"
                  : "bg-white/20 text-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6 space-y-4">
        {/* Summary card */}
        <div className="card shadow-card-lg">
          <div className="flex justify-between items-center mt-6 my-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Total spent</p>
              <p className="text-2xl font-bold text-gray-900">
                {fmt(totalSpent)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">Total budget</p>
              <p className="text-2xl font-bold text-gray-900">
                {fmt(totalBudget)}
              </p>
            </div>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${overallPct >= 100 ? "bg-red-400" : overallPct >= 80 ? "bg-amber-400" : "bg-brand"}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {fmt(Math.max(totalBudget - totalSpent, 0))} remaining this month
          </p>
        </div>

        {/* Budget cards */}
        {loading ? (
          Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-gray-100 rounded-full w-1/3 mb-3" />
                <div className="h-6 bg-gray-100 rounded-full w-1/2 mb-3" />
                <div className="h-2 bg-gray-100 rounded-full" />
              </div>
            ))
        ) : budgets.length === 0 ? (
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
                <rect x="2" y="7" width="20" height="14" rx="3" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <p className="text-gray-700 font-semibold mb-1">No budgets yet</p>
            <p className="text-xs text-gray-400 mb-4">
              Set a budget to start tracking your spending
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="text-sm font-semibold text-white bg-brand px-6 py-2.5 rounded-2xl"
            >
              Create first budget
            </button>
          </div>
        ) : (
          budgets.map((b) => (
            <BudgetCard key={b.id} budget={b} onDelete={handleDelete} />
          ))
        )}
      </div>

      {showAdd && (
        <AddBudgetSheet
          onClose={() => setShowAdd(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
