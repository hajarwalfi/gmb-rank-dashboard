import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IoCall, IoChatboxEllipsesOutline } from 'react-icons/io5';
import { AiOutlineGlobal } from 'react-icons/ai';
import { apiUrl } from '../apiBase';
import GmbHistoryDetailPage from './GmbHistoryDetailPage';
import CenteredLoader from '../components/CenteredLoader';
import Pagination from '../components/Pagination';

const HISTORY_VIEW_DEFAULT = 'analysis-results';
const PAGE_SIZE = 10;

function LoadingDots() {
  return (
    <div className="bouncing-dots">
      <span />
      <span />
      <span />
    </div>
  );
}

function TrendBadge({ value, mode = 'percent' }) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return (
      <div className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-black text-slate-400">
        +0
      </div>
    );
  }

  const isPositive = num > 0;
  const valueText = mode === 'percent'
    ? `${Math.abs(num).toFixed(1)}%`
    : `${isPositive ? '+' : ''}${Math.round(num)}`;

  return (
    <div className={`ml-2 inline-flex items-center gap-0.5 text-[10px] font-black ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
      <svg className={`h-3 w-3 ${!isPositive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
      {valueText}
    </div>
  );
}

function updateHistoryUrl(navigate, location, nextId) {
  const params = new URLSearchParams(location.search || '');
  params.set('tab', 'history');
  params.set('view', 'analysis-results');
  if (nextId) {
    params.set('id', nextId);
  } else {
    params.delete('id');
  }
  navigate(`/?${params.toString()}`);
}

export default function GmbHistoryListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [businesses, setBusinesses] = useState([]);
  const [metricsByBusiness, setMetricsByBusiness] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(apiUrl('/api/history/all'));
        if (!res.ok) throw new Error('Failed to fetch summary');
        const data = await res.json();
        setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');

  const rows = useMemo(() => {
    return [...businesses]
      .filter((biz) =>
        String(biz?.business_name || biz?.business_id || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
      .sort((a, b) =>
        String(a?.business_name || a?.business_id || '').localeCompare(String(b?.business_name || b?.business_id || ''))
      );
  }, [businesses, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const calcAvgRank = (scan) => {
    const ranks = Array.isArray(scan?.map_ranks) ? scan.map_ranks.map(r => Number(r.rank)).filter(n => !isNaN(n) && n > 0) : [];
    if (!ranks.length) return 0;
    return ranks.reduce((a, b) => a + b, 0) / ranks.length;
  };

  const calcTraffic = (scan) => {
    const keywords = Array.isArray(scan?.map_ranks) ? scan.map_ranks : [];
    if (!keywords.length) return 0;
    const total = keywords.reduce((sum, row) => {
      const raw = row?.raw_traffic_data || {};
      const latest = Array.isArray(raw.daily_breakdown_desc) ? raw.daily_breakdown_desc[0] : null;
      return sum + (Number(latest?.overview ?? 0) || 0);
    }, 0);
    return keywords.length ? total / keywords.length : 0;
  };

  const calcLatestDailyAvg = (scan, metricKey) => {
    const keywords = Array.isArray(scan?.map_ranks) ? scan.map_ranks : [];
    if (!keywords.length) return 0;
    const total = keywords.reduce((sum, row) => {
      const raw = row?.raw_traffic_data || {};
      const latest = Array.isArray(raw.daily_breakdown_desc) ? raw.daily_breakdown_desc[0] : null;
      return sum + (Number(latest?.[metricKey] ?? 0) || 0);
    }, 0);
    return total / keywords.length;
  };

  useEffect(() => {
    if (!pagedRows.length) return;
    let cancelled = false;

    const missing = pagedRows.filter((biz) => {
      const id = String(biz?.business_id || '').trim();
      return id && !metricsByBusiness[id];
    });
    if (!missing.length) return;

    (async () => {
      const results = await Promise.all(
        missing.map(async (biz) => {
          const id = String(biz?.business_id || '').trim();
          if (!id) return [id, null];
          try {
            const res = await fetch(apiUrl(`/api/history/${encodeURIComponent(id)}`));
            const json = await res.json().catch(() => ({}));
            if (!res.ok) return [id, null];
            const scans = Array.isArray(json?.data?.scans) ? json.data.scans : [];
            const sorted = [...scans]
              .filter((s) => s?.scanned_at)
              .sort((a, b) => new Date(b.scanned_at || 0) - new Date(a.scanned_at || 0))
              .slice(0, 2);
            
            if (!sorted.length) {
              return [id, {
                rank: 0, review: 0, traffic: 0, calls: 0, chat: 0, website: 0,
                dRank: 0, dReview: 0, dTraffic: 0, dCalls: 0, dChat: 0, dWebsite: 0
              }];
            }

            const m = sorted.map(s => ({
              rank: calcAvgRank(s),
              review: Number(s?.reviews?.total_count || 0),
              traffic: calcTraffic(s),
              calls: calcLatestDailyAvg(s, 'calls'),
              chat: calcLatestDailyAvg(s, 'chat_clicks'),
              website: calcLatestDailyAvg(s, 'website_clicks'),
            }));

            const cur = m[0];
            const prev = m[1] || null;

            const final = {
              rank: cur.rank,
              review: cur.review,
              traffic: cur.traffic,
              calls: cur.calls,
              chat: cur.chat,
              website: cur.website,
              dRank: prev && prev.rank !== 0 ? ((prev.rank - cur.rank) / prev.rank) * 100 : 0,
              dReview: prev && prev.review !== 0 ? ((cur.review - prev.review) / prev.review) * 100 : 0,
              dTraffic: cur.traffic - (prev?.traffic || 0),
              dCalls: cur.calls - (prev?.calls || 0),
              dChat: cur.chat - (prev?.chat || 0),
              dWebsite: cur.website - (prev?.website || 0),
            };

            return [id, final];
          } catch {
            return [id, null];
          }
        })
      );
      if (cancelled) return;
      setMetricsByBusiness((prev) => {
        const next = { ...prev };
        results.forEach(([id, data]) => {
          if (!id || !data) return;
          next[id] = data;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [pagedRows, metricsByBusiness]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const currentView = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return String(params.get('view') || HISTORY_VIEW_DEFAULT).trim() || HISTORY_VIEW_DEFAULT;
  }, [location.search]);

  const selectedId = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return String(params.get('id') || '').trim();
  }, [location.search]);

  const handleRowOpen = (businessId) => {
    const id = String(businessId || '').trim();
    if (!id) return;
    updateHistoryUrl(navigate, location, id, 'analysis-results');
  };

  if (selectedId) {
    return (
      <GmbHistoryDetailPage
        businessId={selectedId}
        onBack={() => updateHistoryUrl(navigate, location, '', 'analysis-results')}
      />
    );
  }

  return (
    <section className="space-y-4">
      {/* Search Bar - Positioned Right on Desktop, Full on Mobile */}
      <div className="flex justify-end">
        <div className="flex w-full sm:w-72 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search Business..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_30px_-15px_rgba(15,23,42,0.2)] overflow-hidden">
        {loading ? (
          <CenteredLoader message="Loading analysis results..." />
        ) : error ? (
          <div className="p-6">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center font-medium shadow-sm text-red-700">
              {error}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No tracking history found yet. Data will appear after the first scan.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto table-scrollbar">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-800">
                  <tr style={{ background: '#0f172a' }}>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-left whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <span className="text-slate-200">Account Name</span>
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        <span className="text-slate-200">Scans</span>
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V19.875c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                        <span className="text-slate-200">Avg Rank</span>
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                        <span className="text-slate-200">Reviews</span>
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.5 4.5L21.75 7.5M21.75 7.5V12m0-4.5H17.25" />
                        </svg>
                        <span className="text-slate-200">Avg Traffic</span>
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <IoCall className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span className="text-slate-200">Avg Calls</span>
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <IoChatboxEllipsesOutline className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span className="text-slate-200">Avg Chat</span>
                      </div>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <AiOutlineGlobal className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span className="text-slate-200">Avg Website</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 bg-white/50">
                  {pagedRows.map((biz) => {
                    const businessId = String(biz?.business_id || '').trim();
                    const stats = metricsByBusiness[businessId];
                    return (
                      <tr
                        key={String(biz.business_id || '')}
                        className="group cursor-pointer transition-all duration-300"
                        onClick={() => handleRowOpen(biz.business_id)}
                      >
                        <td className="px-4 sm:px-6 py-4 font-bold text-slate-800 align-middle min-w-[200px] text-left transition-all border-l-4 border-transparent group-hover:border-emerald-500 duration-300 group-hover:text-brand-forest">
                          <p className="leading-snug text-xs sm:text-sm">{biz.business_name || biz.business_id}</p>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-center align-middle">
                          <span className="inline-flex min-w-[30px] justify-center rounded-lg bg-slate-100 group-hover:bg-emerald-100/50 px-2 py-0.5 text-xs font-black text-slate-700 tabular-nums transition-colors">
                            {biz.total_scans ?? 0}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-black text-slate-700">
                              {stats ? `#${stats.rank.toFixed(1)}` : <LoadingDots />}
                            </span>
                            {stats && <TrendBadge value={stats.dRank} mode="percent" />}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-black text-slate-700">
                              {stats ? Math.round(stats.review).toLocaleString() : <LoadingDots />}
                            </span>
                            {stats && <TrendBadge value={stats.dReview} mode="percent" />}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-black text-emerald-600">
                              {stats ? Math.round(stats.traffic).toLocaleString() : <LoadingDots />}
                            </span>
                            {stats && <TrendBadge value={stats.dTraffic} mode="absolute" />}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-black text-indigo-600">
                              {stats ? Math.round(stats.calls).toLocaleString() : <LoadingDots />}
                            </span>
                            {stats && <TrendBadge value={stats.dCalls} mode="absolute" />}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-black text-cyan-600">
                              {stats ? Math.round(stats.chat).toLocaleString() : <LoadingDots />}
                            </span>
                            {stats && <TrendBadge value={stats.dChat} mode="absolute" />}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-black text-violet-600">
                              {stats ? Math.round(stats.website).toLocaleString() : <LoadingDots />}
                            </span>
                            {stats && <TrendBadge value={stats.dWebsite} mode="absolute" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest text-[10px]">
                  Showing {rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} results
                </p>
                <Pagination 
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
