import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const dataObj = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-2xl z-[9999] min-w-[200px] pointer-events-none ring-1 ring-slate-900/5">
        <div className="flex flex-col mb-3 pb-2 border-b border-slate-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Snapshot Date</span>
            <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-md">{dataObj.time}</span>
          </div>
          <span className="text-xs font-bold text-slate-900">{dataObj.date}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Customer Reviews</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">
              {payload[0].value}
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Records</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ReviewChart({ scans }) {
  const data = scans.map(s => {
    const d = new Date(s.scanned_at);
    return {
      timestamp: s.scanned_at,
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: s.reviews?.total_count || 0,
    };
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="w-full space-y-8 animate-fade-in">
      <div className="pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight"> Reputation Growth Analytics</h3>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase tracking-widest font-black italic border border-emerald-200">
            Social Proof
          </span>
        </div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
          Historical tracking of customer feedback and review velocity
        </p>
      </div>

      <div className="rounded-[2rem] sm:rounded-[2.5rem] bg-white border border-slate-200/60 p-4 sm:p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden group">
        <div className="relative h-[300px] sm:h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 10, top: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="timestamp"
                hide
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 9, fontWeight: 800, dx: -5 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ zIndex: 100 }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#10b981"
                strokeWidth={4}
                dot={{ r: 0 }}
                activeDot={{ r: 8, fill: '#fff', strokeWidth: 4, stroke: '#10b981' }}
                animationDuration={1500}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
