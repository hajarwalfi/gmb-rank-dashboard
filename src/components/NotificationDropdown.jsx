import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiUrl } from '../apiBase';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('read_notifications') || '[]');
    } catch {
      return [];
    }
  });
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(apiUrl('/api/history/all'));
        const data = await res.json();
        if (!res.ok) return;

        const latestDayTotal = (row) => {
          const raw = row?.raw_traffic_data || {};
          const first = Array.isArray(raw.daily_breakdown_desc) ? raw.daily_breakdown_desc[0] : null;
          if (!first) return 0;
          return (
            Number(first.calls || 0) +
            Number(first.chat_clicks || 0) +
            Number(first.website_clicks || 0)
          );
        };

        const changes = [];
        (data.businesses || []).forEach(b => {
          const latest = b.latest_scan;
          const prev = b.previous_scan;
          if (!latest || !prev) return;

          // Check for Rank changes
          const latestRanks = Array.isArray(latest.map_ranks) ? latest.map_ranks : [];
          const prevRanksMap = new Map();
          if (Array.isArray(prev.map_ranks)) {
            prev.map_ranks.forEach(r => prevRanksMap.set(r.keyword, r));
          }

          latestRanks.forEach(r => {
            const pr = prevRanksMap.get(r.keyword);
            if (!pr) return;

            if (r.rank && pr?.rank && r.rank !== pr.rank) {
              changes.push({
                id: `rank-${b.business_id}-${r.keyword}-${latest.scan_id}`,
                business: b.business_name,
                keyword: r.keyword,
                type: 'Rank',
                old: pr.rank,
                now: r.rank,
                isImprovement: r.rank < pr.rank,
                time: latest.scanned_at
              });
            }

            const latestClicks = latestDayTotal(r);
            const prevClicks = latestDayTotal(pr);
            if (latestClicks !== prevClicks) {
              changes.push({
                id: `clicks-${b.business_id}-${r.keyword}-${latest.scan_id}`,
                business: b.business_name,
                keyword: r.keyword,
                type: 'Clicks',
                old: prevClicks,
                now: latestClicks,
                isImprovement: latestClicks > prevClicks,
                time: latest.scanned_at
              });
            }
          });

          // Check for Review changes
          if (latest.reviews?.total_count !== prev.reviews?.total_count) {
            latestRanks.forEach(r => {
              changes.push({
                id: `rev-${b.business_id}-${r.keyword}-${latest.scan_id}`,
                business: b.business_name,
                keyword: r.keyword,
                type: 'Reviews',
                old: prev.reviews?.total_count || 0,
                now: latest.reviews?.total_count || 0,
                isImprovement: (latest.reviews?.total_count || 0) > (prev.reviews?.total_count || 0),
                time: latest.scanned_at
              });
            });
          }

        });

        // Sort by time descending
        changes.sort((a, b) => new Date(b.time) - new Date(a.time));
        setNotifications(changes);
      } catch (e) {
        console.error('Failed to fetch notifications', e);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const latestTenNotifications = useMemo(() => notifications.slice(0, 10), [notifications]);
  /** Bell badge counts every item visible in this dropdown so it matches “Showing latest N”. */
  const dropdownVisibleCount = latestTenNotifications.length;
  const unreadNotifications = useMemo(() => {
    return latestTenNotifications.filter(n => !readIds.includes(n.id));
  }, [latestTenNotifications, readIds]);

  const markAsRead = (id) => {
    const next = [...readIds, id];
    setReadIds(next);
    localStorage.setItem('read_notifications', JSON.stringify(next));
  };

  const markAllAsRead = () => {
    const next = [...new Set([...readIds, ...latestTenNotifications.map(n => n.id)])];
    setReadIds(next);
    localStorage.setItem('read_notifications', JSON.stringify(next));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative group h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-sm transition-all hover:scale-105 active:scale-95"
      >
        <svg className="h-5 w-5 text-slate-500 group-hover:text-emerald-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {dropdownVisibleCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-4 ring-white animate-in zoom-in duration-300">
            {dropdownVisibleCount > 99 ? '99+' : dropdownVisibleCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[600] w-80 sm:w-96 rounded-[2.5rem] border border-slate-100 bg-white shadow-[0_30px_70px_-10px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5 transition-all transform origin-top-right overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Latest Updates</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Real-time Performance Feed</p>
            </div>
            {unreadNotifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="h-[216px] md:h-[324px] xl:h-[432px] overflow-y-auto no-scrollbar py-2">
            {latestTenNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No New Notifications</p>
                <p className="text-[9px] font-medium text-slate-400 mt-1">Everything is up to date.</p>
              </div>
            ) : (
              latestTenNotifications.map((n) => (
                <div key={n.id} className="relative group min-h-[108px] px-6 py-4 hover:bg-slate-50/80 transition-all border-b border-slate-50 last:border-0">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.isImprovement ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${n.isImprovement ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {n.type} {n.isImprovement ? 'Improved' : 'Dropped'}
                        </span>
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-300 hover:text-slate-600 transition-all"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight">{n.business}</p>
                      <p className="text-[10px] font-bold text-slate-400 truncate mb-2">{n.keyword}</p>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 line-through">{n.old}</span>
                        <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeWidth="3" strokeLinecap="round" /></svg>
                        <span className={`text-[10px] font-black ${n.isImprovement ? 'text-emerald-600' : 'text-rose-600'}`}>{n.now}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex flex-col gap-3">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
              Showing latest {dropdownVisibleCount} notification{dropdownVisibleCount === 1 ? '' : 's'}
              {unreadNotifications.length > 0 && unreadNotifications.length < dropdownVisibleCount
                ? ` · ${unreadNotifications.length} unread`
                : ''}
            </p>
            <button 
              onClick={() => {
                setOpen(false);
                window.location.href = '/?tab=notifications';
              }}
              className="w-full py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm active:scale-[0.98]"
            >
              See All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
