import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiUrl } from '../apiBase';
import Layout from '../components/Layout';
import DashboardSidebar from '../components/DashboardSidebar';
import CenteredLoader from '../components/CenteredLoader';
import Pagination from '../components/Pagination';

function PageLoader() {
  return (
    <div className="absolute inset-0 z-[50] flex items-center justify-center bg-white/70 backdrop-blur-md px-6 min-h-[400px] rounded-3xl">
      <CenteredLoader message="Loading rank history..." />
    </div>
  );
}

const pageStyles = `
  @keyframes rh-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes rh-row-in {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .rh-animate-fade-up { animation: rh-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .rh-animate-row { animation: rh-row-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
`;

// --- Custom UI Components ---

function CustomDropdown({ label, value, options, onChange, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 transition-all hover:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
      >
        <span className="min-w-0 text-left leading-tight py-1">{selectedOption?.label}</span>
        <svg className={`ml-2 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl rh-animate-fade-up">
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center px-4 py-2.5 text-left text-sm font-bold transition-colors ${
                  value === opt.value 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GmbRankHistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filter & Sort State
  const [search, setSearch] = useState('');
  const [gmbFilter, setGmbFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest, a-z, z-a

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl('/api/tracking/all-rows'));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'We could not load tracking data right now.');
        if (!cancelled) setRows(data.rows || []);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'We could not load tracking data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived unique GMBs for filter
  const uniqueGmbs = useMemo(() => {
    const names = new Set();
    rows.forEach(r => { if (r.businessName) names.add(r.businessName); });
    return Array.from(names).sort();
  }, [rows]);

  const gmbOptions = useMemo(() => [
    { label: 'All Accounts', value: 'all' },
    ...uniqueGmbs.map(name => ({ label: name, value: name }))
  ], [uniqueGmbs]);

  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Oldest First', value: 'oldest' },
    { label: 'Name (A-Z)', value: 'a-z' },
    { label: 'Name (Z-A)', value: 'z-a' },
  ];

  // Process Rows (Filter -> Sort -> Page)
  const processedRows = useMemo(() => {
    // 1. Group by Keyword (and Business)
    const groups = new Map();
    rows.forEach(r => {
      const key = `${r.businessName}||${r.keyword}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    const comparisonRows = [];
    groups.forEach((groupRows) => {
      // Sort each group by saved date descending
      const sorted = [...groupRows].sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
      const latest = sorted[0];
      const previous = sorted[1] || null;
      comparisonRows.push({
        ...latest,
        prevRank: previous ? previous.rank : null,
        prevSavedAt: previous ? previous.savedAt : null,
        prevGalleryUrl: previous ? previous.galleryUrl : null,
        prevScreenshotUrl: previous ? previous.screenshotUrl : null
      });
    });

    let filtered = [...comparisonRows];

    // 2. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r => 
        (r.businessName || '').toLowerCase().includes(q) || 
        (r.keyword || '').toLowerCase().includes(q)
      );
    }

    // 3. GMB Filter
    if (gmbFilter !== 'all') {
      filtered = filtered.filter(r => r.businessName === gmbFilter);
    }

    // 4. Sort
    filtered.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.savedAt || 0) - new Date(a.savedAt || 0);
      if (sortOrder === 'oldest') return new Date(a.savedAt || 0) - new Date(b.savedAt || 0);
      if (sortOrder === 'a-z') return (a.businessName || '').localeCompare(b.businessName || '');
      if (sortOrder === 'z-a') return (b.businessName || '').localeCompare(a.businessName || '');
      return 0;
    });

    return filtered;
  }, [rows, search, gmbFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <Layout
      pageTitle="Rank History Tracker"
      sidebar={
        <DashboardSidebar
          activeTab="tracker"
          showHistory={false}
          onReportArchive={() => navigate('/?tab=ranking&view=archive')}
          onNewRankingAnalysis={() => navigate('/?tab=ranking')}
          showNewRankingButton={false}
        />
      }
    >
      <style>{pageStyles}</style>

      {loading && <PageLoader />}

      {/* Control Bar */}
      <div className="mb-6 rh-animate-fade-up flex flex-col gap-4 md:flex-row md:items-end md:justify-end relative z-40">
        <div className="flex-1 max-w-md relative">
          <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1">Search Keywords / GMB</label>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search history..."
              className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 pl-9 text-sm font-bold text-slate-800 transition-all focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <CustomDropdown
          label="Filter Account"
          value={gmbFilter}
          options={gmbOptions}
          onChange={(val) => { setGmbFilter(val); setPage(1); }}
          className="w-full md:w-56"
        />

        <CustomDropdown
          label="Sort By"
          value={sortOrder}
          options={sortOptions}
          onChange={(val) => { setSortOrder(val); setPage(1); }}
          className="w-full md:w-40"
        />
      </div>

      <div className="rh-animate-fade-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)]">
        <div className="min-h-[280px] space-y-6 bg-white p-0 sm:p-0">
          {!loading && processedRows.length === 0 ? (
            <div className="m-8 rh-animate-fade-up rounded-2xl border border-brand-mint bg-white/90 p-8 text-center shadow-sm">
              <p className="mb-2 font-semibold text-brand-pine">No matching data found</p>
              <p className="mx-auto max-w-md text-sm text-brand-muted">
                Try adjusting your search or filter settings.
              </p>
            </div>
          ) : !loading ? (
            <div className="space-y-0">
              {/* Desktop Table */}
              <div className="overflow-x-auto table-scrollbar">
                <table className="min-w-full text-left text-sm border-collapse">
                  <thead className="sticky top-0 z-10 border-b border-slate-800">
                    <tr style={{ background: '#0f172a' }}>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest first:rounded-tl-2xl whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                          <span className="text-slate-200">Keyword</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V19.875c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                          </svg>
                          <span className="text-slate-200">Prev Rank</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V19.875c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                          </svg>
                          <span className="text-slate-200">Latest Rank</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                          </svg>
                          <span className="text-slate-200">Growth Strategy</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center last:rounded-tr-2xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          <span className="text-slate-200">Visual Proof</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedRows.map((row, i) => {
                      const isImproved = row.prevRank != null && row.rank != null && Number(row.rank) < Number(row.prevRank);
                      const isDropped = row.prevRank != null && row.rank != null && Number(row.rank) > Number(row.prevRank);
                      const isSame = row.prevRank != null && row.rank != null && Number(row.rank) === Number(row.prevRank);

                      let actionMsg = "Baseline established. Keep tracking.";
                      let actionColor = "text-slate-500 bg-slate-50 border-slate-100";
                      
                      if (isImproved) {
                        actionMsg = "Great work! Keep it up!";
                        actionColor = "text-emerald-700 bg-emerald-50 border-emerald-100";
                      } else if (isDropped) {
                        actionMsg = "Needs attention! Review strategy.";
                        actionColor = "text-rose-700 bg-rose-50 border-rose-100";
                      } else if (isSame) {
                        actionMsg = "Stable performance. Good momentum.";
                        actionColor = "text-blue-700 bg-blue-50 border-blue-100";
                      }
                      
                      return (
                        <tr
                          key={`${row.gmbKey}-${row.savedAt}-${row.keyword}-${i}`}
                          className="group cursor-pointer transition-all duration-300"
                          style={{ animationDelay: `${i * 0.02}s` }}
                        >
                          <td className="px-5 py-3 border-l-4 border-transparent group-hover:border-emerald-500 transition-all duration-300">
                            <span className="text-sm font-bold text-slate-600">{row.keyword}</span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="text-xs font-black text-slate-300 tabular-nums">
                              {row.prevRank != null ? `#${row.prevRank}` : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-black tabular-nums border ${
                                row.rank != null ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                              }`}>
                                {row.rank != null ? `#${row.rank}` : 'N/A'}
                              </span>
                              {isImproved && (
                                <svg className="w-3.5 h-3.5 text-emerald-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                </svg>
                              )}
                              {isDropped && (
                                <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                             <div className={`inline-block px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-tight ${actionColor}`}>
                               {actionMsg}
                             </div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {row.prevGalleryUrl && (
                                <a
                                  href={row.prevGalleryUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
                                >
                                  Old Gallery
                                </a>
                              )}
                              {row.galleryUrl && (
                                <a
                                  href={row.galleryUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                >
                                  New Gallery
                                </a>
                              )}
                              {!row.galleryUrl && !row.prevGalleryUrl && (
                                <span className="text-[9px] font-bold text-slate-300">No Gallery</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>



              {/* Advanced Pagination */}
              <div className="border-t border-slate-100 bg-white px-4 py-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center sm:text-left">
                    Showing {processedRows.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, processedRows.length)} of {processedRows.length} results
                  </p>
                  <Pagination 
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
