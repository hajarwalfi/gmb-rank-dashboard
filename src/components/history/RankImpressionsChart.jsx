import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const CTR_TABLE = {
  1: 0.30,
  2: 0.18,
  3: 0.12,
  4: 0.08,
  5: 0.06,
  6: 0.04,
  7: 0.03,
  8: 0.02,
  9: 0.015,
  10: 0.01,
};

function daysFromSourceMonth(sourceMonth) {
  const s = String(sourceMonth || '').trim();
  if (!s || s === 'N/A') return 30;
  const [m, y] = s.split('/').map((x) => Number(x));
  if (!m || !y) return 30;
  return new Date(y, m, 0).getDate();
}

function ctrForRank(rank) {
  const r = Number(rank) || 0;
  return CTR_TABLE[r] || 0;
}

function avgLastTwo(points, key) {
  const take = (points || []).slice(-2);
  if (!take.length) return 0;
  const total = take.reduce((sum, p) => sum + Number(p?.[key] || 0), 0);
  return total / take.length;
}

function increaseFromLastTwo(points, key) {
  const take = (points || []).slice(-2);
  if (take.length < 2) return 0;
  const diff = Number(take[1]?.[key] || 0) - Number(take[0]?.[key] || 0);
  return diff > 0 ? diff : 0;
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
        <span className="min-w-0 text-left leading-tight py-1">{selected?.label || 'Select…'}</span>
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
          <div className="max-h-72 overflow-auto py-1">
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

const TooltipBox = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload || {};
  return (
    <div className="bg-white p-4 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-2xl z-[9999] min-w-[240px] pointer-events-none ring-1 ring-slate-900/5">
      <div className="flex flex-col mb-3 pb-2 border-b border-slate-50">
        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Snapshot Date</span>
        <span className="text-xs font-bold text-slate-900">{new Date(p.timestamp).toLocaleString()}</span>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Global Rank</span>
          <span className="text-sm font-black text-slate-900">#{p.rank ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">CTR Performance</span>
          <span className="text-sm font-black text-emerald-600">
            {((p.ctr || 0) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Daily Impressions</span>
          <span className="text-sm font-black text-slate-900">{Math.round(Number(p.daily_search_volume || 0)).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Estimated Clicks</span>
          <span className="text-sm font-black text-blue-600">{Math.round(Number(p.estimated_daily_clicks || 0)).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

const AllTooltipBox = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const dateLabel = Number.isFinite(Number(label)) ? new Date(Number(label)).toLocaleString() : '-';
  const total = payload.reduce((sum, p) => sum + Number(p?.value || 0), 0);

  return (
    <div className="bg-white p-4 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-2xl z-[9999] min-w-[260px] pointer-events-none ring-1 ring-slate-900/5">
      <div className="mb-3 pb-2 border-b border-slate-50">
        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Snapshot Date</span>
        <p className="text-xs font-bold text-slate-900">{dateLabel}</p>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-auto pr-1 custom-scrollbar">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4 text-[10px]">
            <span className="font-bold text-slate-600 truncate max-w-[140px]">{item.name}</span>
            <span className="font-black text-emerald-600">{Math.round(Number(item.value || 0)).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Visits</span>
        <span className="text-sm font-black text-slate-900">{Math.round(total).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default function RankImpressionsChart({ scans }) {
  const keywords = useMemo(() => {
    const s = new Set();
    (scans || []).forEach((scan) => {
      (scan?.map_ranks || []).forEach((r) => {
        if (r?.keyword) s.add(r.keyword);
      });
    });
    return Array.from(s).sort();
  }, [scans]);

  const [kw, setKw] = useState('ALL');
  useEffect(() => {
    if (!kw && keywords.length) setKw('ALL');
  }, [kw, keywords]);

  const options = useMemo(
    () => [{ value: 'ALL', label: 'All Keywords Aggregated' }, ...keywords.map((k) => ({ value: k, label: k }))],
    [keywords]
  );

  const keywordSeriesMap = useMemo(() => {
    const map = {};
    const duplicateCounter = {};

    (scans || []).forEach((scan) => {
      const ts = scan?.scanned_at || '';
      const baseTime = new Date(ts).getTime();
      if (!Number.isFinite(baseTime)) return;

      (scan?.map_ranks || []).forEach((r) => {
        const keyword = r?.keyword;
        if (!keyword) return;

        const rank = Number(r.rank) || 0;
        const raw = r.raw_traffic_data || {};
        const useGbp =
          raw?.verification?.dataSource === 'google_business_profile_performance_api_v1' ||
          Number.isFinite(Number(raw.total_clicks));
        const gbpTotal = Number(raw.total_clicks ?? r.estimated_clicks ?? r.volume) || 0;
        const gbpDays = Math.max(1, Number(raw.reporting_days ?? raw.daysElapsed) || 1);
        const gbpDaily = Number(r.daily_traffic) || (gbpTotal > 0 ? Math.round((gbpTotal / gbpDays) * 10) / 10 : 0);
        const ctr = useGbp ? 0 : ctrForRank(rank);
        const sourceMonth = r.source_month || 'N/A';
        const vol = Number(r.volume) || 0;
        const dailySearch = useGbp
          ? gbpDaily
          : vol > 0
            ? vol / daysFromSourceMonth(sourceMonth)
            : Number(r.daily_traffic) || 0;

        const estDaily = useGbp ? gbpDaily : Math.round(dailySearch * ctr * 10) / 10;
        const estMonthly = useGbp ? gbpTotal : Math.round(vol * ctr);

        duplicateCounter[keyword] = (duplicateCounter[keyword] || 0) + 1;
        const x = baseTime + duplicateCounter[keyword];

        if (!map[keyword]) map[keyword] = [];
        map[keyword].push({
          x,
          timestamp: ts,
          rank,
          ctr,
          daily_search_volume: Math.round(dailySearch * 10) / 10,
          estimated_daily_clicks: estDaily,
          estimated_monthly_clicks: estMonthly,
          month_volume: vol,
        });
      });
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => a.x - b.x);
    });
    return map;
  }, [scans]);

  const keywordSummaries = useMemo(() => {
    const out = {};
    keywords.forEach((keyword) => {
      const points = keywordSeriesMap[keyword] || [];
      out[keyword] = {
        points,
        avgDaily: avgLastTwo(points, 'estimated_daily_clicks'),
        avgRank: avgLastTwo(points, 'rank'),
        avgCtr: avgLastTwo(points, 'ctr'),
        avgMonthly: avgLastTwo(points, 'estimated_monthly_clicks'),
        increaseDaily: increaseFromLastTwo(points, 'estimated_daily_clicks'),
      };
    });
    return out;
  }, [keywords, keywordSeriesMap]);

  const singleSeries = useMemo(() => {
    if (!kw || kw === 'ALL') return [];
    return keywordSeriesMap[kw] || [];
  }, [kw, keywordSeriesMap]);

  const allSeries = useMemo(() => {
    const byTime = new Map();
    keywords.forEach((keyword) => {
      (keywordSeriesMap[keyword] || []).forEach((p) => {
        const key = String(p.x);
        if (!byTime.has(key)) {
          byTime.set(key, { x: p.x, timestamp: p.timestamp });
        }
        byTime.get(key)[keyword] = Number(p.estimated_daily_clicks || 0);
      });
    });
    return Array.from(byTime.values()).sort((a, b) => a.x - b.x);
  }, [keywords, keywordSeriesMap]);

  const cardMetrics = useMemo(() => {
    if (kw && kw !== 'ALL') {
      const s = keywordSummaries[kw];
      if (!s) return null;
      return {
        daily: s.avgDaily,
        rank: s.avgRank,
        ctr: s.avgCtr,
        monthly: s.avgMonthly,
        increaseDaily: s.increaseDaily,
      };
    }

    const valid = keywords.map((k) => keywordSummaries[k]).filter(Boolean);
    if (!valid.length) return null;

    const totalDaily = valid.reduce((sum, item) => sum + item.avgDaily, 0);
    const totalMonthly = valid.reduce((sum, item) => sum + item.avgMonthly, 0);
    const avgRank = valid.reduce((sum, item) => sum + item.avgRank, 0) / valid.length;
    const avgCtr = valid.reduce((sum, item) => sum + item.avgCtr, 0) / valid.length;
    const increaseDaily = valid.reduce((sum, item) => sum + item.increaseDaily, 0);

    return {
      daily: totalDaily,
      rank: avgRank,
      ctr: avgCtr,
      monthly: totalMonthly,
      increaseDaily,
    };
  }, [kw, keywordSummaries, keywords]);

  const colorByKeyword = useMemo(() => {
    const palette = ['#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
    return keywords.reduce((acc, keyword, idx) => {
      acc[keyword] = palette[idx % palette.length];
      return acc;
    }, {});
  }, [keywords]);

  if (!keywords.length) {
    return (
      <div className="mt-8 p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Waiting for rank + volume data synchronization…</p>
      </div>
    );
  }

  const latest = cardMetrics;

  return (
    <div className="w-full space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Rank Impressions Analytics
            </h3>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase tracking-widest font-black italic border border-emerald-200">
              CTR MODEL v2.0
            </span>
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
            Aggregated performance metrics based on GMB search visibility
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Filter by search query</span>
          <CustomDropdown value={kw || 'ALL'} options={options} onChange={setKw} />
        </div>
      </div>

      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Est. Daily Clicks</div>
            <div className="text-3xl font-black text-slate-900">{Math.round(Number(latest.daily || 0)).toLocaleString()}</div>
            <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Across Last 2 Scans</div>
          </div>

          <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Average Rank</div>
            <div className="text-3xl font-black text-slate-900">#{latest.rank.toFixed(1)}</div>
            <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Across {keywords.length} keywords</div>
          </div>

          <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">CTR Performance</div>
            <div className="flex items-baseline gap-1">
              <div className="text-3xl font-black text-slate-900">{((Number(latest.ctr) || 0) * 100).toFixed(1)}%</div>
              <div className="text-xs font-bold text-slate-400">({Number(latest.ctr || 0).toFixed(3)})</div>
            </div>
            <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Standard Model</div>
          </div>

          <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-amber-200 hover:shadow-xl hover:shadow-amber-900/5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Est. Monthly Visits</div>
            <div className="text-3xl font-black text-slate-900">{Math.round(Number(latest.monthly || 0)).toLocaleString()}</div>
            <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Projected ROI</div>
          </div>
        </div>
      )}

      <div className="rounded-[2rem] sm:rounded-[2.5rem] bg-white border border-slate-200/60 p-4 sm:p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden group">
        <div className="relative h-[300px] sm:h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kw === 'ALL' ? allSeries : singleSeries} margin={{ left: 0, right: 10, top: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="x"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                hide
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: '#64748b', fontWeight: 800, dx: -5 }} 
                width={40}
              />
              <Tooltip
                content={kw === 'ALL' ? <AllTooltipBox /> : <TooltipBox />}
                cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ zIndex: 100 }}
              />
              {kw === 'ALL'
                ? keywords.map((keyword) => (
                    <Line
                      key={keyword}
                      type="monotone"
                      dataKey={keyword}
                      name={keyword}
                      stroke={colorByKeyword[keyword]}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 0, fill: colorByKeyword[keyword] }}
                      connectNulls
                      animationDuration={1500}
                    />
                  ))
                : (
                  <Line
                    type="monotone"
                    dataKey="estimated_daily_clicks"
                    stroke="#10b981"
                    strokeWidth={4}
                    dot={{ r: 0 }}
                    activeDot={{ r: 8, fill: '#fff', strokeWidth: 4, stroke: '#10b981' }}
                    animationDuration={1000}
                  />
                )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

