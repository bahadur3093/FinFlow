import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CATEGORY_STYLE, fmtCompact } from '../../utils/ccCategories.js';

export default function CCCategoryChart({ transactions }) {
  const data = useMemo(() => {
    const totals = {};
    transactions.forEach((tx) => {
      if (tx.type !== 'debit' || tx.is_reversal || tx.ai_category === 'Rewards' || !tx.included) return;
      const cat = tx.ai_category || 'Others';
      totals[cat] = (totals[cat] || 0) + (tx.amount || 0);
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length) return null;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0].payload;
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
      <div className="bg-white rounded-xl shadow-card px-3 py-2 border border-gray-100">
        <p className="text-xs font-bold text-gray-800">{name}</p>
        <p className="text-xs text-gray-500">{fmtCompact(value)} · {pct}%</p>
      </div>
    );
  };

  return (
    <div className="card space-y-4">
      <p className="text-sm font-bold text-gray-800">Spend by Category</p>

      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={(CATEGORY_STYLE[entry.name] || CATEGORY_STYLE['Others']).hex}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="space-y-2">
        {data.map((entry) => {
          const style = CATEGORY_STYLE[entry.name] || CATEGORY_STYLE['Others'];
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <div key={entry.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: style.hex }} />
              <p className="text-xs text-gray-600 flex-1">{entry.name}</p>
              <p className="text-xs font-semibold text-gray-800">{fmtCompact(entry.value)}</p>
              <p className="text-xs text-gray-400 w-8 text-right">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
