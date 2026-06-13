import React from 'react';
import DeltaBadge from './DeltaBadge';

export default function ScanTable({ scans }) {
  const sortedScans = [...scans].sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));
  const latest = sortedScans[0] || null;
  const prev = sortedScans[1] || null;

  if (!latest) return null;

  const calcTotalTraffic = (s) => {
    const rows = Array.isArray(s?.map_ranks) ? s.map_ranks : [];
    if (!rows.length) return 0;
    for (const row of rows) {
      const raw = row?.raw_traffic_data || {};
      const t = Number(raw.total_clicks ?? row?.estimated_clicks ?? row?.volume);
      if (Number.isFinite(t)) return t;
    }
    return 0;
  };

  const calcAvgRank = (s) => {
    const ranks = Array.isArray(s?.map_ranks) ? s.map_ranks.map(r => Number(r.rank)).filter(n => !isNaN(n) && n > 0) : [];
    if (!ranks.length) return 0;
    return ranks.reduce((a, b) => a + b, 0) / ranks.length;
  };

  // Latest Values
  const latT = calcTotalTraffic(latest);
  const latR = calcAvgRank(latest);
  const latRev = latest.reviews?.total_count || 0;

  // Previous Values
  const prevT = prev ? calcTotalTraffic(prev) : 0;
  const prevR = prev ? calcAvgRank(prev) : 0;
  const prevRev = prev ? (prev.reviews?.total_count || 0) : 0;

  // Deltas
  const trafficDiffPct = prevT > 0 ? (((latT - prevT) / prevT) * 100).toFixed(1) : '0';
  const rankDiff = prevR > 0 ? (prevR - latR).toFixed(1) : '0';
  const revDiff = latRev - prevRev;

  const dateObj = new Date(latest.scanned_at);
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const MetricCard = ({ title, value, oldValue, delta, type, icon }) => (
    <div className="relative overflow-hidden group bg-white rounded-[2rem] p-8 border border-slate-100 hover:border-emerald-200/50 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] transition-all duration-500">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</p>
          <h4 className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{value}</h4>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${type === 'positive' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {icon}
        </div>
      </div>
      
      <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
        <div className="flex flex-col">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Previous</p>
          <p className="text-sm font-bold text-slate-400 tabular-nums">{oldValue}</p>
        </div>
        <div className="h-8 w-[1px] bg-slate-100" />
        <div className="flex-1">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Net Change</p>
          <DeltaBadge 
            text={delta} 
            type={type} 
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Performance Audit</h3>
            <div className="px-3 py-1 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
              Scan Sync Active
            </div>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Comparison between {dateStr} • {timeStr} and Previous Snapshot
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Est. Daily Traffic"
          value={Math.round(latT).toLocaleString()}
          oldValue={Math.round(prevT).toLocaleString()}
          delta={`${Number(trafficDiffPct) >= 0 ? '↑' : '↓'} ${Math.abs(trafficDiffPct)}% Growth`}
          type={Number(trafficDiffPct) >= 0 ? 'positive' : 'negative'}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        
        <MetricCard 
          title="Review Reputation"
          value={latRev}
          oldValue={prevRev}
          delta={`${revDiff >= 0 ? '↑ +' : '↓ -'}${Math.abs(revDiff)} Reviews`}
          type={revDiff >= 0 ? 'positive' : 'negative'}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />

        <MetricCard 
          title="Search Rank Avg"
          value={`#${latR.toFixed(1)}`}
          oldValue={`#${prevR.toFixed(1)}`}
          delta={`${Number(rankDiff) >= 0 ? '↑ +' : '↓ '}${Math.abs(Number(rankDiff)).toFixed(1)} Rank Shift`}
          type={Number(rankDiff) >= 0 ? 'positive' : 'negative'}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-[100px]" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h4 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Audit Insight Summary</h4>
            <p className="text-slate-400 text-xs font-bold leading-relaxed max-w-xl">
              Based on the latest data compared to your previous snapshot, the business has seen a 
              <span className="text-emerald-400"> {Math.abs(trafficDiffPct)}% {Number(trafficDiffPct) >= 0 ? 'increase' : 'decrease'}</span> in estimated daily traffic. 
              Review volume is <span className={revDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{revDiff >= 0 ? 'growing' : 'declining'}</span> 
              and the average search rank has <span className={Number(rankDiff) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{Number(rankDiff) >= 0 ? 'improved' : 'dropped'}</span>.
            </p>
          </div>
          <div className="flex-shrink-0 px-8 py-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1">Growth Status</p>
            <p className="text-lg font-black text-white italic">
              {Number(trafficDiffPct) >= 0 ? 'Outperforming Baseline' : 'Under Review'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
