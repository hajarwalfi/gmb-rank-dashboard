import { useRef, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { animate, stagger } from 'animejs';
import { apiUrl, outputsPublicHref } from '../apiBase';

export default function RankingResults({ report = {}, onNewSearch, onSaveReport, saveBusy = false, onReportResultsChange }) {
  const { businessName = '', primaryCategory = '', results: initialResults = [], generatedAt = new Date().toISOString(), source = '' } = report || {};
  const [results, setResults] = useState(initialResults);
  const [capturingId, setCapturingId] = useState(null);

  useEffect(() => {
    setResults(initialResults);
  }, [initialResults]);

  const displayPosition = (r) => {
    const v =
      r.displayRank ?? r.observedAbsoluteOrganicRank ?? r.position ?? r.rank;
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const hasCapturedScreenshot = (r) => {
    const p = r?.screenshotPath;
    return Boolean(p && !String(p).includes('googlelogo') && !String(p).includes('branding'));
  };

  const found = results
    .filter((r) => displayPosition(r) != null)
    .sort((a, b) => displayPosition(a) - displayPosition(b));
  const notFound = results.filter((r) => displayPosition(r) == null);
  const blocked = report.source !== 'dataforseo' && results.some((r) => r.error && /google blocked|unusual traffic/i.test(r.error));
  // Detect DataForSEO quota exhaustion
  const quotaError = results.find(r => r.error && /quota|run out|credits|searches/i.test(r.error))?.error || null;

  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current.querySelectorAll('.anime-result-item'), {
        opacity: [0, 1],
        translateY: [30, 0],
        scale: [0.98, 1],
        easing: 'easeOutCubic',
        duration: 800,
        delay: stagger(120, { start: 100 })
      });
    }
  }, []);

  const handleCapture = async (row) => {
    if (capturingId) return;
    setCapturingId(row.id);
    try {
      const res = await fetch(apiUrl('/api/ranking/capture-screenshot'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: row.keyword,
          businessName: businessName,
          listingTitle: row.title || businessName,
          mapsLink: row.mapsLink || null,
          rank: row.rank ?? null,
          googleSearchUrl: row.googleSearchUrl || row.verifyGoogleSearchUrl || null,
          verifyGoogleSearchUrl: row.verifyGoogleSearchUrl || row.googleSearchUrl || null,
          gpsCoordinates: row.gpsCoordinates || null,
          rankSlotOnSerpPage: row.rankSlotOnSerpPage ?? null,
          localSerpStart: row.localSerpStart ?? null,
        }),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        alert(
          res.status === 504 || res.status === 408
            ? 'The screenshot request took longer than expected. Please try again in a moment.'
            : 'We received an unexpected response while capturing the screenshot. Please try again.'
        );
        return;
      }
      if (!res.ok) {
        alert(data.error || 'We could not capture this screenshot right now. Please try again.');
        return;
      }
      if (data.screenshotPath) {
        setResults((prev) => {
            const next = prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  screenshotPath: data.screenshotPath,
                  displayRank: data.displayRank ?? null,
                  scanRank: data.scanRank ?? row.rank ?? null,
                  observedAbsoluteOrganicRank: data.observedAbsoluteOrganicRank ?? null,
                  observedOrganicSlotOnPage: data.observedOrganicSlotOnPage ?? null,
                  observedSlotOnPage: data.observedSlotOnPage ?? null,
                  observedMatchIsSponsored: data.observedMatchIsSponsored ?? null,
                }
              : r
            );
            if (typeof onReportResultsChange === 'function') onReportResultsChange(next);
            return next;
          });
        toast.success('Screenshot captured.', { duration: 3000 });
      } else {
        alert(data.error || 'We could not capture this screenshot right now. Please try again.');
      }
    } catch (err) {
      alert(err.message || 'We could not connect right now. Please check your connection and try again.');
    } finally {
      setCapturingId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Keyword', 'Title', 'Rank', 'Type', 'Page', 'Address', 'Source', 'Screenshot URL'];
    const rows = results.map(r => [
      r.keyword,
      r.title || '-',
      displayPosition(r) ?? 'Not Found',
      r.type || '-',
      r.page || '-',
      r.address || '-',
      r.source || '-',
      r.screenshotPath ? outputsPublicHref(r.screenshotPath) : '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ranking_report_${businessName.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={containerRef} className="space-y-8 w-full max-w-5xl mx-auto">

      {/* DataForSEO quota exhausted banner */}
      {quotaError && (
        <div className="anime-result-item rounded-2xl border border-red-200 bg-red-50/90 backdrop-blur-md px-6 py-5 text-sm text-red-800 shadow-sm" style={{ opacity: 0 }}>
          <div className="flex items-center gap-3 font-semibold mb-1">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            DataForSEO search quota exhausted
          </div>
          <div className="pl-8 text-red-700/80">
            Your DataForSEO account has run out of searches. Please log in at{' '}
            <a href="https://dataforseo.com/manage-api-key" target="_blank" rel="noopener noreferrer"
              className="underline font-semibold hover:text-red-900">dataforseo.com</a>{' '}
            and upgrade or recharge your plan to continue.
          </div>
        </div>
      )}

      {blocked && (
        <div className="anime-result-item rounded-2xl border border-amber-200 bg-amber-50/90 backdrop-blur-md px-6 py-5 text-sm text-amber-800 shadow-sm" style={{ opacity: 0 }}>
          <div className="flex items-center gap-3 font-semibold mb-1">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Google is limiting automated search
          </div>
          <div className="pl-8 text-amber-700/80">
            For reliable ranking, ensure <code className="rounded-md bg-amber-100/50 px-1.5 py-0.5 text-amber-900 font-mono text-xs border border-amber-200">DATAFORSEO_LOGIN</code> and password are set in your environment file.
          </div>
        </div>
      )}

      <div className="anime-result-item relative overflow-hidden rounded-[2rem] border border-brand-mint/40 bg-white/70 backdrop-blur-xl p-6 sm:p-8 md:p-10 shadow-[0_20px_60px_-15px_rgba(26,92,56,0.1)] w-full flex flex-col md:flex-row md:items-center justify-between gap-6" style={{ opacity: 0 }}>
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-brand opacity-70" />

        <div className="z-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-midnight tracking-tight leading-tight">
            {businessName}
          </h2>
          {primaryCategory && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-brand-forest">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              Searched as: <span className="italic">{primaryCategory}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] sm:text-sm text-brand-muted font-medium">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {new Date(generatedAt).toLocaleString()}
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-100/70 px-2.5 py-1 text-[10px] sm:text-[11px] uppercase tracking-widest font-bold text-blue-700 border border-blue-200">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
              Local Pack
            </span>
            {source && (
              <span className="inline-flex items-center rounded-full bg-brand-mint/50 px-2.5 py-1 text-[10px] sm:text-[11px] uppercase tracking-widest font-bold text-brand-pine border border-brand-mint">
                {source === 'dataforseo' ? 'DataForSEO' : source === 'browser' ? 'Browser' : 'Demo'}
              </span>
            )}
          </div>
        </div>

        <div className="z-10 flex flex-col sm:flex-row gap-2 sm:gap-3 w-full md:w-auto">
          {typeof onSaveReport === 'function' && (
            <button
              type="button"
              onClick={() => onSaveReport()}
              disabled={saveBusy}
              className="group flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-brand-sage/30 text-brand-pine hover:bg-brand-sage hover:text-white border border-brand-mint/60 px-5 sm:px-6 py-2.5 sm:py-3.5 font-bold tracking-wide uppercase text-[10px] sm:text-xs shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md print:hidden disabled:opacity-60 disabled:pointer-events-none"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l3 3m0 0l-3 3m3-3H4" /></svg>
              {saveBusy ? 'Saving…' : 'Save report'}
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="group flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-white text-brand-pine hover:bg-brand-frost hover:text-brand-forest border border-brand-mint/60 px-5 sm:px-6 py-2.5 sm:py-3.5 font-bold tracking-wide uppercase text-[10px] sm:text-xs shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md print:hidden"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="group flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-white text-brand-pine hover:bg-brand-frost hover:text-brand-forest border border-brand-mint/60 px-5 sm:px-6 py-2.5 sm:py-3.5 font-bold tracking-wide uppercase text-[10px] sm:text-xs shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md print:hidden"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:-translate-y-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            PDF
          </button>
          <button
            onClick={onNewSearch}
            className="group flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-brand-midnight hover:bg-[#112316] text-white px-5 sm:px-6 py-2.5 sm:py-3.5 font-bold tracking-wide uppercase text-[10px] sm:text-xs shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-midnight/20 print:hidden"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:rotate-180 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            New Search
          </button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="anime-result-item rounded-3xl border border-brand-mint/40 bg-white/70 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-shadow flex flex-col justify-center relative overflow-hidden group" style={{ opacity: 0 }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-mint/20 rounded-bl-[100px] -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Total Checked</p>
          <p className="text-4xl font-extrabold text-brand-midnight">{results.length}</p>
        </div>
        <div className="anime-result-item rounded-3xl border border-brand-mint/40 bg-gradient-to-br from-brand-frost to-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-shadow flex flex-col justify-center relative overflow-hidden group" style={{ opacity: 0 }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-sage/10 rounded-bl-[100px] -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <p className="text-[10px] uppercase tracking-widest font-bold text-brand-forest mb-2">Search Positions Found</p>
          <div className="flex items-baseline gap-2">
            <p className="text-5xl font-extrabold text-brand-pine">{found.length}</p>
            <span className="text-sm font-bold text-brand-sage uppercase tracking-wider">matches</span>
          </div>
        </div>
        <div className="anime-result-item rounded-3xl border border-amber-200/40 bg-white/70 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-shadow flex flex-col justify-center relative overflow-hidden group" style={{ opacity: 0 }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-[100px] -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-600/70 mb-2">Not in top results</p>
          <p className="text-4xl font-extrabold text-amber-900/40">{notFound.length}</p>
        </div>
      </div>

      <div className="anime-result-item w-full overflow-hidden rounded-[2rem] border border-brand-mint/40 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(26,92,56,0.08)] flex flex-col" style={{ opacity: 0 }}>
        <div className="border-b border-brand-mint/30 bg-brand-frost/50 px-5 py-4 sm:px-8 sm:py-5">
          <h3 className="text-xs sm:text-sm font-bold tracking-widest uppercase text-brand-midnight flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-brand-forest"></span>
            Confirmed Search Positions
          </h3>
        </div>
        <div className="overflow-x-auto w-full table-scrollbar">
          {found.length > 0 ? (
            <table className="min-w-full divide-y divide-brand-mint/30">
              <thead>
                <tr>
                  <th className="px-5 sm:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-muted">Keyword</th>
                  <th className="px-5 sm:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-muted">Title / Branch</th>
                  <th className="px-5 sm:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-muted">Rank</th>
                  <th className="px-5 sm:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-muted">Pg</th>
                  <th className="hidden px-5 sm:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-muted md:table-cell">Type</th>
                  <th className="hidden px-5 sm:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-brand-muted md:table-cell">Address</th>
                  <th className="hidden px-5 sm:px-8 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-brand-muted lg:table-cell">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-mint/20 bg-white/40">
                {found.map((row) => (
                  <tr key={row.id ?? `${row.keyword}-${displayPosition(row)}`} className="hover:bg-brand-frost/80 transition-colors duration-200 group">
                    <td className="whitespace-normal sm:whitespace-nowrap px-5 sm:px-8 py-4 text-sm font-semibold text-brand-midnight">{row.keyword}</td>
                    <td className="whitespace-normal px-5 sm:px-8 py-4 text-[13px] font-bold text-brand-pine">
                      {row.title || '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 sm:px-8 py-4">
                      {(() => {
                        const pos = displayPosition(row);
                        if (pos <= 3) return (
                          <span className="inline-flex flex-col items-center justify-center px-3 py-1 rounded-xl bg-brand-forest text-white text-xs font-bold shadow-sm gap-0.5">
                            <span className="text-[10px] text-brand-mint/80 leading-none">3-Pack</span>
                            <span className="leading-none">#{pos}</span>
                          </span>
                        );
                        return (
                          <span className="inline-flex flex-col items-center justify-center px-3 py-1 rounded-xl bg-brand-midnight text-white text-xs font-bold shadow-sm gap-0.5">
                            <span className="text-[10px] text-brand-mint/70 leading-none">Maps</span>
                            <span className="leading-none">#{pos}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-semibold text-brand-muted sm:px-8">{row.page ?? 1}</td>
                    <td className="hidden whitespace-nowrap px-6 py-4 sm:px-8 md:table-cell">
                      {displayPosition(row) <= 3
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-mint/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-forest border border-brand-mint/50">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                            Local 3-Pack
                          </span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-200">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                            Maps Results
                          </span>
                      }
                    </td>
                    <td className="hidden whitespace-normal px-6 py-4 text-[11px] font-medium text-brand-muted sm:px-8 md:table-cell max-w-[200px]">{row.address || '—'}</td>
                    <td className="hidden px-6 py-4 sm:px-8 lg:table-cell text-right">
                      <div className="inline-flex items-center gap-2">
                        {hasCapturedScreenshot(row) && (
                          <a href={outputsPublicHref(row.screenshotPath)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-frost border border-brand-mint text-brand-forest hover:bg-brand-mint hover:text-brand-pine hover:scale-105 transition-all shadow-sm" title="Open screenshot">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          </a>
                        )}
                        <button onClick={() => handleCapture(row)} disabled={capturingId === row.id} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all border ${capturingId === row.id ? 'bg-brand-frost text-brand-muted border-brand-mint cursor-not-allowed' : 'bg-brand-mint/20 text-brand-forest border-brand-mint hover:bg-brand-mint hover:text-brand-pine'}`} title="Capture screenshot">
                          {capturingId === row.id ? 'Capturing...' : 'Capture Screenshot'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center text-brand-muted font-medium italic">No matches found in top rankings for these keywords.</div>
          )}
        </div>
      </div>

      {notFound.length > 0 && (
        <div className="anime-result-item w-full overflow-hidden rounded-[2rem] border border-amber-200/40 bg-white/70 backdrop-blur-xl shadow-lg flex flex-col" style={{ opacity: 0 }}>
          <div className="border-b border-amber-200/30 bg-amber-50/50 px-6 py-5 sm:px-8">
            <h3 className="text-sm font-bold tracking-widest uppercase text-amber-900 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Not Found Keywords (No Specific Results)
            </h3>
          </div>
          <div className="p-6 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2">
              {notFound.map((row) => (
                <div key={row.id ?? row.keyword} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/30 px-5 py-4">
                  <span className="text-sm font-bold text-amber-950/70">{row.keyword}</span>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-amber-600/50 px-2 py-1 rounded-md bg-amber-100 border border-amber-200">Not Found</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
