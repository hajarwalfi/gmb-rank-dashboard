import React, { useEffect, useState, useMemo } from 'react';
import { apiUrl, outputsAssetUrl } from '../apiBase';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import CenteredLoader from '../components/CenteredLoader';

const PAGE_SIZE = 10;

function RankModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl overflow-hidden transition-all transform scale-100 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 flex-shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{data.keyword}</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">{data.business_name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors text-sm">✕</button>
        </div>
        <div className="p-4 bg-slate-50 overflow-y-auto flex-grow table-scrollbar">
          {data.screenshot_url ? (
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-white">
              <img src={outputsAssetUrl(data.screenshot_url)} alt="Rank Proof" className="w-full h-auto object-contain" />
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No screenshot available for this scan</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-white border-t border-slate-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-5">
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Current Rank</p>
              <p className="text-lg font-black text-slate-900">#{data.rank || '—'}</p>
            </div>
            <div className="w-px h-6 bg-slate-100" />
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Previous Rank</p>
              <p className="text-lg font-black text-slate-500">#{data.prevRank || '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function GmbNotificationsPage() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [activeRankData, setActiveRankData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const gbpMonthlyTotalFromRow = (row) => {
    const raw = row?.raw_traffic_data || {};
    const t = Number(raw.total_clicks ?? row?.estimated_clicks ?? row?.volume);
    return Number.isFinite(t) ? t : 0;
  };

  const gbpReportingDaysFromRow = (row) => {
    const raw = row?.raw_traffic_data || {};
    const d = Number(raw.reporting_days ?? raw.daysElapsed);
    return d > 0 ? d : 1;
  };

  const gbpDailyAvgFromRow = (row) => {
    if (!row) return 0;
    if (Number.isFinite(Number(row.daily_traffic))) return Number(row.daily_traffic);
    const tot = gbpMonthlyTotalFromRow(row);
    const days = gbpReportingDaysFromRow(row);
    return Math.round((tot / days) * 10) / 10;
  };

  const latestDayTotalFromRow = (row) => {
    const raw = row?.raw_traffic_data || {};
    const first = Array.isArray(raw.daily_breakdown_desc) && raw.daily_breakdown_desc.length
      ? raw.daily_breakdown_desc[0]
      : null;
    if (!first) return 0;
    return (
      Number(first.calls || 0) +
      Number(first.chat_clicks || 0) +
      Number(first.website_clicks || 0)
    );
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/history/all'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load notifications');

      const flatRows = [];
      (data.businesses || []).forEach(b => {
        const latest = b.latest_scan;
        const prev = b.previous_scan;

        const latestRanks = Array.isArray(latest?.map_ranks) ? latest.map_ranks : [];
        const prevRanksMap = new Map();
        if (prev && Array.isArray(prev.map_ranks)) {
          prev.map_ranks.forEach(r => prevRanksMap.set(r.keyword, r));
        }

        latestRanks.forEach(r => {
          const pr = prevRanksMap.get(r.keyword);

          const dailyTraffic = gbpDailyAvgFromRow(r);
          const prevDailyTraffic = gbpDailyAvgFromRow(pr);

          // Only include if something actually changed
          const rankChanged = r.rank !== pr?.rank;
          const reviewsChanged = (latest?.reviews?.total_count || 0) !== (prev?.reviews?.total_count || 0);
          const trafficChanged = Math.abs(dailyTraffic - prevDailyTraffic) >= 0.1;

          if (rankChanged || reviewsChanged || trafficChanged) {
            flatRows.push({
              id: `${b.business_id}-${r.keyword}`,
              business_name: b.business_name,
              location: b.location,
              keyword: r.keyword,

              rank: r.rank,
              prevRank: pr?.rank,
              screenshot_url: r.screenshot_url,

              daily_traffic: dailyTraffic,
              prev_daily_traffic: prevDailyTraffic,
              volume: r.volume || 0,
              monthly_gbp_clicks: gbpMonthlyTotalFromRow(r),
              latest_day_total: latestDayTotalFromRow(r),
              reporting_days: gbpReportingDaysFromRow(r),
              source_month: r.source_month,
              raw_traffic_data: r.raw_traffic_data || null,

              reviews_count: latest?.reviews?.total_count || 0,
              prev_reviews_count: prev?.reviews?.total_count || 0,

              suggestion: getSuggestionForKeyword({
                rank: r.rank,
                prevRank: pr?.rank,
                traffic: dailyTraffic,
                prevTraffic: prevDailyTraffic,
                reviews: latest?.reviews?.total_count || 0,
                prevReviews: prev?.reviews?.total_count || 0
              })
            });
          }
        });
      });

      setBusinesses(flatRows);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getSuggestionForKeyword = (data) => {
    const { rank, prevRank, traffic, prevTraffic, reviews, prevReviews } = data;
    const rankDelta = (rank || 0) - (prevRank || 0);
    const trafficPct = prevTraffic > 0 ? ((traffic - prevTraffic) / prevTraffic) * 100 : 0;
    const reviewsDelta = (reviews || 0) - (prevReviews || 0);

    let messages = [];

    // Rank Logic
    if (rankDelta > 0) messages.push("Ranking dropped slightly.");
    else if (rankDelta < 0) messages.push("Ranking improved significantly.");

    // Traffic Logic
    if (trafficPct < -20) messages.push(`Traffic down by ${Math.abs(Math.round(trafficPct))}%! Need more engagement.`);
    else if (trafficPct > 20) messages.push("Traffic is surging! Keep it up.");

    // Reviews Logic
    if (reviewsDelta < 0) messages.push(`${Math.abs(reviewsDelta)} reviews were removed/hidden.`);
    else if (reviewsDelta > 0) messages.push("Gained new reviews. Reputation is growing.");

    // Fallback if nothing changed
    if (messages.length === 0) {
      if (rank <= 3) return "Top placement. Maintain consistency.";
      if (rank > 10) return "Not in Top 10. Focus on relevance.";
      return "Performance is stable. Monitor weekly trends.";
    }

    return messages.join(" ");
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return businesses;
    const s = searchTerm.toLowerCase();
    return businesses.filter(b =>
      b.business_name?.toLowerCase().includes(s) ||
      b.keyword?.toLowerCase().includes(s)
    );
  }, [businesses, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const renderDelta = (now, old, type = 'absolute', isRank = false) => {
    if (old === undefined || old === null) return null;
    const nv = Number(now) || 0;
    const ov = Number(old) || 0;
    const diff = nv - ov;

    if (type === 'percent') {
      if (ov === 0) return nv > 0 ? <span className="text-emerald-500 text-[10px] ml-1.5">(+100%)</span> : <span className="text-slate-400 text-[10px] ml-1.5">(+0%)</span>;
      const pct = Math.round((diff / ov) * 100);
      return (
        <span className={`${pct > 0 ? 'text-emerald-500' : pct < 0 ? 'text-rose-500' : 'text-slate-400'} text-[10px] ml-1.5 font-black`}>
          ({pct >= 0 ? '+' : ''}{pct}%)
        </span>
      );
    } else {
      let colorClass = 'text-slate-400';
      if (isRank) {
        if (diff < 0) colorClass = 'text-emerald-500';
        else if (diff > 0) colorClass = 'text-rose-500';
      } else {
        if (diff > 0) colorClass = 'text-emerald-500';
        else if (diff < 0) colorClass = 'text-rose-500';
      }

      return (
        <span className={`${colorClass} text-[10px] ml-1.5 font-black`}>
          ({diff > 0 ? '+' : ''}{diff})
        </span>
      );
    }
  };

  if (loading) {
    return <CenteredLoader message="Loading dashboard metrics..." />;
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-in p-4 sm:p-8 min-h-screen bg-slate-50/30">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl shadow-slate-200">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Notifications</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1.5">Keyword-Level Insights & Performance</p>
            </div>
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl px-12 py-3.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 shadow-sm transition-all"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" strokeLinecap="round" /></svg>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-left min-w-[1000px]">
            <thead>
              <tr style={{ background: '#0f172a' }}>
                <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">Keyword / Entity</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Current Rank</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest min-w-[200px]">
                  GBP traffic
                </th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Reviews</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-300 uppercase tracking-widest">Strategy Suggestion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Notifications data found</p>
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider mb-1">{row.keyword}</span>
                        <span className="text-sm font-black text-slate-900 leading-tight">{row.business_name}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{row.location}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <button
                        onClick={() => setActiveRankData(row)}
                        className="flex items-center justify-center mx-auto hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-all"
                      >
                        <span className="text-sm font-black text-slate-900">{row.rank || '—'}</span>
                        {renderDelta(row.rank, row.prevRank, 'absolute', true)}
                      </button>
                    </td>
                    <td className="px-6 py-6 text-center align-top">
                      <div className="mx-auto max-w-[220px] text-left space-y-2">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Latest day total</p>
                          <span className="text-sm font-black text-slate-900 tabular-nums">
                            {row.latest_day_total ?? 0}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex items-center justify-center">
                        <span className="text-sm font-black text-slate-800">{row.reviews_count}</span>
                        {renderDelta(row.reviews_count, row.prev_reviews_count, 'absolute')}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0" />
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed max-w-xs">{row.suggestion}</p>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-50 bg-white px-8 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} Keywords
            </p>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      <RankModal
        isOpen={Boolean(activeRankData)}
        onClose={() => setActiveRankData(null)}
        data={activeRankData}
      />
    </div>
  );
}
