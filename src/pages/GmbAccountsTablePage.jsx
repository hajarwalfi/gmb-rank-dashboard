import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../apiBase';
import CenteredLoader from '../components/CenteredLoader';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;
const LOCAL_CACHE_KEY = 'gmb_keyword_counts_cache_v1';

function normalizeLocationIdShort(location) {
  const short = String(location?.locationIdShort || '').trim();
  if (short) return short;
  return String(location?.locationId || '').replace(/^locations\//, '');
}

function readLocalCache() {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.counts !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(counts) {
  try {
    localStorage.setItem(
      LOCAL_CACHE_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        counts,
      })
    );
  } catch {
    // ignore local cache errors
  }
}

export default function GmbAccountsTablePage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [keywordCounts, setKeywordCounts] = useState({});
  const [keywordSummary, setKeywordSummary] = useState(null);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const local = readLocalCache();
        if (!cancelled && local?.counts) {
          setKeywordCounts(local.counts);
        }

        const locRes = await fetch(apiUrl('/api/services-keywords?view=locations'));
        const locData = await locRes.json().catch(() => ({}));
        if (!locRes.ok || locData.ok === false) {
          throw new Error(locData.error || 'Failed to load services-keywords snapshot.');
        }

        const locList = Array.isArray(locData.locations) ? locData.locations : [];
        const countsFromServer = {};
        locList.forEach((loc) => {
          const lid = String(loc?.locationId || '').trim();
          const n = Number(loc?.keywordsCount ?? NaN);
          if (lid && Number.isFinite(n)) countsFromServer[lid] = n;
        });

        const summaryCompat =
          locData.summary && typeof locData.summary === 'object'
            ? {
                with_keywords_count:
                  typeof locData.summary.withKeywords === 'number'
                    ? locData.summary.withKeywords
                    : Number(locData.summary.with_keywords_count ?? 0),
                keywordsTotalSum:
                  typeof locData.summary.keywordsTotalSum === 'number' ? locData.summary.keywordsTotalSum : null,
                total_eligible:
                  typeof locData.summary.totalEligible === 'number' ? locData.summary.totalEligible : null,
                gmb_linked_count:
                  typeof locData.summary.gmbLinkedCount === 'number' ? locData.summary.gmbLinkedCount : null,
              }
            : null;

        if (!cancelled) {
          setLocations(locList);
          setKeywordSummary(summaryCompat);
          if (Object.keys(countsFromServer).length) {
            setKeywordCounts((prev) => {
              const merged = { ...prev, ...countsFromServer };
              writeLocalCache(merged);
              return merged;
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Unable to load account table.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');

  const rows = useMemo(() => {
    return [...locations]
      .map((loc) => {
        const locationId = String(loc?.locationId || '');
        const fromCache = keywordCounts[locationId] != null ? Number(keywordCounts[locationId]) : null;
        const fromLoc = Number(loc?.keywordsCount ?? NaN);
        const totalKeywords =
          fromCache != null && Number.isFinite(fromCache) ? fromCache : Number.isFinite(fromLoc) ? fromLoc : null;
        return {
          title: String(loc?.title || 'Untitled'),
          accountId: String(loc?.accountId || ''),
          locationId,
          locationIdShort: normalizeLocationIdShort(loc),
          totalKeywords,
        };
      })
      .filter((row) => {
        const n = row.totalKeywords;
        if (n == null || !Number.isFinite(n)) return false;
        return n >= 1;
      })
      .filter((row) => row.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [locations, keywordCounts, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (!locations.length && !loading) {
      setStatusText(
        'No accounts in services-keywords snapshot. Run: node server/scripts/rebuild-services-keywords.mjs (or POST /api/services-keywords/rebuild), then refresh.',
      );
      return;
    }
    if (!rows.length) {
      setStatusText(
        locations.length
          ? 'No accounts match the current filter (need at least 1 keyword in snapshot).'
          : '',
      );
      return;
    }
    const cacheKeys = Object.keys(keywordCounts).length;
    const wc = keywordSummary?.with_keywords_count;
    const kts = keywordSummary?.keywordsTotalSum;
    const tel = keywordSummary?.total_eligible;
    const linked = keywordSummary?.gmb_linked_count;
    const denom = typeof wc === 'number' && Number.isFinite(wc) ? wc : rows.length;

    let line = `Keyword counts available: ${cacheKeys}/${denom}`;
    if (typeof wc === 'number' && Number.isFinite(wc)) {
      line += ` · ${wc} with generated keywords`;
      if (kts != null && Number.isFinite(kts)) line += ` (${kts} total keyword rows)`;
    }
    if (tel != null && Number.isFinite(tel)) line += ` · Paying (CRM): ${tel}`;
    if (linked != null && Number.isFinite(linked)) line += ` · GBP-linked in snapshot: ${linked}`;
    if (searchTerm.trim() && rows.length < locations.length) {
      line += ` · Showing ${rows.length} match(es) in table`;
    }
    setStatusText(line);
  }, [rows, keywordCounts, keywordSummary, locations.length, loading, searchTerm]);

  if (loading) {
    return <CenteredLoader message="Loading GMB accounts table..." />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-red-700">{error}</p>
      </div>
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
            placeholder="Search Account..."
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto table-scrollbar">
          <div className="max-h-[620px] overflow-y-auto table-scrollbar">
            <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-800">
                  <tr style={{ background: '#0f172a' }}>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-left whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <span className="text-slate-200">Account Name</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-left whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span className="text-slate-200">Location Id Short</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        <span className="text-slate-200">Total Keywords</span>
                      </div>
                    </th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-50">
                {pagedRows.map((row) => (
                  <tr key={`${row.locationId}-${row.locationIdShort}`} className="transition-all duration-300 cursor-pointer group">
                    <td className="px-5 py-3.5 font-semibold text-gray-800 border-l-4 border-transparent group-hover:border-emerald-500 transition-all duration-300">{row.title}</td>
                    <td className="px-5 py-3.5">
                      <code className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                        {row.locationIdShort || '—'}
                      </code>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700 tabular-nums">
                        {row.totalKeywords == null ? '0' : row.totalKeywords}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>



        <div className="border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 font-semibold">
              Showing {rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} results
            </p>
            <Pagination 
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
        {statusText ||
          (locations.length
            ? `Keyword counts available: ${Object.keys(keywordCounts).length}/${rows.length}`
            : '')}
      </div>
    </section>
  );
}
