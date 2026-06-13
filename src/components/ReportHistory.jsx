import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiUrl } from '../apiBase';

export default function ReportHistory({ onPick, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/report/list'));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'We could not load your saved reports right now.');
        if (!cancelled) setItems(Array.isArray(data.reports) ? data.reports : []);
      } catch (e) {
        if (!cancelled) setError(e.message || 'We could not load your saved reports right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(apiUrl(`/api/report/${encodeURIComponent(id)}`), { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'We could not delete this report right now.');
      }
      setItems((prev) => prev.filter((r) => r.id !== id));
      toast.success('Report deleted.');
    } catch (err) {
      toast.error(err.message || 'We could not delete this report right now. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-brand-mint/40 bg-white/70 p-10 text-center text-brand-muted">
        Loading report archive…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {error}
        <button
          type="button"
          onClick={onBack}
          className="mt-4 block mx-auto text-sm font-bold uppercase text-brand-pine underline"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-extrabold text-brand-midnight">Report Archive</h2>
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto rounded-2xl border border-brand-mint bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-pine hover:bg-brand-frost print:hidden shadow-sm active:scale-95 transition-all"
        >
          Back to search
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-brand-mint/40 bg-white/60 p-8 sm:p-10 text-center text-sm text-brand-muted font-medium">
          No reports archived yet. Run a ranking analysis and click &quot;Save report&quot; on the results screen.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => onPick(r)}
                className="flex-1 text-left rounded-2xl border border-brand-mint/50 bg-white/80 px-5 sm:px-6 py-4 shadow-sm transition hover:border-brand-sage hover:shadow-md active:scale-[0.99]"
              >
                <div className="font-bold text-brand-midnight text-sm sm:text-base leading-snug">{r.businessName}</div>
                <div className="mt-1.5 text-[10px] sm:text-xs text-brand-muted font-medium">
                  Saved {new Date(r.savedAt).toLocaleDateString()} · {(r.results || []).length} row(s)
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, r.id)}
                disabled={deletingId === r.id}
                title="Delete report"
                className="flex-shrink-0 self-center rounded-xl border border-red-200 bg-red-50 p-3 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {deletingId === r.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
