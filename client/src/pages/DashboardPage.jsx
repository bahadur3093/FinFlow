import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import api from "../services/api.js";
import { useAuthStore } from "../store/authStore.js";
import { useSocket } from '../context/SocketContext.jsx';

const CATEGORY_COLORS = {
  Food: "#FF6B6B",
  Transport: "#4D8EFF",
  Shopping: "#A78BFA",
  Entertainment: "#FB923C",
  Health: "#34D399",
  Utilities: "#FBBF24",
  Salary: "#1A6BFF",
  Other: "#9CA3AF",
};

const CATEGORY_BG = {
  Food: "bg-red-50",
  Transport: "bg-blue-50",
  Shopping: "bg-purple-50",
  Entertainment: "bg-orange-50",
  Health: "bg-green-50",
  Utilities: "bg-yellow-50",
  Salary: "bg-brand-50",
  Other: "bg-gray-50",
};

function Avatar({ name }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const { connected } = useSocket();

  return (
    <div className="relative">
      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand font-bold text-sm">
        {initials}
      </div>
      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-gray-100 rounded-full w-1/3 mb-3" />
      <div className="h-8 bg-gray-100 rounded-full w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded-full w-2/3" />
    </div>
  );
}

export default function DashboardPage() {
  const { socket } = useSocket();

  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [txRes, budgetRes] = await Promise.all([
          api.get("/transactions?limit=5"),
          api.get(`/budgets?month=${month}&year=${year}`),
        ]);
        setTransactions(txRes.data);
        setBudgets(budgetRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("transaction:created", (tx) =>
      setTransactions((prev) => [tx, ...prev].slice(0, 5)),
    );
    socket.on("budget:updated", (b) =>
      setBudgets((prev) => prev.map((b2) => (b2.id === b.id ? b : b2))),
    );
    socket.on("budget:created", (b) => setBudgets((prev) => [...prev, b]));
    return () => {
      socket.off("transaction:created");
      socket.off("budget:updated");
      socket.off("budget:created");
    };
  }, [socket]);

  // Derived stats
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // Spending by category for donut
  const categorySpend = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
  const donutData = Object.entries(categorySpend).map(([name, value]) => ({
    name,
    value,
  }));

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  if (loading)
    return (
      <div className="px-5 pt-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-16 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="absolute top-16 -left-6 w-28 h-28 rounded-full bg-white opacity-5" />

        <div className="flex items-center justify-between mb-6 z-1 relative">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name} />
            <div>
              <p className="text-white/70 text-xs">{greeting()},</p>
              <p className="text-white font-semibold text-sm">
                {user?.name?.split(" ")[0]}
              </p>
            </div>
          </div>
          <button className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>

        <p className="text-white/70 text-xs mb-1">Total Balance</p>
        <h2 className="text-white text-4xl font-bold tracking-tight mb-4">
          {fmt(balance)}
        </h2>

        <div className="flex gap-3">
          <div className="flex-1 bg-white/15 backdrop-blur rounded-2xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 8V2M2 5l3-3 3 3"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-white/70 text-xs">Income</span>
            </div>
            <p className="text-white font-bold text-sm">{fmt(totalIncome)}</p>
          </div>
          <div className="flex-1 bg-white/15 backdrop-blur rounded-2xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded-full bg-red-400 flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 2v6M8 5L5 8 2 5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-white/70 text-xs">Expenses</span>
            </div>
            <p className="text-white font-bold text-sm">{fmt(totalExpense)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-6 space-y-4">
        {/* Spending donut */}
        {donutData.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mt-6 my-4">
              <h3 className="font-bold text-gray-900 text-sm">
                Spending breakdown
              </h3>
              <span className="text-xs text-gray-400">This period</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={CATEGORY_COLORS[entry.name] || "#9CA3AF"}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {donutData.slice(0, 4).map(({ name, value }) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: CATEGORY_COLORS[name] || "#9CA3AF",
                        }}
                      />
                      <span className="text-xs text-gray-600">{name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-800">
                      {fmt(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Budget progress */}
        {budgets.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between my-4">
              <h3 className="font-bold text-gray-900 text-sm">
                Monthly budgets
              </h3>
              <button
                onClick={() => navigate("/budgets")}
                className="text-xs text-brand font-semibold"
              >
                See all
              </button>
            </div>
            <div className="space-y-4">
              {budgets.slice(0, 3).map((b) => {
                const pct = Math.min((b.spent / b.amount) * 100, 100);
                const over = b.spent > b.amount;
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs ${CATEGORY_BG[b.category] || "bg-gray-50"}`}
                        >
                          {b.category?.[0] || "?"}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {b.name}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold ${over ? "text-red-500" : "text-gray-500"}`}
                      >
                        {fmt(b.spent)} / {fmt(b.amount)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${over ? "bg-red-400" : pct > 80 ? "bg-amber-400" : "bg-brand"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {fmt(b.amount - b.spent)} remaining
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        <div className="card">
          <div className="flex items-center justify-between my-4">
            <h3 className="font-bold text-gray-900 text-sm">
              Recent transactions
            </h3>
            <button
              onClick={() => navigate("/transactions")}
              className="text-xs text-brand font-semibold"
            >
              See all
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No transactions yet</p>
              <button
                onClick={() => navigate("/transactions")}
                className="mt-3 text-xs text-brand font-semibold"
              >
                Add your first one
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm flex-shrink-0 ${CATEGORY_BG[tx.category] || "bg-gray-50"}`}
                  >
                    {tx.category?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {tx.description}
                    </p>
                    <p className="text-xs text-gray-400">
                      {tx.category} ·{" "}
                      {new Date(tx.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold flex-shrink-0 ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Empty state nudge */}
        {transactions.length === 0 && budgets.length === 0 && (
          <div className="card bg-brand-50 border border-brand-100">
            <p className="text-sm font-semibold text-brand mb-1">Get started</p>
            <p className="text-xs text-brand/70 mb-3">
              Upload a bank statement to auto-import transactions, or add them
              manually.
            </p>
            <button
              onClick={() => navigate("/upload")}
              className="text-xs font-semibold text-white bg-brand px-4 py-2 rounded-xl"
            >
              Upload statement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
