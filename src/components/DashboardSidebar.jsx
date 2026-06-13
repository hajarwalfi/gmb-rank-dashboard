import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navBase =
  'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition no-underline';
const navActive = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-900/40';
const navIdle = 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent';

const Icon = {
  dashboard: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8M5 10v10h14V10" />
    </svg>
  ),
  accounts: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5V4H2v16h5m10 0v-6H7v6m10 0H7" />
    </svg>
  ),
  analysis: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 16V8m5 8V5m5 11v-6" />
    </svg>
  ),
  progress: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  keyword: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  ranking: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  archive: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V9.75M3.75 7.5a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25m-16.5 0a2.25 2.25 0 002.25 2.25h12a2.25 2.25 0 002.25-2.25" />
    </svg>
  ),
  manual: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.423 3.007a3 3 0 013.154 0L19.714 6.04a3 3 0 011.536 2.599v6.722a3 3 0 01-1.536 2.599l-5.137 3.033a3 3 0 01-3.154 0l-5.137-3.033A3 3 0 013.286 15.36V8.639a3 3 0 011.536-2.599l5.137-3.033z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12V3m0 9l5.137-3.033M12 12l-5.137-3.033" />
    </svg>
  ),
  settings: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.332.183-.582.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  tracker: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2 5 4-10 2 5h6" />
    </svg>
  ),
  notifications: ({ active }) => (
    <svg className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-emerald-500/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  logout: ({ active }) => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  ),
};

function SidebarItem({ to, active, onClick, icon, label }) {
  const IconNode = Icon[icon] || Icon.dashboard;
  return (
    <Link to={to} onClick={onClick} className={`${navBase} ${active ? navActive : navIdle}`}>
      <span
        className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${active ? 'bg-white/20' : 'bg-white/5 group-hover:bg-emerald-500/20'
          }`}
      >
        <IconNode active={active} />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

/**
 * Vertical admin sidebar. Uses /?tab=… for dashboard tabs; Rank history is /gmb-rank-history.
 * Not used on login or public gallery pages.
 * onNavAction: called after any nav action (mobile overlay close).
 */
export default function DashboardSidebar({
  activeTab,
  showHistory,
  onReportArchive,
  onNewRankingAnalysis,
  showNewRankingButton,
  onNavAction,
  onLogout,
}) {
  const afterNav = () => {
    onNavAction?.();
  };
  const location = useLocation();
  const path = (location.pathname || '').toLowerCase();
  const params = new URLSearchParams(location.search || '');
  const historyView = String(params.get('view') || '').toLowerCase();
  const isRankHistoryPage = path === '/gmb-rank-history';
  const isDashboard = path === '/' || path === '';

  const tabActive = (key) => isDashboard && !isRankHistoryPage && activeTab === key;
  const historyTabActive = (view) =>
    isDashboard && !isRankHistoryPage && activeTab === 'history' && historyView === String(view).toLowerCase();

  const rankingMainActive = tabActive('ranking') && !showHistory;
  const reportArchiveActive = Boolean(showHistory && activeTab === 'ranking');

  const [isManualOpen, setIsManualOpen] = useState(false);
  const isManualSubActive = tabActive('gmb') || rankingMainActive || reportArchiveActive;

  useEffect(() => {
    if (isManualSubActive) setIsManualOpen(true);
  }, [isManualSubActive]);

  return (
    <nav className="flex h-full flex-col gap-2" aria-label="Main navigation">
      <div className="mb-8 px-1">
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-900/40 transition-transform group-hover:scale-110">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xl font-black italic tracking-tighter text-white whitespace-nowrap group-hover:text-emerald-400 transition-colors">
              Ranking Search
            </span>
          </div>
        </Link>
      </div>

      <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Main Menu</p>

      <SidebarItem to="/?tab=dashboard" onClick={afterNav} active={tabActive('dashboard')} icon="dashboard" label="Dashboard" />
      <SidebarItem to="/?tab=gmbaccounts" onClick={afterNav} active={tabActive('gmbaccounts')} icon="accounts" label="GMB Accounts" />
      <SidebarItem to="/?tab=history&view=analysis-results" onClick={afterNav} active={historyTabActive('analysis-results')} icon="analysis" label="Analysis Results" />
      <SidebarItem to="/gmb-rank-history" onClick={afterNav} active={isRankHistoryPage} icon="tracker" label="Rank History Tracker" />
      <SidebarItem to="/?tab=settings" onClick={afterNav} active={tabActive('settings')} icon="settings" label="Settings" />
      <SidebarItem to="/?tab=notifications" onClick={afterNav} active={tabActive('notifications')} icon="notifications" label="Notifications" />

      {/* Manual Collapsible Section moved to end */}
      <div>
        <button
          type="button"
          onClick={() => setIsManualOpen(!isManualOpen)}
          className={`${navBase} ${isManualSubActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'} transition-all duration-200 group`}
        >
          <span className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${isManualSubActive ? 'bg-emerald-500/20' : 'bg-white/5 group-hover:bg-emerald-500/10'}`}>
            <Icon.manual active={isManualSubActive} />
          </span>
          <span className="flex-1 font-semibold">Manual Tools</span>
          <svg
            className={`h-4 w-4 transition-transform duration-300 ${isManualOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className={`mt-1 flex flex-col gap-1 overflow-hidden transition-all duration-300 ${isManualOpen ? 'max-h-64 opacity-100 ml-4 border-l border-slate-800 pl-2' : 'max-h-0 opacity-0'}`}>
          <SidebarItem to="/?tab=gmb" onClick={afterNav} active={tabActive('gmb')} icon="keyword" label="Keyword Research" />
          <SidebarItem to="/?tab=ranking&view=scan" onClick={afterNav} active={rankingMainActive} icon="ranking" label="Ranking Analysis" />
          <button
            type="button"
            onClick={() => {
              onReportArchive();
              afterNav();
            }}
            className={`${navBase} ${reportArchiveActive ? navActive : navIdle} py-2`}
          >
            <span className={`grid h-7 w-7 place-items-center rounded-lg ${reportArchiveActive ? 'bg-white/20' : 'bg-white/5'}`}>
              <Icon.archive active={reportArchiveActive} />
            </span>
            <span className="text-xs">Report Archive</span>
          </button>
        </div>
      </div>

      {/* Spacer */}
      <div className="pb-2" aria-hidden="true" />

      {/* Premium Sticky Logout Section */}
      <div className="sticky bottom-0 mt-auto bg-[#0f172a] pt-4 pb-2 z-10 px-1">
        <button
          type="button"
          onClick={() => {
            onLogout?.();
            afterNav();
          }}
          className="group flex w-full items-center gap-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-left text-sm font-black text-rose-400 shadow-sm transition-all hover:bg-rose-500 hover:text-white hover:border-rose-400 hover:shadow-lg hover:shadow-rose-900/20 active:scale-[0.98]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/20 text-rose-400 shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
            <Icon.logout active={false} />
          </span>
          <span className="flex-1">Logout</span>
        </button>
      </div>
    </nav>
  );
}
