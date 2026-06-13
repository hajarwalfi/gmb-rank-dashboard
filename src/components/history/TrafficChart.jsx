import React, { useMemo, useRef, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

function normKw(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function CustomDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const onDoc = (e) => {
      if (!open) return;
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-3 min-w-0 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-emerald-200 hover:ring-2 hover:ring-emerald-50 focus:outline-none"
      >
        <span className="min-w-0 text-left leading-tight py-1"> {selected?.label || 'Select…'}</span>
        <span className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute z-[100] mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-fade-in"
        >
          <div className="max-h-72 overflow-auto py-1 custom-scrollbar">
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left text-xs font-bold transition-colors ${
                    active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="leading-normal">{o.label}</span>
                    {active && (
                      <span className="text-emerald-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, isKeyword = false }) => {
  if (active && payload && payload.length) {
    const dataObj = payload[0].payload;
    const dateStr = new Date(dataObj.timestamp).toLocaleString();
    
    return (
      <div className="bg-white p-4 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-2xl z-[9999] min-w-[220px] pointer-events-none ring-1 ring-slate-900/5">
        <div className="flex flex-col mb-3 pb-2 border-b border-slate-50">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Snapshot Date</span>
          <span className="text-xs font-bold text-slate-900">{dateStr}</span>
        </div>
        
        <div className="space-y-3">
          {isKeyword ? (
            <>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Monthly Volume</span>
                <span className="text-lg font-black text-emerald-600">{dataObj.volume.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Rank Position</span>
                <span className="text-lg font-black text-slate-900">#{dataObj.rank}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Daily Traffic Est.</span>
                <span className="text-lg font-black text-blue-600">{Number(dataObj.dailyClicks || 0).toLocaleString()}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Monthly Visits</span>
                <span className="text-2xl font-black text-emerald-600">{Math.round(dataObj.estimated_monthly_clicks).toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Daily Avg Across All</span>
                <span className="text-lg font-black text-blue-600">{Math.round(dataObj.estimated_daily_clicks).toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function TrafficChart({ scans }) {
  const [keywordFilter, setKeywordFilter] = useState('');

  const daysFromSourceMonth = (sourceMonth) => {
    const s = String(sourceMonth || '').trim();
    if (!s || s === 'N/A') return 30;
    const [m, y] = s.split('/').map((x) => Number(x));
    if (!m || !y) return 30;
    return new Date(y, m, 0).getDate();
  };

  const aggregatedData = scans
    .filter(s => s.traffic?.estimated_monthly_clicks != null)
    .map(s => ({
      timestamp: s.scanned_at,
      estimated_monthly_clicks: s.traffic.estimated_monthly_clicks,
      estimated_daily_clicks: s.traffic.estimated_daily_clicks || (s.traffic.estimated_monthly_clicks / 30)
    }))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const keywordHistoryMap = {};
  const tableData = [];
  const kwPointCounter = {};

  scans.forEach(scan => {
    const timestamp = scan.scanned_at;
    const mapRanks = scan.map_ranks || [];
    
    mapRanks.forEach(mr => {
      const kw = mr.keyword;
      if (!kw) return;

      const month = mr.source_month || 'N/A';
      const volume = Number(mr.volume) || 0;
      const dailyFromMonth = volume > 0 ? Math.round((volume / daysFromSourceMonth(month)) * 10) / 10 : 0;
      const raw = mr.raw_traffic_data || {};
      const gbpTotal = Number(raw.total_clicks ?? mr.estimated_clicks ?? mr.volume) || 0;
      const gbpDays = Math.max(1, Number(raw.reporting_days ?? raw.daysElapsed) || 1);
      const dailyFromGbp =
        Number(mr.daily_traffic) ||
        (gbpTotal > 0 ? Math.round((gbpTotal / gbpDays) * 10) / 10 : 0);
      const nKey = normKw(kw);
      kwPointCounter[nKey] = (kwPointCounter[nKey] || 0) + 1;
      
      const point = {
        xKey: `${timestamp || ''}__${kwPointCounter[nKey]}`,
        timestamp,
        rank: mr.rank || 21,
        volume,
        month,
        targetKeyword: mr.target_keyword || kw,
        clicks: Math.round(mr.estimated_clicks || gbpTotal || 0),
        dailyClicks: dailyFromGbp || dailyFromMonth || (Math.round((mr.estimated_clicks || 0) / 30 * 10) / 10)
      };

      if (!keywordHistoryMap[kw]) keywordHistoryMap[kw] = [];
      keywordHistoryMap[kw].push(point);
      
      tableData.push({
        ...point,
        keyword: kw,
        date: new Date(timestamp).toLocaleDateString(),
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });
  });

  Object.keys(keywordHistoryMap).forEach(kw => {
    keywordHistoryMap[kw].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.xKey).localeCompare(String(b.xKey));
    });
  });

  tableData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const uniqueKeywords = Object.keys(keywordHistoryMap).sort();

  if (uniqueKeywords.length === 0) {
    return (
      <div className="mt-8 p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Waiting for keyword traffic data synchronization…</p>
      </div>
    );
  }

  const filterOptions = useMemo(() => uniqueKeywords.map((k) => ({ value: k, label: k })), [uniqueKeywords]);

  useEffect(() => {
    if (!keywordFilter && uniqueKeywords.length) setKeywordFilter(uniqueKeywords[0]);
  }, [keywordFilter, uniqueKeywords]);

  const selectedKw = keywordFilter || uniqueKeywords[0];
  const selectedSeries = keywordHistoryMap[selectedKw] || [];
  const latestPoint = selectedSeries.length ? selectedSeries[selectedSeries.length - 1] : null;

  return (
    <div className="w-full space-y-12">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Keyword Performance History
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase tracking-widest font-black italic border border-slate-200">
                Demand Metrics
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              Historical search volume and ranking trends for target queries
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Filter by search query</span>
            <CustomDropdown value={selectedKw} options={filterOptions} onChange={setKeywordFilter} />
          </div>
        </div>

        {latestPoint && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-slate-300">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Reporting Period</div>
              <div className="text-2xl font-black text-slate-900">{latestPoint.month || 'N/A'}</div>
            </div>
            <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Monthly Volume</div>
              <div className="text-2xl font-black text-emerald-600">{Number(latestPoint.volume || 0).toLocaleString()}</div>
            </div>
            <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Estimated Daily Avg</div>
              <div className="text-2xl font-black text-blue-600">{Number(latestPoint.dailyClicks || 0).toLocaleString()}</div>
            </div>
          </div>
        )}

        <div className="rounded-[2rem] sm:rounded-[2.5rem] bg-white border border-slate-200/60 p-4 sm:p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden group">
          <div className="relative h-[300px] sm:h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedSeries} margin={{ left: 0, right: 10, top: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="xKey" hide />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#64748b', fontWeight: 800, dx: -5 }} 
                  width={40}
                />
                <Tooltip
                  content={<CustomTooltip isKeyword />}
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ zIndex: 100 }}
                />
                <Line
                  type="monotone"
                  dataKey="dailyClicks"
                  stroke="#10b981"
                  strokeWidth={4}
                  dot={{ r: 0 }}
                  activeDot={{ r: 8, fill: '#fff', strokeWidth: 4, stroke: '#10b981' }}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Traffic & Demand Audit Log
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase tracking-widest font-black italic border border-slate-200">
              Raw Forensic Data
            </span>
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
            Detailed breakdown of historical ranking snapshots and traffic estimations
          </p>
        </div>

        <div className="overflow-hidden bg-white border border-slate-200/60 rounded-[2.5rem] shadow-xl shadow-slate-200/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Snapshot</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Query Context</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic text-center">Source</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic text-center">Rank</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic text-right">Volume</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic text-right">Traffic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tableData.map((row, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/80 transition-all duration-300 cursor-default">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900">{row.date}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{row.time}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-black text-slate-900 capitalize tracking-tight group-hover:text-emerald-700 transition-colors">{row.keyword}</span>
                        <span className="text-[10px] font-bold text-slate-400 line-clamp-1">{row.targetKeyword}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="inline-flex px-3 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200 group-hover:bg-white transition-colors">
                        {row.month}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-xl text-xs font-black ring-1 ${
                          row.rank <= 3 
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' 
                            : 'bg-slate-50 text-slate-600 ring-slate-200'
                        }`}>
                          #{row.rank > 20 ? '20+' : row.rank}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className="text-sm font-black text-slate-900">{row.volume.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className="inline-flex px-4 py-2 rounded-2xl bg-blue-50 text-blue-700 text-sm font-black border border-blue-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                        {row.dailyClicks.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
