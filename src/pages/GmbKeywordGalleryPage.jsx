import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { apiUrl, outputsAssetUrl } from '../apiBase';

const Ic = {
  Gallery: p => (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  X: p => (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Camera: p => (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  ImageOff: p => (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M10.41 10.41a2 2 0 11-2.83-2.83" />
      <line x1="13.5" y1="13.5" x2="6" y2="21" />
      <line x1="18" y1="12" x2="21" y2="15" />
      <path d="M3.59 3.59A1.99 1.99 0 003 5v14a2 2 0 002 2h14c.55 0 1.052-.22 1.41-.59" />
      <path d="M21 15V5a2 2 0 00-2-2H9" />
    </svg>
  ),
};

function Spin({ className = 'w-8 h-8' }) {
  return (
    <svg
      className={`${className} text-brand-sage flex-shrink-0`}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.15" />
      <path
        d="M22 12a10 10 0 00-10-10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RankBadge({ rank }) {
  if (rank == null) return null;
  const c =
    rank === 1
      ? 'bg-amber-400 text-amber-950 border-amber-500/30'
      : rank <= 3
        ? 'bg-emerald-500 text-white border-emerald-600/30'
        : rank <= 10
          ? 'bg-sky-500 text-white border-sky-600/30'
          : 'bg-gray-400 text-white border-gray-500/30';
  return (
    <span className={`inline-flex items-center rounded-full text-[10px] uppercase tracking-tighter font-black px-2 py-0.5 border shadow-sm ${c}`}>
      Rank #{rank}
    </span>
  );
}

function GalleryCard({ item, onOpen, index }) {
  return (
    <div 
      className="opacity-0 translate-y-12 animate-in"
      style={{ animation: `fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards ${index * 0.08}s` }}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="group w-full text-left rounded-[2rem] overflow-hidden bg-white border border-slate-200 transition-all duration-700 hover:border-emerald-500/50 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] hover:-translate-y-3 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
      >
        <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
          <img
            src={item.url}
            alt={item.keyword}
            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-1000 cubic-bezier(0.16, 1, 0.3, 1) group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          {item.rank != null && (
            <div className="absolute top-5 right-5 group-hover:scale-110 transition-transform duration-700">
              <RankBadge rank={item.rank} />
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 bg-white">
          <p className="text-xs font-black text-slate-900 tracking-[0.1em] truncate group-hover:text-emerald-600 transition-colors uppercase italic" title={item.keyword}>
            {item.keyword}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 Live Proof
               </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white group-hover:rotate-12 transition-all duration-500 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function ImageLightbox({ item, onClose, onPrev, onNext }) {
  useEffect(() => {
    const handleKey = e => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onPrev, onNext, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/98 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
      style={{ margin: 0 }}
    >
      {/* Subtle theme glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 p-4 text-white/40 hover:text-white transition-all cursor-pointer z-10"
      >
        <Ic.X className="w-8 h-8 hover:rotate-90 transition-transform duration-300" />
      </button>

      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white z-10 transition-all shadow-[0_8px_30px_rgb(16,185,129,0.3)] border border-emerald-400/20 group/nav"
      >
        <svg className="w-8 h-8 group-hover/nav:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white z-10 transition-all shadow-[0_8px_30px_rgb(16,185,129,0.3)] border border-emerald-400/20 group/nav"
      >
        <svg className="w-8 h-8 group-hover/nav:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <div className="relative max-w-[92vw] max-h-[88vh] flex items-center justify-center p-2" onClick={e => e.stopPropagation()}>
        <img
          src={item.url}
          alt={item.keyword}
          className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-[0_40px_100px_rgba(0,0,0,0.6)] animate-in zoom-in duration-500"
        />
        <div className="absolute bottom-2 left-2 right-2 p-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent rounded-b-xl border-x border-b border-white/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
               <p className="text-white font-black text-xl tracking-tight uppercase italic">{item.keyword}</p>
            </div>
            {item.rank != null && (
               <div className="scale-110">
                 <RankBadge rank={item.rank} />
               </div>
            )}
          </div>
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] mt-3">Live Visibility Proof · Search Optimization</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function GmbKeywordGalleryPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [doc, setDoc] = useState(null);
  const [selected, setSelected] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(apiUrl(`/api/gallery/gmb-keywords/${encodeURIComponent(id || '')}`));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'We could not load this gallery right now.');
        if (cancelled) return;
        setDoc(data);
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || 'We could not load this gallery right now.');
          toast.error(e.message || 'We could not load this gallery right now. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const items = (doc?.items || []).map(row => ({
    keyword: row.keyword,
    screenshotPath: row.screenshotPath,
    rank: row.rank,
    url: outputsAssetUrl(row.screenshotPath),
  }));

  const openAt = useCallback(
    item => {
      const i = items.findIndex(x => x.screenshotPath === item.screenshotPath);
      setSelected({ item, index: i });
    },
    [items]
  );

  const closeLb = useCallback(() => setSelected(null), []);
  const prevLb = useCallback(() => {
    if (!selected || !items.length) return;
    const i = selected.index > 0 ? selected.index - 1 : items.length - 1;
    setSelected({ item: items[i], index: i });
  }, [selected, items]);
  const nextLb = useCallback(() => {
    if (!selected || !items.length) return;
    const i = selected.index < items.length - 1 ? selected.index + 1 : 0;
    setSelected({ item: items[i], index: i });
  }, [selected, items]);

  const copyGalleryLink = useCallback(() => {
    const href =
      typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    if (!href || !navigator?.clipboard?.writeText) {
      toast.error('Copy is not available in this browser.');
      return;
    }
    navigator.clipboard.writeText(href).then(
      () => toast.success('Gallery link copied successfully.'),
      () => toast.error('We could not copy the gallery link.')
    );
  }, []);

  const saveToTrackingHistory = useCallback(
    async (confirmCompare) => {
      const publicId = String(id || '').trim();
      if (!publicId || saveBusy) return;
      setSaveBusy(true);
      try {
        const res = await fetch(apiUrl('/api/tracking/save-from-gallery'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicId,
            confirmCompare: !!confirmCompare,
            galleryPageUrl:
              typeof window !== 'undefined' ? window.location.href : '',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'We could not save this snapshot right now.');
        if (data.needsConfirm) {
          setShowConfirmModal(true);
          return;
        }
        if (data.saved) {
          toast.success('Snapshot saved to tracking history successfully.');
          setShowConfirmModal(false);
        }
      } catch (e) {
        toast.error(e.message || 'We could not save this snapshot right now. Please try again.');
      } finally {
        setSaveBusy(false);
      }
    },
    [id, saveBusy]
  );

  return (
    <Layout>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
      <div className="rounded-[3rem] border border-slate-200 bg-white overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.08)] transition-all duration-1000">
        <div className="bg-gradient-to-br from-brand-frost via-white to-brand-mint/20 border-b border-brand-mint/30 px-8 sm:px-12 py-10 sm:py-14">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            <div className="flex items-start gap-6 sm:gap-8 min-w-0">
              <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-[2rem] bg-brand-sage flex items-center justify-center shadow-2xl shadow-brand-sage/40 border-4 border-white transform hover:rotate-6 transition-transform duration-500">
                <Ic.Gallery className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <div className="min-w-0 pt-2">
                <h1 className="text-3xl sm:text-5xl font-black text-brand-pine tracking-tighter leading-[0.9] uppercase italic">
                  Search <span className="text-brand-forest not-italic">Visibility</span>
                </h1>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm sm:text-lg font-black text-brand-sage tracking-widest uppercase italic">
                  <p className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-forest animate-pulse" />
                    {(doc?.businessName && doc.businessName.trim()) || 'Snapshot Results'}
                  </p>
                  {items.length > 0 && (
                    <span className="px-3 py-1 rounded-full bg-brand-forest text-white text-[10px] font-black border-2 border-white shadow-lg">
                      {items.length} PROOFS
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <button
                type="button"
                onClick={copyGalleryLink}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-brand-mint bg-white hover:bg-brand-frost px-6 py-4 text-xs font-black uppercase tracking-wider text-brand-pine transition-all shadow-sm active:scale-95"
              >
                Copy Link
              </button>
              <Link
                to="/gmb-rank-history"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-brand-sage/20 bg-brand-sage/5 hover:bg-brand-sage/10 px-6 py-4 text-xs font-black uppercase tracking-wider text-brand-forest transition-all shadow-sm active:scale-95"
              >
                History
              </Link>
              <Link
                to="/"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-pine hover:bg-brand-forest px-8 py-4 text-xs font-black uppercase tracking-wider text-white transition-all shadow-2xl shadow-brand-pine/30 active:scale-95"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>

        <div className="px-8 sm:px-12 py-12 bg-gradient-to-b from-brand-frost/50 to-white min-h-[500px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-brand-pine">
              <Spin className="w-16 h-16" />
              <p className="text-sm font-black uppercase tracking-[0.3em] opacity-40 animate-pulse">Establishing Connection…</p>
            </div>
          )}
          
          {!loading && !err && items.length > 0 && (
            <div className="space-y-12">
              {/* Full-width Horizontal Tracking Row */}
              <div className="bg-white rounded-[2rem] border-2 border-brand-mint/20 p-8 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-center gap-8 translate-y-0 hover:-translate-y-1 transition-transform duration-500">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-sage mb-2">Live Insight Sync</p>
                  <h2 className="text-xl font-black text-brand-pine tracking-tight">Record this snapshot for long-term tracking.</h2>
                  <p className="text-sm text-brand-muted mt-2 font-bold opacity-70">Saves ranks, screenshots, and visual proof to the history engine.</p>
                </div>
                <div className="flex shrink-0 gap-4 w-full md:w-auto">
                    <button
                      type="button"
                      disabled={saveBusy}
                      onClick={() => saveToTrackingHistory(false)}
                      className="flex-1 md:flex-none inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-forest hover:bg-brand-pine px-10 py-5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-2xl shadow-brand-forest/20 disabled:opacity-50 active:scale-95"
                    >
                      {saveBusy ? <Spin className="w-5 h-5" /> : 'Save Snapshot'}
                    </button>
                    <Link
                      to="/gmb-rank-history"
                      className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-brand-mint text-brand-sage hover:bg-brand-frost hover:border-brand-sage transition-all"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                </div>
              </div>

              {/* Full-width Image Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xxxl:grid-cols-5 gap-8">
                {items.map((item, i) => (
                  <GalleryCard key={item.screenshotPath + item.keyword} item={item} onOpen={openAt} index={i} />
                ))}
              </div>
            </div>
          )}

          {!loading && err && (
            <div className="flex flex-col items-center justify-center py-20 text-center max-w-2xl mx-auto">
              <div className="w-24 h-24 rounded-[2rem] bg-red-50 flex items-center justify-center text-red-500 mb-8 shadow-xl">
                <Ic.ImageOff className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-brand-pine tracking-tighter uppercase italic mb-4">Connection Failed</h2>
              <p className="text-lg text-brand-muted font-bold opacity-60 mb-10 leading-relaxed italic">{err}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-12 py-5 bg-brand-pine text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-brand-pine/30 hover:bg-brand-forest transition-all"
              >
                Reconnect Dashboard
              </button>
            </div>
          )}
          
          {!loading && !err && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-24 h-24 rounded-[2rem] bg-brand-frost flex items-center justify-center text-brand-sage/20 mb-8 border-4 border-white shadow-xl">
                <Ic.ImageOff className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-brand-pine tracking-widest uppercase italic opacity-30">Void Dataset</h2>
              <p className="text-brand-muted font-bold mt-2">The snapshot contains no visual indices.</p>
            </div>
          )}
        </div>
      </div>

      {showConfirmModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center bg-brand-pine/40 backdrop-blur-sm p-4"
            style={{ margin: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracking-confirm-title"
          >
            <div className="max-w-md w-full rounded-3xl border border-brand-mint bg-white text-brand-pine shadow-2xl p-8 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-brand-frost flex items-center justify-center text-brand-sage mb-2 border border-brand-mint shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
              </div>
              <div>
                <h2 id="tracking-confirm-title" className="text-2xl font-black tracking-tight mb-2">
                  Compare with History?
                </h2>
                <p className="text-brand-muted font-medium leading-relaxed">
                  This GMB already has existing tracking data. We can save this as a new snapshot to help you visualize rank changes and visual shifts.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 rounded-xl border-2 border-brand-mint px-6 py-3 text-sm font-black text-brand-pine hover:bg-brand-frost transition-all"
                >
                  Discard
                </button>
                <button
                  type="button"
                  disabled={saveBusy}
                  onClick={() => saveToTrackingHistory(true)}
                  className="flex-1 rounded-xl bg-brand-forest px-6 py-3 text-sm font-black text-white hover:bg-brand-pine shadow-lg shadow-brand-forest/30 transition-all disabled:opacity-50"
                >
                  {saveBusy ? 'Processing…' : 'Save & Link'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {selected && (
        <ImageLightbox item={selected.item} onClose={closeLb} onPrev={prevLb} onNext={nextLb} />
      )}
    </Layout>
  );
}
