import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationDropdown from './NotificationDropdown';
import AutomationStatusBanner from './AutomationStatusBanner';

export default function Layout({ children, sidebar, onLogout, pageTitle }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHistory = pathname.toLowerCase() === '/gmb-rank-history';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);

  const closeMobileNav = () => setMobileNavOpen(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeMobileNav();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onResize = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', onResize);
    return () => mq.removeEventListener('change', onResize);
  }, []);

  useEffect(() => {
    if (!adminMenuOpen) return;
    const onDoc = (e) => {
      if (!adminMenuRef.current?.contains(e.target)) setAdminMenuOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setAdminMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [adminMenuOpen]);

  const handleLogout = () => {
    setAdminMenuOpen(false);
    if (onLogout) {
      onLogout();
      return;
    }
    sessionStorage.clear();
    navigate('/');
  };

  const sidebarWithClose =
    sidebar && isValidElement(sidebar)
      ? cloneElement(sidebar, { onNavAction: closeMobileNav })
      : sidebar;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sidebar - starts from the very top */}
      {sidebar ? (
        <>
          <aside className="sidebar-scroll hidden shrink-0 border-r border-slate-800 bg-[#0f172a] px-4 py-4 md:fixed md:left-0 md:top-0 md:block md:h-screen md:w-64 md:overflow-y-auto">
            {sidebar}
          </aside>

          <div className="flex-1 flex flex-col md:ml-64">
            {/* Top Profile Bar */}
            <header className="sticky top-0 z-[500] border-b border-slate-200 bg-white/95 backdrop-blur-xl h-[72px] flex items-center">
              <div className="mx-auto flex w-full max-w-[1920px] items-center gap-3 px-4 sm:px-6 lg:px-8">
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open menu"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {pageTitle && (
                  <div className="hidden lg:block">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-700 bg-emerald-50/50 px-5 py-2 rounded-xl border border-emerald-100/50 shadow-sm backdrop-blur-sm leading-none flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {pageTitle}
                    </span>
                  </div>
                )}

                <div className="ml-auto flex items-center justify-end gap-3">
                  <AutomationStatusBanner />
                  <NotificationDropdown />
                  <div className="relative flex items-center gap-2" ref={adminMenuRef}>
                    <div className="text-right leading-none flex flex-col items-end gap-1">
                      <p className="text-sm font-black text-slate-900 tracking-tight">Systemic Digital</p>
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50">
                        {isHistory ? 'Internal Dashboard' : 'Admin Panel'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminMenuOpen((v) => !v)}
                      className="relative group h-10 w-10 overflow-hidden rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm transition-all hover:scale-105 active:scale-95"
                    >
                      <span className="relative z-10 text-sm font-black text-emerald-800">A</span>
                    </button>
                    {adminMenuOpen && (
                      <div className="absolute right-0 top-12 z-[700] w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5M21 12H9m4 9H5a2 2 0 01-2-2V5a2 2 0 012-2h8" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* Mobile Navigation */}
            {mobileNavOpen && (
              <div className="fixed inset-0 z-[600] md:hidden">
                <button type="button" className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" onClick={closeMobileNav} />
                <div className="absolute left-0 top-0 flex h-full w-[min(18rem,calc(100vw-2rem))] flex-col border-r border-slate-800 bg-[#0f172a] shadow-2xl animate-[slideIn_0.2s_ease-out]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Menu</span>
                    <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={closeMobileNav}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="sidebar-scroll flex-1 overflow-y-auto px-4 py-4">{sidebarWithClose}</div>
                </div>
              </div>
            )}

            <main className="relative min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {children}
            </main>

            <footer className="mt-auto border-t border-slate-100 bg-white/50 py-5 text-center backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600">
                Search Ranking Intelligence Platform • Internal Platform • Authorized Personnel Only
              </p>
            </footer>
          </div>
        </>
      ) : (
        <div className="flex flex-col flex-1">
          <main className="mx-auto w-full max-w-[1500px] xxxl:max-w-[1920px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
          <footer className="mt-auto border-t border-slate-100 bg-white/50 py-4 text-center backdrop-blur-sm">
            <p className="text-[10px] font-medium tracking-wide text-slate-400">
              Search Ranking Intelligence Platform • Internal Platform • Authorized Personnel Only
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
