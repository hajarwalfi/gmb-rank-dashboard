import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { apiUrl, outputsAssetUrl } from '../apiBase';

async function safeReadJsonResponse(res) {
  const text = await res.text();
  const trim = text != null ? String(text).trim() : '';
  if (!trim) {
    if (!res.ok) throw new Error('We could not complete this request right now. Please try again.');
    return {};
  }
  try {
    return JSON.parse(trim);
  } catch {
    throw new Error(
      !res.ok
        ? 'We could not complete this request right now. Please try again.'
        : 'We received an unexpected response. Please try again.'
    );
  }
}

function isTransientCaptureMessage(msg) {
  const s = String(msg || '').toLowerCase();
  return s.includes('captcha') || s.includes('timeout') || s.includes('aborted');
}

/** Row has rank / maps data so capture is possible (Search All "found" path). */
function rowHasRankResult(kw) {
  if (kw.status !== 'done' || !kw.result) return false;
  const r0 = kw.result?.results?.[0];
  if (!r0) return false;
  if (r0.rank != null || r0.displayRank != null || r0.observedAbsoluteOrganicRank != null) return true;
  if (r0.mapsLink) return true;
  return false;
}

function pickStopModalStats(rows) {
  const rankFound = rows.filter(rowHasRankResult).length;
  const withScreenshot = rows.filter((k) => k.status === 'done' && k.screenshotPath).length;
  const needCapture = rows.filter((k) => rowHasRankResult(k) && !k.screenshotPath).length;
  const notStarted = rows.filter((k) => k.status === 'idle' && !k.result).length;
  return { rankFound, withScreenshot, needCapture, notStarted };
}

/** Wait until screenshot capture slots are idle (Run All finishes before async captures complete). */
function waitUntilCaptureSlotsIdle(getCount, maxMs = 15 * 60 * 1000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    (function tick() {
      if (getCount() <= 0) {
        resolve();
        return;
      }
      if (Date.now() - t0 >= maxMs) {
        resolve();
        return;
      }
      setTimeout(tick, 200);
    })();
  });
}

const RUN_ALL_PARALLEL_CALLS = 5;
const RUN_ALL_DEPTH_LIMIT = 100;
const RUN_ALL_DELAY_BETWEEN_CALLS_MS = 1000;
const RUN_ALL_DELAY_BETWEEN_BATCHES_MS = 5000;

/* ─────────────────────────── CSS injected once ─────────────────────────── */
const CSS = `
@keyframes gup   { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
@keyframes gfade { from { opacity:0 }                              to { opacity:1 } }
@keyframes gslide{ from { opacity:0; transform:translateX(-12px) } to { opacity:1; transform:translateX(0) } }
@keyframes gpop  { from { opacity:0; transform:scale(.93) }        to { opacity:1; transform:scale(1) } }
.g-up    { animation: gup    .38s cubic-bezier(.22,.68,0,1.2) both }
.g-fade  { animation: gfade  .28s ease both }
.g-slide { animation: gslide .32s cubic-bezier(.22,.68,0,1.1) both }
.g-pop   { animation: gpop   .26s cubic-bezier(.22,.68,0,1.2) both; transform-origin:top center }
.g-hover { transition: background .14s ease }
.g-hover:hover { background: rgba(93,184,122,.045) }
@keyframes gspin { to { transform: rotate(360deg) } }
@keyframes gdash {
  0%   { stroke-dasharray: 1 200; stroke-dashoffset: 0 }
  50%  { stroke-dasharray: 90 200; stroke-dashoffset: -35 }
  100% { stroke-dasharray: 90 200; stroke-dashoffset: -125 }
}
@keyframes gshimmer {
  0% { background-position: -200% 0 }
  100% { background-position: 200% 0 }
}
.g-skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: gshimmer 1.5s infinite;
}
`;
let _injected = false;
function useCss() {
  if (_injected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  _injected = true;
}

/* ─────────────────────────── Icons ─────────────────────────── */
const Ic = {
  Search:   p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Tag:      p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5"/></svg>,
  Pin:      p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Warn:     p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg>,
  Bldg:     p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="19" rx="2"/><path d="M8 3v18M16 3v18M2 12h20M2 7h6M2 17h6M16 7h6M16 17h6"/></svg>,
  X:        p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.5"  strokeLinecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:    p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.5"  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  Chevron:  p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>,
  ExtLink:  p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Refresh:  p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.5"  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  Layers:   p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  Sparkle:  p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 3L13.5 8.5H19L14.25 12L16 17.5L12 14L8 17.5L9.75 12L5 8.5H10.5L12 3Z"/></svg>,
  Camera:   p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Gallery:  p => <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
};

/* ─────────────────────────── Data helpers ─────────────────────────── */
const getCategory = d => d?.categories?.primaryCategory?.displayName || d?.categories?.primaryCategory?.name || null;

function getAreas(d) {
  const sa = d?.serviceArea;
  const out = [];

  // 1. From service areas
  if (sa) {
    if (Array.isArray(sa)) {
      sa.filter(Boolean).forEach(a => out.push(a));
    } else {
      sa.places?.placeInfos?.forEach(p => { const n = p?.placeName || p?.placeId; if (n) out.push(n); });
      if (sa.regionCode?.length > 2) out.push(sa.regionCode);
      sa.regions?.forEach(r => { const v = r?.displayName || r?.name || r?.regionCode || r?.placeId || (typeof r === 'string' ? r : ''); if (v) out.push(v); });
    }
  }

  // 2. Fallback to address city if no service areas
  if (out.length === 0) {
    const city = d?.storefrontAddress?.locality || d?.address?.locality;
    const state = d?.storefrontAddress?.administrativeArea || d?.address?.administrativeArea;
    if (city) {
      out.push(state ? `${city} ${state}` : city);
    }
  }

  return [...new Set(out)]; // Unique areas
}

const makeKws = (cat, areas) =>
  (!cat || !areas.length) ? [] : areas.map(a => ({
    text: `${cat.toLowerCase()} ${a.toLowerCase()}`,
    area: a,          // kept separately so API calls use the clean area string
    category: cat,    // kept separately so API calls use the clean category
    target_keyword: null,
    source_month: null,
    volume: 0,
    daily_traffic: 0,
    estimated_clicks: 0,
    raw_traffic_data: null,
    status: 'idle', result: null, error: null,
    captureStatus: 'idle', screenshotPath: null,
  }));

  /**
 * One table row from a merged keyword string (same /api/ranking/keywords pipeline as Ranking Analysis: base + OpenAI).
 * Picks a location hint for ZenRows/automation: substring match on service areas, else first area.
 */
function makeKwRowFromMerged(primaryCategory, areasList, keywordText) {
  const cat = primaryCategory || '';
  const areasNorm = Array.isArray(areasList) ? areasList.map((a) => String(a).trim()).filter(Boolean) : [];
  const text = String(keywordText || '').trim();
  const kLow = text.toLowerCase();
  
  let matchedArea = areasNorm.find((a) =>
    a.toLowerCase().split(/\s+/).filter((w) => w.length > 2).some((w) => kLow.includes(w))
  );

  // Fallback: If no match from the provided areasList, try to extract from the keyword text itself
  if (!matchedArea && text) {
    const words = text.split(/\s+/);
    if (words.length >= 3) {
      // Try to take the last 2 or 3 words (common for "City ST" or "City Name")
      // We skip words that are part of the category
      const catWords = cat.toLowerCase().split(/\s+/);
      const filteredWords = words.filter(w => !catWords.includes(w.toLowerCase()));
      if (filteredWords.length >= 2) {
        matchedArea = filteredWords.slice(-2).join(' ');
      } else if (filteredWords.length === 1) {
        matchedArea = filteredWords[0];
      }
    }
  }

  const area = matchedArea || areasNorm[0] || '';
  
  return {
    text,
    area,
    category: cat,
    status: 'idle',
    result: null,
    error: null,
    captureStatus: 'idle',
    screenshotPath: null,
  };
}

/* ─────────────────────────── Primitives ─────────────────────────── */
function Spin({ sz = 4, col = 'text-brand-forest' }) {
  return (
    <svg
      className={`w-${sz} h-${sz} ${col} flex-shrink-0`}
      viewBox="0 0 24 24" fill="none"
      style={{ animation: 'gspin 2s linear infinite', transformOrigin: 'center' }}
    >
      {/* faint track */}
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.12" strokeLinecap="round" />
      {/* animated arc — grows from sliver to ~3/4 arc and back while container rotates */}
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        style={{ animation: 'gdash 1.5s ease-in-out infinite', transformOrigin: 'center' }} />
    </svg>
  );
}

function Bone({ w, h = 'h-3', extra = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100/80 ${h} ${extra}`} style={w ? { width: w } : undefined} />;
}

function RankBadge({ rank }) {
  if (rank == null) return <span className="text-xs text-gray-400">—</span>;
  const c = rank === 1 ? 'bg-amber-50 text-amber-600 border-amber-200' :
            rank <= 3  ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
            rank <= 10 ? 'bg-sky-50 text-sky-600 border-sky-200' :
                         'bg-gray-50 text-gray-500 border-gray-200';
  return <span className={`inline-flex items-center rounded-full border text-xs font-bold px-2.5 py-0.5 tabular-nums leading-none ${c}`}>#{rank}</span>;
}

/* left-side accent color per row status */
const ROW_ACCENT = { done: 'bg-emerald-400', error: 'bg-red-400', loading: 'bg-amber-400', idle: 'bg-gray-200' };

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════════ */
export default function GmbKeywordDashboard() {
  useCss();

  const [locs, setLocs]       = useState([]);
  const [loadL, setLoadL]     = useState(false);
  const [lErr, setLErr]       = useState(null);
  /** Bumps to re-fetch locations (Refresh + initial load). */
  const [locFetchToken, setLocFetchToken] = useState(0);
  const [q, setQ]             = useState('');
  const [open, setOpen]       = useState(false);
  const wrapRef               = useRef(null);
  const inpRef                = useRef(null);

  const [sel, setSel]         = useState(null);
  const [detail, setDetail]   = useState(null);
  const [loadD, setLoadD]     = useState(false);
  const [kws, setKws]         = useState([]);
  const [runAll_, setRunAll_] = useState(false);
  const [gallerySaveBusy, setGallerySaveBusy] = useState(false);

  /** null | 'confirm' (stop further keyword searches) | 'detail' (capture rank-only rows or reset) */
  const [stopModalStep, setStopModalStep] = useState(null);
  const [stopModalStats, setStopModalStats] = useState({
    rankFound: 0,
    withScreenshot: 0,
    needCapture: 0,
    notStarted: 0,
  });
  const [stopModalBusy, setStopModalBusy] = useState(false);

  const kwsRef = useRef(kws);
  const selRef = useRef(sel);
  /** Ensures we fetch monthly click metrics only once per row keyword+area. */
  const trafficFetchedRef = useRef(new Set());
  /** Cache current-month GBP clicks per selected location. */
  const monthlyClicksCacheRef = useRef(new Map());
  /** Prompt "stopRequested" — kept as ref so the Search All worker always reads the latest flag (no stale closure). */
  const stopRequestedRef = useRef(false);
  const modal1YesClickedRef = useRef(false);
  const modalHandledByRef = useRef(false);
  const runAllBarrierResolveRef = useRef(null);
  useEffect(() => {
    kwsRef.current = kws;
  }, [kws]);
  useEffect(() => {
    selRef.current = sel;
  }, [sel]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (runAll_ || runningCapturesCountRef.current > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [runAll_]);

  /* Scrapfly Concurrency Control (Max 15) */
  const [runningCapturesCount, setRunningCapturesCount] = useState(0);
  const runningCapturesCountRef = useRef(0); // Ref for immediate check in loops
  // Keep screenshot fan-out controlled; backend now uses bounded capture slots.
  const MAX_CONCURRENT_CAPTURES = 5;

  /* Paying CRM + GBP-linked locations with generated keywords (`services-keywords.json`). */
  useEffect(() => {
    let cancelled = false;
    setLoadL(true);
    setLErr(null);
    fetch(apiUrl('/api/services-keywords?view=locations'))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok === false) throw new Error(d.error || 'Unexpected response');
        if (d.error) throw new Error(d.error);
        const list = d.locations || [];
        setLocs(list);
        if (list.length === 0) {
          console.warn('[Dashboard] No services-keywords locations — run nightly cron or POST /api/services-keywords/rebuild');
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error('[Dashboard] Locations fetch failed:', e.message);
          setLErr(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadL(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locFetchToken]);

  const refreshLocations = useCallback(() => {
    setLocs([]);
    setLocFetchToken((t) => t + 1);
  }, []);

  /* close on outside click */
  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* focus search */
  useEffect(() => { if (open) setTimeout(() => inpRef.current?.focus(), 40); }, [open]);

  const clear = useCallback(() => { setSel(null); setDetail(null); setKws([]); }, []);

  const pick = useCallback(async loc => {
    setSel(loc); setOpen(false); setQ(''); setDetail(null); setKws([]); setLoadD(true);
    try {
      const cachedKeywords = Array.isArray(loc?.keywords) ? loc.keywords : [];

      let data;
      const useSnap = loc?.source === 'services_keywords' && loc.gbpDetailSnapshot && typeof loc.gbpDetailSnapshot === 'object';
      if (useSnap) {
        data = loc.gbpDetailSnapshot;
        setDetail(data);
      } else {
        const res = await fetch(
          apiUrl(`/api/gmb/location?accountId=${encodeURIComponent(loc.accountId)}&locationId=${encodeURIComponent(loc.locationId)}`),
        );
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'We could not load this location right now.');
        setDetail(data);
      }

      const cat   = getCategory(data);
      const areas = getAreas(data);

      let nextKws = [];

      if (cachedKeywords.length > 0) {
        // Use pre-generated keywords from JSON
        nextKws = cachedKeywords.map(t => makeKwRowFromMerged(cat, areas, t));
        console.log('[Dashboard] Using cached keywords from JSON:', nextKws.length);
      } else {
        // Fallback to on-the-fly generation if not in JSON cache
        nextKws = makeKws(cat, areas);
        try {
          const kwRes = await fetch(apiUrl('/api/ranking/keywords'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessName: (data.title || loc.title || '').trim(),
              primaryCategory: cat || '',
              services: [],
              areas,
            }),
          });
          if (kwRes.ok) {
            const kwData = await kwRes.json().catch(() => ({}));
            const list = Array.isArray(kwData.keywords) ? kwData.keywords : [];
            if (list.length > 0) {
              nextKws = list.map((t) => makeKwRowFromMerged(cat, areas, t));
            }
          }
        } catch (e) {
          console.warn('[GMB Keyword Research] merged keywords fetch failed, using local list only', e);
        }
      }

      setKws(nextKws);
      
      if (!cat)          toast.error('Category not found for this location.', { icon: '⚠️' });
    } catch (e) { 
      toast.error('We couldn\'t load the location details. Please try again.'); 
    } finally { 
      setLoadD(false); 
    }
  }, []);

  /** POST /capture-screenshot and merge path into row (rank row must already be shown). */
  const fetchAndMergeCapture = useCallback(async (idx, kwText, area, r0, opts = {}) => {
    const { silent = false } = opts;
    const businessName = sel?.title || '';

    if (!businessName || (r0?.rank == null && !r0?.mapsLink)) {
      setKws((p) =>
        p.map((k, i) => (i === idx ? { ...k, captureStatus: 'idle' } : k))
      );
      if (!silent) toast.error('Run a keyword search first. Screenshots require a rank or a maps link.');
      return;
    }
    try {
      // Occupy slot
      runningCapturesCountRef.current++;
      setRunningCapturesCount(runningCapturesCountRef.current);

      const res = await fetch(apiUrl('/api/ranking/capture-screenshot'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kwText,
          businessName,
          listingTitle: r0.title || businessName,
          location: area || '',
          mapsLink: r0.mapsLink || null,
          rank: r0.rank ?? null,
          googleSearchUrl: r0.googleSearchUrl || r0.verifyGoogleSearchUrl || null,
          verifyGoogleSearchUrl: r0.verifyGoogleSearchUrl || r0.googleSearchUrl || null,
          gpsCoordinates: r0.gpsCoordinates || null,
          rankSlotOnSerpPage: r0.rankSlotOnSerpPage ?? null,
          localSerpStart: r0.localSerpStart ?? null,
        }),
      });
      const data = await safeReadJsonResponse(res);
      if (!res.ok) {
        if (
          (res.status === 422 || data.serpVerificationFailed) &&
          data.serpVerificationFailed
        ) {
          const msg =
            data.error ||
            'Live SERP page did not match this business (strict verification). No screenshot saved.';
          setKws((p) =>
            p.map((k, i) =>
              i === idx
                ? {
                    ...k,
                    captureStatus: 'idle',
                    screenshotPath: null,
                    error: msg,
                    result: {
                      ...(k.result || {}),
                      serpVerificationFailed: true,
                      results: [
                        {
                          ...(k.result?.results?.[0] || {}),
                          keyword: kwText,
                          rank: null,
                          found: false,
                          serpVerificationFailed: true,
                        },
                      ],
                    },
                  }
                : k
            )
          );
          if (!silent) toast.error(msg);
          return;
        }
        const err = new Error(data.error || 'We could not capture the screenshot right now.');
        err.suppressToast = !!data.suppressToast;
        err.transientErrorKind = data.transientErrorKind || null;
        throw err;
      }
      const obsRank = data.displayRank ?? data.observedAbsoluteOrganicRank ?? null;
      setKws((p) =>
        p.map((k, i) =>
          i === idx
            ? {
                ...k,
                captureStatus: 'done',
                screenshotPath: data.screenshotPath,
                result: {
                  ...(k.result || {}),
                  results: [
                    {
                      ...(k.result?.results?.[0] || {}),
                      keyword: kwText,
                      rank: data.displayRank ?? data.rank ?? k.result?.results?.[0]?.rank ?? null,
                      displayRank: data.displayRank ?? obsRank ?? data.rank ?? null,
                      scanRank: data.scanRank ?? k.result?.results?.[0]?.scanRank ?? null,
                      zenrowsListRank:
                        data.zenrowsListRank ?? k.result?.results?.[0]?.zenrowsListRank ?? null,
                      observedSlotOnPage: data.observedSlotOnPage ?? null,
                      observedAbsoluteRank: data.observedAbsoluteRank ?? null,
                      observedOrganicSlotOnPage: data.observedOrganicSlotOnPage ?? null,
                      observedAbsoluteOrganicRank: data.observedAbsoluteOrganicRank ?? null,
                      observedMatchIsSponsored: data.observedMatchIsSponsored ?? null,
                      observedMatchedHeading: data.observedMatchedHeading ?? null,
                      mapsLink: k.result?.results?.[0]?.mapsLink ?? null,
                      screenshotPath: data.screenshotPath,
                      title: data.title || k.result?.results?.[0]?.title || '',
                      page: data.page || null,
                    },
                  ],
                },
              }
            : k
        )
      );
      if (!silent) {
        const msgRank = obsRank ?? data.rank;
        const apiRank = data.scanRank ?? data.serpApiRank;
        toast.success(
          msgRank != null
            ? `Captured — Google list #${msgRank}` +
                (apiRank != null && msgRank !== apiRank ? ` (DataForSEO #${apiRank})` : '')
            : 'Screenshot captured!'
        );
      }
    } catch (e) {
      const transient = Boolean(e?.suppressToast) || isTransientCaptureMessage(e?.message);
      setKws((p) =>
        p.map((k, i) =>
          i === idx
            ? {
                ...k,
                captureStatus: transient ? 'idle' : 'error',
                error: transient
                  ? (k.error || 'Temporary capture issue, auto-retry recommended.')
                  : k.error,
              }
            : k
        )
      );
      if (!transient) {
        toast.error(
          (silent ? 'Capture Note: ' : 'Oops! Capture failed: ') +
            (e.message || 'System was unable to save the screenshot.')
        );
      }
    } finally {
      // Release slot
      runningCapturesCountRef.current = Math.max(0, runningCapturesCountRef.current - 1);
      setRunningCapturesCount(runningCapturesCountRef.current);
    }
  }, [sel]);

  const fetchTrafficForManualRow = useCallback(async (idx, kwText, area) => {
    try {
      const loc = selRef.current || {};
      const accountId = String(loc.accountId || '').trim();
      const locationId = String(loc.locationId || '').trim();
      if (!accountId || !locationId) return;

      const cacheKey = `${accountId}|${locationId}`;
      let clicks = monthlyClicksCacheRef.current.get(cacheKey);
      if (!clicks) {
        const res = await fetch(
          apiUrl(`/api/gmb/monthly-clicks?accountId=${encodeURIComponent(accountId)}&locationId=${encodeURIComponent(locationId)}`)
        );
        const data = await safeReadJsonResponse(res);
        if (!res.ok || !data?.ok) {
          console.warn('[TrafficSync] /gmb/monthly-clicks failed', { status: res.status, data });
          return;
        }
        clicks = data;
        monthlyClicksCacheRef.current.set(cacheKey, clicks);
      }

      const monthlyClicks = Number(clicks.total_clicks || 0);
      const reportingDays = Math.max(
        1,
        Number(clicks.reporting_days ?? clicks.daysElapsed) || 1
      );
      const dailyAverage = Math.round((monthlyClicks / reportingDays) * 10) / 10;

      setKws(p => p.map((k, i) => {
        if (i !== idx) return k;
        return {
          ...k,
          target_keyword: kwText,
          source_month: clicks.month || 'N/A',
          volume: monthlyClicks,
          daily_traffic: dailyAverage,
          raw_traffic_data: clicks,
          estimated_clicks: monthlyClicks
        };
      }));

      // Best-effort: persist fields into rank_history/tracking JSON (if a snapshot already exists)
      try {
        await fetch(apiUrl('/api/tracking/attach-traffic'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationId,
            businessName: loc.title || '',
            keyword: kwText,
            target_keyword: kwText,
            source_month: clicks.month || 'N/A',
            volume: monthlyClicks,
            daily_traffic: dailyAverage,
            estimated_clicks: monthlyClicks,
            raw_traffic_data: clicks,
          }),
        });
      } catch (e) {
        // ignore tracking persist errors (metric fetch already succeeded)
      }
    } catch (e) {
      console.warn('[TrafficSync] Failed to fetch GBP monthly clicks for manual row:', e);
    }
  }, [detail]);

  /**
   * Auto-trigger volume fetch when rank becomes available (covers all flows, not just automated-run).
   * This is intentionally "best-effort": we avoid duplicate calls via a local Set.
   */
  useEffect(() => {
    const rows = kwsRef.current || [];
    for (let idx = 0; idx < rows.length; idx++) {
      const k = rows[idx];
      if (!k) continue;
      if (!rowHasRankResult(k)) continue;
      if (k.raw_traffic_data || k.source_month) continue;
      const key = `${String(k.text || '').trim().toLowerCase()}|${String(k.area || '').trim().toLowerCase()}`;
      if (trafficFetchedRef.current.has(key)) continue;
      trafficFetchedRef.current.add(key);
      void fetchTrafficForManualRow(idx, k.text, k.area || '');
    }
  }, [kws, fetchTrafficForManualRow]);

  /** Merge keyword row after automated-run: use inline screenshot when server captured in the same request. */
  const onAutomatedRunFound = useCallback(
    (idx, data, kw, captureSilent) => {
      const r0 = data.results?.[0] || {};
      const inlinePath = data.screenshotPath || r0.screenshotPath || null;
      setKws((p) =>
        p.map((k, i) =>
          i === idx
            ? {
                ...k,
                status: 'done',
                result: data,
                captureStatus: inlinePath ? 'done' : 'loading',
                screenshotPath: inlinePath,
                error: null,
              }
            : k
        )
      );
      if (!inlinePath) {
        void fetchAndMergeCapture(idx, kw.text, kw.area || '', r0, { silent: captureSilent });
      }
      // USER REQUEST: Trigger traffic fetch as soon as rank is confirmed
      void fetchTrafficForManualRow(idx, kw.text, kw.area || '');
    },
    [fetchAndMergeCapture, fetchTrafficForManualRow]
  );

  const runOne = useCallback(async (idx, startPage = 1) => {
    const kw = kws[idx];
    if (!kw) return;
    
    // Only set "loading" state if starting from Page 1
    if (startPage === 1) {
      setKws(p => p.map((k, i) => i === idx ? { ...k, status: 'loading', result: null, error: null } : k));
    } else {
      // Update status message for subsequent chunks
      setKws(p => p.map((k, i) => i === idx ? { ...k, status: 'loading', error: `Checking Pages ${startPage}-${startPage+2}...` } : k));
    }

    try {
      const res = await fetch(apiUrl('/api/ranking/automated-run'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName : sel?.title || '',
          keyword      : kw.text,
          location     : kw.area || '',
          startPage    : startPage,
          maxPagesPerChunk: 3,
          captureScreenshotImmediately: false,
        }),
      });

      const data = await safeReadJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'We could not check rankings right now. Please try again.');

      if (data.serpVerificationFailed) {
        setKws((p) =>
          p.map((k, i) =>
            i === idx
              ? {
                  ...k,
                  status: 'done',
                  result: data,
                  captureStatus: 'idle',
                  screenshotPath: null,
                  error:
                    data.message ||
                    data.results?.[0]?.message ||
                    'Live SERP did not match this business (strict verification).',
                }
              : k
          )
        );
        return;
      }

      if (data.found) {
        onAutomatedRunFound(idx, data, kw, true);
      } else if (data.hasMore && data.nextStartPage) {
        // CONTINUITY: Not found yet, but more pages exist
        console.log(`[Dashboard] Business not found in pages ${startPage}-${startPage+2}. Continuing from page ${data.nextStartPage}...`);
        await runOne(idx, data.nextStartPage);
      } else {
        // END: Searched all pages, not found
        setKws(p => p.map((k, i) => i === idx ? { 
          ...k, 
          status: 'done', 
          result: data, 
          captureStatus: 'idle',
          screenshotPath: null,
          error: data.message || 'Not found in top 100 results.'
        } : k));
      }
    } catch (e) {
      setKws(p => p.map((k, i) => i === idx ? { ...k, status: 'error', error: e.message } : k));
    }
  }, [kws, sel, detail, onAutomatedRunFound]);

  const captureOne = useCallback(async idx => {
    if (!sel) return;
    const kw = kws[idx];
    const kwText = kw?.text;
    if (!kwText) return;
    setKws(p => p.map((k, i) => i === idx ? { ...k, captureStatus: 'loading' } : k));
    const prev = kw?.result?.results?.[0] || {};
    await fetchAndMergeCapture(idx, kwText, kw?.area || '', prev, { silent: false });
  }, [sel, kws, fetchAndMergeCapture]);

  const persistGalleryToServer = useCallback(async ({ openInNewTab = false, silentOnNoItems = false } = {}) => {
    const loc = selRef.current;
    const rows = kwsRef.current;
    if (!loc) return { ok: false, reason: 'no-sel' };
    const items = rows
      .filter((k) => k.status === 'done' && k.screenshotPath)
      .map((k) => ({
        keyword: k.text,
        screenshotPath: k.screenshotPath,
        rank:
          k.result?.results?.[0]?.displayRank ??
          k.result?.results?.[0]?.observedAbsoluteOrganicRank ??
          k.result?.results?.[0]?.rank ??
          null,
        page: k.result?.results?.[0]?.page ?? null,
        target_keyword: k.target_keyword || k.text,
        source_month: k.source_month,
        volume: k.volume,
        daily_traffic: k.daily_traffic,
        estimated_clicks: k.estimated_clicks,
        raw_traffic_data: k.raw_traffic_data
      }));
    if (!items.length) {
      if (!silentOnNoItems) {
        toast.error('No results found yet. Please complete a search with rankings first.');
      }
      return { ok: false, reason: 'no-items' };
    }
    setGallerySaveBusy(true);
    try {
      const res = await fetch(apiUrl('/api/gallery/gmb-keywords'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: loc.title || '',
          locationHint: '',
          accountId: loc.accountId || '',
          locationId: loc.locationId || '',
          items,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not save this gallery right now.');
      if (!data.publicId) throw new Error('We could not finish saving this gallery right now.');
      if (openInNewTab) {
        window.open(
          data.galleryUrl || `${window.location.origin}/gmb-keyword-gallery/${data.publicId}`,
          '_blank',
          'noopener,noreferrer'
        );
      }
      return { ok: true, publicId: data.publicId, galleryUrl: data.galleryUrl };
    } catch (e) {
      toast.error('We couldn\'t generate the gallery link. Please try again.');
      return { ok: false, reason: 'error' };
    } finally {
      setGallerySaveBusy(false);
    }
  }, []);

  const saveAndOpenGallery = useCallback(() => persistGalleryToServer({ openInNewTab: true, silentOnNoItems: false }), [persistGalleryToServer]);

  const persistTrackingFromGallery = useCallback(async ({ publicId, galleryUrl } = {}) => {
    const id = String(publicId || '').trim();
    if (!id) return { ok: false, reason: 'no-public-id' };
    try {
      const pageUrl =
        String(galleryUrl || '').trim() ||
        (typeof window !== 'undefined' ? `${window.location.origin}/gmb-keyword-gallery/${id}` : '');
      const res = await fetch(apiUrl('/api/tracking/save-from-gallery'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId: id,
          confirmCompare: true, // auto-confirm to avoid manual modal step
          galleryPageUrl: pageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not save the tracking snapshot right now.');
      if (!data.saved && data.needsConfirm) {
        // Safety fallback: retry once with confirm enabled.
        const retryRes = await fetch(apiUrl('/api/tracking/save-from-gallery'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicId: id,
            confirmCompare: true,
            galleryPageUrl: pageUrl,
          }),
        });
        const retryData = await retryRes.json().catch(() => ({}));
        if (!retryRes.ok || !retryData.saved) {
          throw new Error(retryData.error || 'We could not save the tracking snapshot right now.');
        }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'error' };
    }
  }, []);

  const resetRowToFreshSearch = useCallback((k) => ({
    ...k,
    status: 'idle',
    result: null,
    error: null,
    captureStatus: 'idle',
    screenshotPath: null,
  }), []);

  const handleStopModal1Cancel = useCallback(() => {
    setStopModalStep(null);
  }, []);

  /** Modal 1 Yes: stop queue (no new keyword searches); open modal 2 for rank-only screenshots. */
  const handleStopModal1Continue = useCallback(() => {
    setStopModalStats(pickStopModalStats(kwsRef.current));
    modal1YesClickedRef.current = true;
    stopRequestedRef.current = true;
    setStopModalStep('detail');
  }, []);

  const handleStopModal2ConfirmCapture = useCallback(async () => {
    modalHandledByRef.current = true;
    setStopModalStep(null); // Close modal immediately after Yes
    setStopModalBusy(true);
    try {
      const n = kwsRef.current.length;
      for (let i = 0; i < n; i++) {
        const k = kwsRef.current[i];
        if (!rowHasRankResult(k) || k.screenshotPath) continue;
        const r0 = k.result?.results?.[0] || {};
        await fetchAndMergeCapture(i, k.text, k.area || '', r0, { silent: false });
      }
      await waitUntilCaptureSlotsIdle(() => runningCapturesCountRef.current);
      // Give state/ref sync a short tick so latest screenshot paths are included in gallery JSON.
      await new Promise((resolve) => setTimeout(resolve, 200));
      const persistResult = await persistGalleryToServer({ openInNewTab: false, silentOnNoItems: true });
      if (persistResult.ok) {
        const trackingResult = await persistTrackingFromGallery({
          publicId: persistResult.publicId,
          galleryUrl: persistResult.galleryUrl,
        });
        toast.success(
          trackingResult.ok
            ? 'Auto-save is complete. Gallery and tracking JSON are both updated.'
            : 'Gallery auto-save is complete, but tracking JSON could not be updated right now.',
          { duration: 5500, icon: '✅' }
        );
      } else if (persistResult.reason === 'no-items') {
        toast.success(
          'Capture is complete. There were no screenshot rows to save yet.',
          { duration: 4500, icon: '✅' }
        );
      } else {
        toast.success(
          'Capture is complete, but we could not auto-save to Gallery. Please open Gallery and try again.',
          { duration: 5000, icon: '✅' }
        );
      }
    } catch (e) {
      toast.error('We could not finish the remaining screenshots. You can retry Search & Capture per keyword.');
    } finally {
      setStopModalBusy(false);
      setStopModalStep(null);
      runAllBarrierResolveRef.current?.();
      runAllBarrierResolveRef.current = null;
      setRunAll_(false);
    }
  }, [fetchAndMergeCapture, persistGalleryToServer]);

  /** No: reset rows that have rank but no screenshot — back to Search & Capture. */
  const handleStopModal2SkipCapture = useCallback(async () => {
    modalHandledByRef.current = true;
    setStopModalStep(null);
    setStopModalBusy(true);
    setKws((prev) =>
      prev.map((k) => {
        if (k.status === 'done' && rowHasRankResult(k) && !k.screenshotPath) {
          return resetRowToFreshSearch(k);
        }
        if (k.status === 'loading') {
          return resetRowToFreshSearch(k);
        }
        if (k.status === 'error') {
          return resetRowToFreshSearch(k);
        }
        return k;
      })
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const persistResult = await persistGalleryToServer({ openInNewTab: false, silentOnNoItems: true });
      if (persistResult.ok) {
        const trackingResult = await persistTrackingFromGallery({
          publicId: persistResult.publicId,
          galleryUrl: persistResult.galleryUrl,
        });
        toast.success(
          trackingResult.ok
            ? 'Auto-save is complete. Existing screenshots are saved to gallery and tracking JSON.'
            : 'Gallery auto-save is complete, but tracking JSON could not be updated right now.',
          { duration: 5500, icon: '✅' }
        );
      } else if (persistResult.reason === 'no-items') {
        toast.success(
          'Stopped. Rank-only rows were reset, and there were no screenshot rows to save yet.',
          { duration: 5500, icon: '✅' }
        );
      } else {
        toast.success(
          'Stopped. Rank-only rows were reset, but auto-save could not complete. Please open Gallery and try again.',
          { duration: 5500, icon: '✅' }
        );
      }
    } finally {
      setStopModalBusy(false);
      runAllBarrierResolveRef.current?.();
      runAllBarrierResolveRef.current = null;
      setRunAll_(false);
    }
  }, [persistGalleryToServer, resetRowToFreshSearch]);

  const runAll = useCallback(async () => {
    if (runAll_ || !kws.length) return;
    stopRequestedRef.current = false;
    modal1YesClickedRef.current = false;
    modalHandledByRef.current = false;
    let resolveBarrierRun = null;
    const barrierPromise = new Promise((r) => {
      resolveBarrierRun = r;
    });
    runAllBarrierResolveRef.current = resolveBarrierRun;

    setRunAll_(true);
    setKws(p => p.map(k => ({ ...k, status: 'idle', result: null, error: null })));

    // Run in controlled parallel batches to keep calls fast without sudden request spikes.
    const CONCURRENCY = RUN_ALL_PARALLEL_CALLS;
    const queue = Array.from({ length: kws.length }, (_, i) => i);

    const internalRun = async (idx, startPage = 1) => {
      const kw = kws[idx];
      if (startPage === 1) {
        setKws(p => p.map((k, j) => j === idx ? { ...k, status: 'loading', result: null, error: null } : k));
      } else {
        setKws(p => p.map((k, j) => j === idx ? { ...k, status: 'loading', error: `Checking Pages ${startPage}-${startPage+2}...` } : k));
      }

      try {
        const res = await fetch(apiUrl('/api/ranking/automated-run'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName : sel?.title || '',
            keyword      : kw.text,
            location     : kw.area || '',
            startPage    : startPage,
            maxPagesPerChunk: 3,
            maxDepth: RUN_ALL_DEPTH_LIMIT,
            captureScreenshotImmediately: false,
          }),
        });

        const data = await safeReadJsonResponse(res);
        if (!res.ok) throw new Error(data.error || 'Failed');

        if (data.serpVerificationFailed) {
          setKws((p) =>
            p.map((k, j) =>
              j === idx
                ? {
                    ...k,
                    status: 'done',
                    result: data,
                    captureStatus: 'idle',
                    screenshotPath: null,
                    error:
                      data.message ||
                      data.results?.[0]?.message ||
                      'Live SERP did not match this business (strict verification).',
                  }
                : k
            )
          );
          return false;
        }

        if (data.found) {
          onAutomatedRunFound(idx, data, kw, true);
          return true;
        } else if (data.hasMore && data.nextStartPage) {
          return await internalRun(idx, data.nextStartPage);
        } else {
          setKws(p => p.map((k, j) => j === idx ? {
            ...k,
            status: 'done',
            result: data,
            captureStatus: 'idle',
            screenshotPath: null,
            error: 'Not found in top results'
          } : k));
          return false;
        }
      } catch (e) {
        setKws(p => p.map((k, j) => j === idx ? { ...k, status: 'error', error: e.message } : k));
        return false;
      }
    };

    while (queue.length > 0) {
      if (stopRequestedRef.current) break;
      const currentBatch = queue.splice(0, CONCURRENCY);
      const batchPromises = [];

      for (let i = 0; i < currentBatch.length; i++) {
        if (stopRequestedRef.current) break;
        // THROTTLE: If we already have 15 captures running, wait for one to finish.
        if (runningCapturesCountRef.current >= MAX_CONCURRENT_CAPTURES) {
          console.log(`[Dashboard] Waiting for Scrapfly slot... (${runningCapturesCountRef.current} active)`);
          await new Promise(resolve => {
            const check = setInterval(() => {
              if (runningCapturesCountRef.current < MAX_CONCURRENT_CAPTURES) {
                clearInterval(check);
                resolve();
              }
            }, 1000);
          });
        }

        batchPromises.push(internalRun(currentBatch[i]));
        if (i < currentBatch.length - 1) {
          await new Promise(r => setTimeout(r, RUN_ALL_DELAY_BETWEEN_CALLS_MS));
        }
      }

      await Promise.all(batchPromises);
      if (queue.length > 0 && !stopRequestedRef.current) {
        await new Promise(r => setTimeout(r, RUN_ALL_DELAY_BETWEEN_BATCHES_MS));
      }
    }

    await waitUntilCaptureSlotsIdle(() => runningCapturesCountRef.current);

    if (modal1YesClickedRef.current) {
      await barrierPromise;
    }

    if (modalHandledByRef.current) {
      setRunAll_(false);
      runAllBarrierResolveRef.current = null;
      return;
    }

    const stopped = stopRequestedRef.current;
    const persistResult = await persistGalleryToServer({ openInNewTab: false, silentOnNoItems: true });

    setRunAll_(false);
    runAllBarrierResolveRef.current = null;

    if (persistResult.ok) {
      const trackingResult = await persistTrackingFromGallery({
        publicId: persistResult.publicId,
        galleryUrl: persistResult.galleryUrl,
      });
      toast.success(
        stopped
          ? (trackingResult.ok
              ? 'Search stopped. Gallery and tracking JSON were saved automatically.'
              : 'Search stopped. Gallery was saved, but tracking JSON could not be updated right now.')
          : (trackingResult.ok
              ? 'All searches are done. Gallery and tracking JSON were saved automatically.'
              : 'All searches are done. Gallery was saved, but tracking JSON could not be updated right now.'),
        { duration: 5500, icon: '✅' }
      );
    } else if (persistResult.reason === 'no-items') {
      toast.success(
        stopped ? 'Search stopped.' : 'Great! All keyword searches are complete.',
        { duration: 5000, icon: '✅' }
      );
    } else if (persistResult.reason === 'error') {
      if (!stopped) {
        toast.success('Great! All keyword searches are complete.', { duration: 5000, icon: '✅' });
      } else {
        toast.success('Search stopped.', { duration: 4500, icon: '✅' });
      }
    } else {
      toast.success(
        stopped ? 'Search stopped.' : 'Great! All keyword searches are complete.',
        { duration: 5000, icon: '✅' }
      );
    }
  }, [runAll_, kws, sel, detail, onAutomatedRunFound, persistGalleryToServer]);

  /* derived */
  const filtered  = q.trim() ? locs.filter(l => l.title.toLowerCase().includes(q.toLowerCase())) : locs;
  const category  = detail ? getCategory(detail) : null;
  const areas     = detail ? getAreas(detail) : [];
  const svcAreaSubtitle =
    sel?.serviceAreasSource === 'gbp_explicit'
      ? 'From GBP service-area settings.'
      : sel?.serviceAreasSource === 'gbp_storefront_address' && areas.length > 0
        ? 'From GBP storefront address (Business Profile locality).'
        : null;
  const done      = kws.filter(k => k.status === 'done').length;
  const withShots = kws.filter(k => k.status === 'done' && k.screenshotPath).length;
  const errs      = kws.filter(k => k.status === 'error').length;
  const pend      = kws.filter(k => k.status === 'idle').length;
  const pct       = kws.length ? Math.round((done / kws.length) * 100) : 0;

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="w-full space-y-4 sm:space-y-5">
      <div className="rounded-2xl shadow-sm g-up border border-gray-900/10" ref={wrapRef} style={{ position: 'relative', zIndex: 10 }}>
        <div className="bg-white px-5 py-5 sm:px-7 sm:py-6 rounded-2xl">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">
            Select GMB Location
          </p>

          {/* trigger button */}
          <button
            type="button"
            onClick={() => { if (!loadL) setOpen(o => !o); }}
            className={`
              w-full flex items-center gap-3 rounded-xl border bg-white text-sm sm:text-[15px]
              transition-all duration-200 px-4 py-3 sm:py-3.5
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sage/25
              ${open ? 'border-brand-sage shadow-md ring-2 ring-brand-sage/15' : 'border-gray-200 hover:border-gray-300 shadow-sm'}
            `}
          >
            <span className="flex-shrink-0 text-gray-400">
              {loadL  ? <Spin sz={4} col="text-gray-400" />
               : sel  ? <span className="w-2.5 h-2.5 rounded-full bg-brand-sage block" />
               :        <Ic.Bldg className="w-[18px] h-[18px]" />}
            </span>
            <span className={`flex-1 text-left truncate ${sel ? 'font-semibold text-brand-midnight' : 'text-gray-400 font-normal'}`}>
              {loadL ? 'Loading locations…' : lErr ? 'Error loading locations' : sel ? sel.title : 'Search or select a GMB location…'}
            </span>
            <span className="flex items-center gap-2 flex-shrink-0">
              {sel && !open && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); clear(); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); clear(); } }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Clear"
                >
                  <Ic.X className="w-3.5 h-3.5" />
                </span>
              )}
              <Ic.Chevron className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {/* dropdown panel — positioned relative to the outer card (wrapRef) */}
          {open && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-[200] bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden g-pop" style={{ marginLeft: 0, marginRight: 0 }}>
              {/* search */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <Ic.Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input ref={inpRef} type="text" value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Filter locations…"
                  className="flex-1 bg-transparent text-sm text-brand-midnight placeholder-gray-400 outline-none" />
                {q ? <button type="button" onClick={() => setQ('')} className="p-0.5 text-gray-400 hover:text-gray-700"><Ic.X className="w-3 h-3" /></button>
                   : <span className="text-[11px] text-gray-400 tabular-nums">{locs.length}</span>}
              </div>
              {/* list */}
              <ul style={{ maxHeight: 252, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
                {filtered.length === 0
                  ? <li className="flex flex-col items-center gap-2 py-8 text-center">
                      <Ic.Bldg className="w-7 h-7 text-gray-300" />
                      <span className="text-sm text-gray-400">{locs.length === 0 ? 'No locations — POST /api/services-keywords/rebuild or wait for 5 PM cron' : 'No matches'}</span>
                    </li>
                  : filtered.map((loc, i) => {
                    const active =
                      sel &&
                      String(sel.accountId) === String(loc.accountId) &&
                      String(sel.locationId) === String(loc.locationId);
                    return (
                      <li key={`${loc.accountId}:${loc.locationId}`} className={i ? 'border-t border-gray-50' : ''}>
                        <button type="button" onClick={() => pick(loc)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${active ? 'bg-brand-frost text-brand-pine font-semibold' : 'text-gray-700 hover:bg-gray-50/80'}`}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-brand-sage' : 'bg-gray-200'}`} />
                          <span className="truncate flex-1 text-left">{loc.title}</span>
                          {active && <Ic.Check className="w-3.5 h-3.5 text-brand-sage flex-shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
              </ul>
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400">
                <div className="flex items-center gap-2">
                  <span>{filtered.length} of {locs.length} location{locs.length !== 1 ? 's' : ''}</span>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); refreshLocations(); }} 
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-white hover:border-brand-sage hover:text-brand-sage transition-all active:scale-95"
                    title="Clear cache and re-fetch from GMB"
                  >
                    <Ic.Refresh className={`w-2.5 h-2.5 ${loadL ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                {lErr && <span className="text-red-400 truncate max-w-[180px]">{lErr}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ╔══════════════════════════════════════════╗
          ║  LOADING SKELETON                        ║
          ╚══════════════════════════════════════════╝ */}
      {loadD && (
        <div className="space-y-4 g-fade">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0,1].map(n => (
              <div key={n} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-3">
                <Bone w={100} h="h-2.5" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2"><Bone w={140} h="h-4" /><Bone w={80} h="h-2.5" /></div>
                </div>
                {n === 1 && <div className="flex flex-wrap gap-1.5">{[70,100,60,90,75,55].map(w => <Bone key={w} w={w} h="h-6 rounded-lg" />)}</div>}
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="space-y-2"><Bone w={160} h="h-5" /><Bone w={100} h="h-3" /></div>
              <div className="w-28 h-10 rounded-xl bg-gray-200 animate-pulse" />
            </div>
            {[1,2,3,4].map(n => (
              <div key={n} className="flex items-center gap-4 px-5 sm:px-6 py-4 border-b border-gray-50 last:border-0">
                <Bone w={24} h="h-3.5" /><Bone h="h-3.5 flex-1" /><div className="w-20 h-8 rounded-xl bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ╔══════════════════════════════════════════╗
          ║  DETAIL PANELS                           ║
          ╚══════════════════════════════════════════╝ */}
      {detail && !loadD && (
        <>
          {/* ── info row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Category card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden g-up" style={{ animationDelay:'0ms' }}>
              {/* coloured top strip */}
              <div className="h-1 w-full bg-gradient-to-r from-brand-sage to-brand-forest" />
              <div className="p-5 sm:p-6">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3 sm:mb-4">
                  Primary Category
                </p>
                {category ? (
                  <div className="flex items-start gap-3.5 g-slide">
                    <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-brand-sage/10 border border-brand-sage/20 flex items-center justify-center text-brand-forest">
                      <Ic.Tag className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-base sm:text-xl font-extrabold text-brand-midnight leading-tight tracking-tight truncate">{category}</p>
                      <p className="text-xs text-gray-400 mt-1">Primary business category</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 g-slide">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 flex-shrink-0">
                      <Ic.Warn className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500">No primary category configured</p>
                  </div>
                )}
              </div>
            </div>

            {/* Service areas card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden g-up" style={{ animationDelay:'55ms' }}>
              <div className="h-1 w-full bg-gradient-to-r from-green-600 to-emerald-600" />
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                    Service Areas
                  </p>
                  {areas.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-brand-sage/15 text-brand-pine text-[11px] font-bold px-2">
                      {areas.length}
                    </span>
                  )}
                </div>
                {svcAreaSubtitle && (
                  <p className="text-[11px] text-brand-pine/80 mb-3 sm:mb-4 font-medium">{svcAreaSubtitle}</p>
                )}
                {areas.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" style={{ maxHeight: 120, overflowY: 'auto', scrollbarWidth: 'none' }}>
                    {areas.map((a, i) => (
                      <span key={a} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:border-brand-sage/40 hover:bg-brand-frost transition-colors px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs text-gray-700 whitespace-nowrap g-up"
                        style={{ animationDelay: `${i * 25}ms` }}>
                        <Ic.Pin className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-brand-sage flex-shrink-0" />
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 flex-shrink-0">
                      <Ic.Warn className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500">
                      No service-area regions or storefront address returned from GBP for this listing yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── keywords table ── */}
          {kws.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden g-up" style={{ animationDelay:'100ms' }}>

              {/* table header */}
              <div className="bg-gray-50/70 border-b border-gray-100 px-5 sm:px-6 py-4 sm:py-5">
                <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 sm:gap-4">

                  {/* left: icon + title */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand-midnight/5 border border-brand-midnight/10 flex items-center justify-center text-brand-midnight">
                      <Ic.Layers className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base sm:text-xl font-extrabold text-brand-midnight tracking-tight leading-none">Generated Keywords</p>
                      <p className="text-xs sm:text-sm text-gray-400 mt-0.5 tabular-nums">
                        <span className="text-brand-pine font-semibold">{done}</span>/{kws.length} done
                        {errs > 0 && <span className="ml-2 text-red-400">{errs} error{errs !== 1 ? 's' : ''}</span>}
                        {pend > 0 && done > 0 && <span className="ml-2 text-gray-300">{pend} pending</span>}
                      </p>
                    </div>
                  </div>

                  {/* action buttons */}
                  <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4 sm:mt-0">
                    <button type="button" onClick={runAll} disabled={runAll_}
                      className="flex items-center justify-center gap-2 rounded-xl bg-brand-midnight hover:bg-brand-pine active:scale-95 text-white font-bold text-sm sm:text-[15px] px-5 sm:px-6 py-3 sm:py-3 shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none tracking-wide">
                      {runAll_
                        ? <><Spin sz={4} col="text-white" /><span>Searching…</span></>
                        : <><Ic.Search className="w-4 h-4" /><span>Search All</span></>
                      }
                    </button>
                    {runAll_ && (
                      <button
                        type="button"
                        onClick={() => setStopModalStep('confirm')}
                        className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 font-bold text-sm sm:text-[15px] px-4 sm:px-5 py-3 sm:py-3 shadow-sm transition-all tracking-wide"
                      >
                        <Ic.X className="w-4 h-4" />
                        <span>Stop</span>
                      </button>
                    )}
                    {withShots > 0 && (
                      <button
                        type="button"
                        onClick={saveAndOpenGallery}
                        disabled={gallerySaveBusy}
                        className="flex items-center justify-center gap-2 rounded-xl border-2 border-brand-sage bg-brand-sage/10 hover:bg-brand-sage/20 active:scale-95 text-brand-forest font-bold text-sm sm:text-[15px] px-4 sm:px-5 py-3 sm:py-3 shadow-sm transition-all tracking-wide g-fade disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {gallerySaveBusy ? (
                          <>
                            <Spin sz={4} col="text-brand-forest" />
                            <span>Saving…</span>
                          </>
                        ) : (
                          <>
                            <Ic.Gallery className="w-4 h-4" />
                            <span>View Gallery</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* progress */}
                {done > 0 && (
                  <div className="mt-4 g-fade">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-500 font-medium">Search progress</span>
                      <span className="font-bold tabular-nums text-brand-pine">{pct}%</span>
                    </div>
                    <div className="relative w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-sage via-brand-forest to-brand-pine transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* column header row — mirrors KwRow flex layout exactly for pixel-perfect alignment */}
              <div className="hidden sm:flex items-center gap-3 sm:pl-7 sm:pr-5 py-2.5 bg-gray-50/40 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                <span className="flex-shrink-0 w-7 text-right">#</span>
                <div className="flex-shrink-0 w-px invisible" />{/* matches the row divider width */}
                <span className="flex-1">Keyword</span>
                <span className="w-48 text-right pr-4">Action</span>
              </div>

              {/* rows */}
              <div className="divide-y divide-gray-50/80">
                {kws.map((kw, idx) => (
                  <KwRow key={`gmb-kw-${idx}-${kw.text}`} kw={kw} idx={idx} delay={idx * 30} onRun={() => runOne(idx)} onCapture={() => captureOne(idx)} disabled={runAll_ || kw.captureStatus === 'loading'} />
                ))}
              </div>

              {/* footer */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-3 bg-gray-50/50 border-t border-gray-100">
                <span className="text-[11px] sm:text-xs text-gray-400">{kws.length} keyword{kws.length !== 1 ? 's' : ''} total</span>
                <span className="text-[11px] sm:text-xs text-gray-400 tabular-nums">{done} searched · {pend} pending</span>
              </div>
            </div>
          )}

          {/* no keywords empty */}
          {kws.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-14 sm:py-20 flex flex-col items-center text-center g-up" style={{ animationDelay:'80ms' }}>
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 mb-4">
                <Ic.Warn className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-brand-midnight">Waiting for keywords...</p>
              <p className="text-sm sm:text-[15px] text-gray-400 mt-2 max-w-xs sm:max-w-sm leading-relaxed">
                If keywords don't appear, ensure the location has a <strong className="text-gray-600 font-semibold">category</strong> and <strong className="text-gray-600 font-semibold">city/service areas</strong> defined in GMB.
              </p>
            </div>
          )}
        </>
      )}

      {/* ╔══════════════════════════════════════════╗
          ║  WELCOME EMPTY STATE                     ║
          ╚══════════════════════════════════════════╝ */}
      {!sel && !loadD && (
        <div className="relative bg-white rounded-2xl border border-dashed border-gray-200 overflow-hidden px-5 py-12 sm:py-16 lg:py-20 flex flex-col items-center text-center g-up" style={{ animationDelay:'80ms' }}>
          {/* background decoration */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-sage via-brand-forest to-brand-midnight" />
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-brand-sage/4 pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-brand-mint/20 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-brand-sage/10 border border-brand-sage/20 flex items-center justify-center text-brand-forest mb-5 sm:mb-6">
              <Ic.Pin className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-brand-midnight tracking-tight">Select a GMB Location</p>
            <p className="text-sm sm:text-[15px] text-gray-400 mt-2 sm:mt-3 max-w-xs sm:max-w-sm leading-relaxed">
              Pick a location from the dropdown above. Keywords auto-load from category, service areas, and OpenAI (when configured).
            </p>
            {!loadL && locs.length > 0 && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 px-4 py-2">
                <Ic.Bldg className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">{locs.length} location{locs.length !== 1 ? 's' : ''} available</span>
              </div>
            )}
            {loadL && (
              <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
                <Spin sz={3} col="text-gray-400" /><span>Loading locations…</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: stop further keyword searches (not yet searched). Modal 2: capture rank-only rows or reset. */}
      {stopModalStep === 'confirm' && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gmb-stop-modal-1-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-slate-900/15 p-6 sm:p-8 g-pop">
            <h2 id="gmb-stop-modal-1-title" className="text-lg sm:text-xl font-extrabold text-brand-midnight tracking-tight">
              Stop Analysis?
            </h2>
            <p className="mt-3 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
              <strong className="text-brand-midnight">Yes</strong> will stop <strong>new keyword searches</strong> — keywords
              not searched yet will not run. The current keyword (if any) finishes first. Results you already have (rank + optional
              screenshot) stay as they are. Next step: choose whether to capture screenshots for rows that have rank only.
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleStopModal1Cancel}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel — keep running
              </button>
              <button
                type="button"
                onClick={handleStopModal1Continue}
                className="rounded-xl bg-brand-midnight px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-pine transition-colors shadow-sm"
              >
                Yes — stop further searches
              </button>
            </div>
          </div>
        </div>
      )}

      {stopModalStep === 'detail' && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gmb-stop-modal-2-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-slate-900/15 p-6 sm:p-8 g-pop max-h-[90vh] overflow-y-auto">
            <h2 id="gmb-stop-modal-2-title" className="text-lg sm:text-xl font-extrabold text-brand-midnight tracking-tight">
              Screenshots for rank-only rows?
            </h2>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">Snapshot when you stopped:</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-800">
              <li className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span className="text-gray-500">Keywords with a rank found</span>
                <span className="font-bold tabular-nums">{stopModalStats.rankFound}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span className="text-gray-500">Rank + screenshot saved</span>
                <span className="font-bold tabular-nums">{stopModalStats.withScreenshot}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span className="text-gray-500">Rank found, screenshot still pending</span>
                <span className="font-bold tabular-nums text-amber-700">{stopModalStats.needCapture}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span className="text-gray-500">Not searched yet (will stay)</span>
                <span className="font-bold tabular-nums">{stopModalStats.notStarted}</span>
              </li>
            </ul>
            <p className="mt-5 text-sm sm:text-[15px] text-gray-700 leading-relaxed">
              {stopModalStats.needCapture > 0 ? (
                <>
                  <strong>Yes</strong> runs Scrapfly capture for the <strong>{stopModalStats.needCapture}</strong> row
                  {stopModalStats.needCapture !== 1 ? 's' : ''} with rank but no screenshot yet, then saves the gallery.
                  <strong> No</strong> — resets those rows to <strong>Search &amp; Capture</strong> (rank cleared) so you can run them later.
                </>
              ) : (
                <>No rank-only rows pending capture. You can close — the run will finish.</>
              )}
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button
                type="button"
                disabled={stopModalBusy}
                onClick={handleStopModal2SkipCapture}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                No — reset rank-only rows
              </button>
              <button
                type="button"
                disabled={stopModalBusy}
                onClick={handleStopModal2ConfirmCapture}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {stopModalBusy ? <Spin sz={4} col="text-white" /> : null}
                {stopModalBusy ? 'Working…' : 'Yes — capture & save gallery'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   KEYWORD ROW
══════════════════════════════════════════════════════════════════ */
function KwRow({ kw, idx, delay, onRun, onCapture, disabled }) {
  const accent = ROW_ACCENT[kw.status] || ROW_ACCENT.idle;
  return (
    <div className={`relative g-slide g-hover transition-colors ${kw.status === 'loading' ? 'bg-brand-frost/25' : ''}`}
      style={{ animationDelay: `${delay}ms` }}>
      {/* left status accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accent} transition-colors duration-300 rounded-r-full`} />

      <div className="flex items-center gap-3 pl-5 pr-4 sm:pl-7 sm:pr-5 py-3.5 sm:py-4">
        {/* plain zero-padded number */}
        <span className="flex-shrink-0 w-7 text-right text-sm sm:text-base font-bold text-gray-300 tabular-nums select-none pt-0.5 font-mono">
          {String(idx + 1).padStart(2, '0')}
        </span>

        {/* thin divider */}
        <div className="flex-shrink-0 w-px self-stretch bg-gray-100 my-0.5" />

        {/* content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            {/* live dot */}
            {kw.status === 'loading'
              ? <Spin sz={3} col="text-amber-400" />
              : <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300
                  ${kw.status === 'done' ? 'bg-emerald-400' : kw.status === 'error' ? 'bg-red-400' : 'bg-gray-200'}`} />
            }
            <span className="text-[13px] sm:text-sm lg:text-[15px] font-medium text-brand-midnight break-all sm:break-words leading-snug">
              {kw.text}
            </span>
          </div>

          {kw.status === 'done' && kw.result && <KwAddress result={kw.result} />}
          {kw.status === 'error' && <p className="mt-1.5 text-xs text-red-500 leading-relaxed">{kw.error}</p>}

          {/* screenshot inline link (shown once captured) */}
          {kw.screenshotPath && kw.status === 'done' && (
            <div className="mt-2 g-fade">
              <a href={outputsAssetUrl(kw.screenshotPath)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-forest hover:text-brand-pine underline underline-offset-2 transition-colors">
                <Ic.Camera className="w-3.5 h-3.5" />View Screenshot
              </a>
            </div>
          )}

          {/* mobile action area */}
          <div className="mt-3 sm:hidden flex flex-col gap-2">
            {kw.status === 'done' && kw.result && (
              <div className="flex items-center justify-between bg-gray-50/50 rounded-xl p-2.5 border border-gray-100">
                <KwRank result={kw.result} />
                <SearchCaptureBtn kw={kw} onRun={onRun} disabled={disabled} />
              </div>
            )}
            {(kw.status !== 'done' || !kw.result) && (
              <SearchCaptureBtn kw={kw} onRun={onRun} disabled={disabled} />
            )}
          </div>
        </div>

        {/* desktop action area */}
        <div className="hidden sm:flex items-center justify-end gap-3 flex-shrink-0 w-48 pr-1">
          {kw.status === 'done' && kw.result && <KwRank result={kw.result} />}
          <SearchCaptureBtn kw={kw} onRun={onRun} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

/* ─── search & capture combined button ─── */
function SearchCaptureBtn({ kw, onRun, disabled }) {
  if (kw.status === 'loading') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 text-xs sm:text-[13px] font-semibold px-3.5 py-2">
        <Spin sz={3} col="text-amber-400" />
        <span>Running…</span>
      </div>
    );
  }

  if (kw.status === 'done' && kw.captureStatus === 'loading') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-xs sm:text-[13px] font-semibold px-3.5 py-2 opacity-90">
        <Spin sz={3} col="text-sky-500" />
        <span>Screenshot…</span>
      </div>
    );
  }

  const map = {
    idle:  { label:'Search & Capture', icon:<Ic.Search className="w-3.5 h-3.5" />, cls:'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white' },
    done:  { label:'Re-run',           icon:<Ic.Refresh className="w-3.5 h-3.5" />, cls:'border-gray-200 bg-white text-gray-400 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' },
    error: { label:'Retry',            icon:<Ic.Refresh className="w-3.5 h-3.5" />, cls:'border-red-200 bg-white text-red-500 hover:bg-red-50' },
  };
  const s = map[kw.status] || map.idle;
  
  return (
    <button type="button" onClick={onRun} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-xl border text-xs sm:text-[13px] font-bold px-4 py-2.5 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${s.cls}`}>
      {s.icon}{s.label}
    </button>
  );
}

/* ─── Prefer DOM/Scrapfly rank after capture; else API rank ─── */
function effectiveListRank(r) {
  if (r == null) return null;
  if (r.displayRank != null && Number.isFinite(Number(r.displayRank))) return Number(r.displayRank);
  if (r.rank != null && Number.isFinite(Number(r.rank))) return Number(r.rank);
  return null;
}

/* ─── result address subset ─── */
function KwAddress({ result }) {
  const all = result?.results || [];
  const found = all.filter((r) => effectiveListRank(r) != null);
  const best =
    found.sort((a, b) => (effectiveListRank(a) ?? 99999) - (effectiveListRank(b) ?? 99999))[0] || null;

  if (!best || !best.address) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2.5 text-xs g-fade">
      <span className="text-gray-400 truncate max-w-[160px] sm:max-w-[240px] lg:max-w-[340px]">
        {best.address}
      </span>
    </div>
  );
}

/* ─── rank display for action area (Google on-page organic when captured, else SerpAPI) ─── */
function KwRank({ result }) {
  const all = result?.results || [];
  const found = all.filter((r) => effectiveListRank(r) != null);
  const best =
    found.sort((a, b) => (effectiveListRank(a) ?? 99999) - (effectiveListRank(b) ?? 99999))[0] || null;

  if (!best) return <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Not Found</span>;

  const shown = best.displayRank ?? best.rank;
  const scanVal = best.scanRank;
  const zenList = best.zenrowsListRank;
  const differsScan = scanVal != null && shown !== scanVal;
  const differsZen  = zenList != null && shown !== zenList;

  return (
    <div className="flex items-center gap-1.5 g-fade flex-wrap">
      <span className="text-[10px] font-black uppercase tracking-widest text-brand-forest/60">Rank</span>
      <RankBadge rank={shown} />
      {differsScan && (
        <span className="text-[9px] text-gray-400 font-medium" title="DataForSEO order">
          API #{scanVal}
        </span>
      )}
      {!differsScan && differsZen && (
        <span className="text-[9px] text-gray-400 font-medium" title="ZenRows scan list before screenshot refine">
          Scan #{zenList}
        </span>
      )}
    </div>
  );
}

/* ─── dark hero badge (used in header) ─── */
function HeroBadge({ n, label, green, red }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/8 px-3 py-1.5">
      <span className="text-sm font-bold tabular-nums leading-none text-white">{n}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 leading-none">{label}</span>
    </div>
  );
}
