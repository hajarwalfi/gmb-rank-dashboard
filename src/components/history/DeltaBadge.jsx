import React from 'react';

export default function DeltaBadge({ text, type }) {
  const colors = {
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    negative: 'bg-rose-50 text-rose-700 border-rose-100',
    neutral: 'bg-slate-100 text-slate-500 border-slate-200'
  };
  
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${colors[type]}`}>
      {text}
    </span>
  );
}
