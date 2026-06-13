import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { animate, stagger } from 'animejs';
import { apiUrl } from '../apiBase';

export default function RankingForm({ onSubmit, disabled }) {
  const [businessName,     setBusinessName]     = useState('');
  const [primaryCategory,  setPrimaryCategory]  = useState('');
  const [areas,            setAreas]            = useState([]);
  const [areaInput,        setAreaInput]        = useState('');

  const containerRef = useRef(null);

  // GMB State
  const [gmbStatus,        setGmbStatus]        = useState(false);
  const [connectingGmb,    setConnectingGmb]    = useState(false);
  const [accounts,         setAccounts]         = useState([]);
  const [selectedAccount,  setSelectedAccount]  = useState('');
  const [locations,        setLocations]        = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [syncing,          setSyncing]          = useState(false);
  const locationSyncSeqRef = useRef(0);

  // Preview Keywords
  const [previewKeywords, setPreviewKeywords] = useState([]);
  const [previewOpen,     setPreviewOpen]     = useState(false);
  const [previewLoading,  setPreviewLoading]  = useState(false);

  // Drop stale preview when category/areas change (not businessName — would clear on every keystroke)
  useEffect(() => {
    setPreviewKeywords([]);
    setPreviewOpen(false);
  }, [areas, primaryCategory]);

  useEffect(() => {
    fetch(apiUrl('/api/gmb/status'))
      .then(r => r.json())
      .then(d => setGmbStatus(!!d.configured))
      .catch(console.error);
  }, []);

  // Entrance animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current.querySelectorAll('.anime-item'), {
        opacity: [0, 1], translateY: [30, 0], scale: [0.98, 1],
        easing: 'easeOutCubic', duration: 800, delay: stagger(120, { start: 100 }),
      });
    }
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && containerRef.current) {
      animate('.gmb-section', {
        opacity: [0, 1], translateY: [-20, 0], duration: 600, easing: 'easeOutExpo',
      });
    }
  }, [accounts.length]);

  // ── GMB Helpers ────────────────────────────────────────────────────────────
  const loadAccounts = async () => {
    setConnectingGmb(true);
    try {
      const res  = await fetch(apiUrl('/api/gmb/accounts'));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not load your Google Business accounts right now.');
      if (data.accounts) { setAccounts(data.accounts); toast.success(`Great! ${data.accounts.length} account(s) connected.`); }
    } catch (e) {
      toast.error(e.message || 'We could not connect to Google Business right now. Please try again.');
    } finally { setConnectingGmb(false); }
  };

  const loadLocations = async (accountId) => {
    setSelectedAccount(accountId);
    if (!accountId) return setLocations([]);
    setConnectingGmb(true);
    try {
      const res  = await fetch(apiUrl(`/api/gmb/locations?accountId=${encodeURIComponent(accountId)}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not load locations right now.');
      if (data.locations) setLocations(data.locations);
    } catch (e) {
      toast.error(e.message || 'We could not load locations right now. Please try again.');
    } finally { setConnectingGmb(false); }
  };

  const syncLocation = async (locationId) => {
    const seq = ++locationSyncSeqRef.current;
    if (!locationId || !selectedAccount) {
      setSelectedLocation('');
      if (seq === locationSyncSeqRef.current) setSyncing(false);
      return;
    }
    setSelectedLocation(locationId);
    setSyncing(true);
    try {
      const res = await fetch(
        apiUrl(`/api/gmb/location?accountId=${encodeURIComponent(selectedAccount)}&locationId=${encodeURIComponent(locationId)}`)
      );
      const loc = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(loc.error || 'We could not load this location right now.');
      if (seq !== locationSyncSeqRef.current) return;

      // Business Name
      if (loc.title) setBusinessName(loc.title);

      // Primary Category ← the GMB primary category becomes the search term
      const cat = loc.categories?.primaryCategory?.displayName
        || loc.categories?.primaryCategory?.name
        || '';
      if (cat) setPrimaryCategory(cat);

      // Service Areas
      if (loc.serviceArea?.places) {
        setAreas(
          loc.serviceArea.places
            .map(p => p.placeName?.name || p.placeName || p.placeId)
            .filter(Boolean)
        );
      } else {
        setAreas([]);
      }

      toast.success('GMB details imported — Primary Category & Service Areas filled!');
    } catch (e) {
      if (seq === locationSyncSeqRef.current) toast.error(e.message || 'We could not sync location details right now.');
    } finally {
      if (seq === locationSyncSeqRef.current) setSyncing(false);
    }
  };

  // ── Area Helpers ──────────────────────────────────────────────────────────
  const addArea = () => {
    const v = areaInput.trim();
    if (v && !areas.includes(v)) setAreas([...areas, v]);
    setAreaInput('');
  };
  const removeArea = (a) => setAreas(areas.filter(x => x !== a));

  // ── Preview Keywords ──────────────────────────────────────────────────────
  const handlePreviewKeywords = async () => {
    if (!primaryCategory.trim() || previewLoading) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(apiUrl('/api/ranking/keywords'), {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          businessName   : businessName.trim(),
          primaryCategory: primaryCategory.trim(),
          areas,
        }),
      });
      if (!res.ok) throw new Error('We could not prepare keyword suggestions right now.');
      const data = await res.json();
      const kws  = Array.isArray(data) ? data : (data.keywords ?? []);
      setPreviewKeywords(kws);
      setPreviewOpen(true);
    } catch (err) {
      toast.error(err.message || 'We could not load keyword suggestions right now. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!businessName.trim())    return toast.error('Business name is required');
    if (!primaryCategory.trim()) return toast.error('Primary Category is required (e.g. "Plumbing contractor")');

    // Auto-add any pending area input the user forgot to click "Add" for
    let finalAreas = [...areas];
    const aInput = areaInput.trim();
    if (aInput && !finalAreas.includes(aInput)) finalAreas.push(aInput);

    if (finalAreas.length === 0) return toast.error('Add at least one service area');

    onSubmit({
      businessName   : businessName.trim(),
      primaryCategory: primaryCategory.trim(),
      areas          : finalAreas,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="p-5 sm:p-8 md:p-12 w-full max-w-4xl mx-auto bg-white/60 backdrop-blur-3xl rounded-[2rem] border border-brand-mint/40 shadow-[0_20px_60px_-15px_rgba(26,92,56,0.1)] overflow-hidden transition-all relative"
    >
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-brand rounded-t-[2rem] opacity-70" />

      {/* ── Header ── */}
      <div className="anime-item mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6" style={{ opacity: 0 }}>
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-midnight tracking-tight mb-2 leading-tight">
            New Google Maps Ranking Scan
          </h2>
          <p className="text-brand-muted text-xs sm:text-sm font-medium tracking-wide">
            Checks where your business appears in Google Maps results for every service area
          </p>
        </div>

        {/* GMB Import button */}
        {gmbStatus && accounts.length === 0 && (
          <button
            type="button"
            onClick={loadAccounts}
            disabled={connectingGmb}
            className="group flex flex-shrink-0 items-center justify-center gap-2.5 rounded-2xl bg-brand-frost hover:bg-brand-mint/50 border border-brand-mint text-brand-pine px-5 sm:px-6 py-3 sm:py-3.5 text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
          >
            {connectingGmb ? 'Connecting to Google…' : (
              <>
                <svg className="w-5 h-5 text-brand-forest transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
                </svg>
                Import from GMB
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Info box explaining the keyword format ── */}
      <div className="anime-item mb-8 p-4 rounded-2xl bg-blue-50/80 border border-blue-200/60" style={{ opacity: 0 }}>
        <div className="flex gap-3 items-start">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">How Google Maps ranking works</p>
            <p className="text-blue-700 text-xs leading-relaxed">
              Each keyword is built as <span className="font-mono bg-blue-100 px-1 rounded">Primary Category + Service Area</span>.
              Example: <em className="font-semibold">"Plumbing contractor Newport North Carolina"</em> — this is what real customers type and it shows the Google Maps 3-pack.
              Your Business Name is used to find and match your listing inside those Maps results.
            </p>
          </div>
        </div>
      </div>

      {/* ── GMB Account / Location Selector ── */}
      {accounts.length > 0 && (
        <div className="gmb-section mb-10 p-6 rounded-[1.5rem] bg-gradient-to-br from-brand-frost to-white border border-brand-mint/60 shadow-inner" style={{ opacity: 0 }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-brand-mint/50 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-forest" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-brand-pine uppercase tracking-widest">Connect GMB Location</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2 relative group">
              <label className="text-[11px] font-bold uppercase tracking-widest text-brand-muted pl-1">Select Account</label>
              <select
                className="w-full rounded-2xl border border-brand-mint/80 bg-white/70 px-4 py-3.5 text-brand-midnight text-sm appearance-none outline-none focus:ring-4 focus:ring-brand-mint/40 transition-all cursor-pointer"
                value={selectedAccount}
                onChange={e => loadLocations(e.target.value)}
              >
                <option value="">— Choose Account —</option>
                {accounts.map(acc => (
                  <option key={acc.name} value={acc.name}>{acc.accountName || acc.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 relative group">
              <label className="text-[11px] font-bold uppercase tracking-widest text-brand-muted pl-1">Select Location</label>
              <select
                className="w-full rounded-2xl border border-brand-mint/80 bg-white/70 px-4 py-3.5 text-brand-midnight text-sm appearance-none outline-none focus:ring-4 focus:ring-brand-mint/40 transition-all cursor-pointer disabled:opacity-50"
                value={selectedLocation}
                onChange={e => syncLocation(e.target.value)}
                disabled={!selectedAccount || connectingGmb || syncing}
              >
                <option value="">{connectingGmb ? 'Loading locations…' : '— Choose Location —'}</option>
                {locations.map(loc => (
                  <option key={loc.name} value={loc.name}>{loc.title || loc.name}</option>
                ))}
              </select>
            </div>
          </div>
          {syncing && (
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-forest">
              <div className="w-2 h-2 bg-brand-forest rounded-full animate-ping" />
              Syncing — auto-filling Business Name, Primary Category &amp; Service Areas…
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ── 1. Business Name ── */}
        <div className="anime-item flex flex-col gap-2.5 group" style={{ opacity: 0 }}>
          <label className="text-[11px] uppercase tracking-widest font-bold text-brand-muted pl-1 group-focus-within:text-brand-forest transition-colors">
            Business Name <span className="text-brand-muted/60 font-normal normal-case">(used to find your listing in Maps results)</span>
          </label>
          <input
            type="text"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            placeholder="e.g. JND Plumbing Services"
            className="w-full rounded-2xl border border-brand-mint/60 bg-brand-frost/40 px-5 py-4 text-brand-midnight placeholder-brand-muted/50 text-base shadow-sm hover:border-brand-sage focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-sage/20 transition-all duration-300"
            required
          />
        </div>

        {/* ── 2. Primary Category (NEW — the search keyword driver) ── */}
        <div className="anime-item flex flex-col gap-2.5 group" style={{ opacity: 0 }}>
          <label className="text-[11px] uppercase tracking-widest font-bold text-brand-forest pl-1 group-focus-within:text-brand-pine transition-colors flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-forest text-white text-[9px] font-black flex-shrink-0">★</span>
            Primary Category
            <span className="text-brand-muted/60 font-normal normal-case">(Google Maps search term)</span>
          </label>
          <input
            type="text"
            value={primaryCategory}
            onChange={e => setPrimaryCategory(e.target.value)}
            placeholder="e.g. Plumbing contractor, HVAC contractor, Junk removal service"
            className="w-full rounded-2xl border-2 border-brand-sage/60 bg-brand-frost/40 px-5 py-4 text-brand-midnight placeholder-brand-muted/50 text-base shadow-sm hover:border-brand-sage focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-forest/20 transition-all duration-300"
            required
          />
          {primaryCategory.trim() && areas.length > 0 && (
            <p className="text-[11px] text-brand-forest/70 pl-1 font-medium">
              Will search: <em className="font-semibold not-italic">"{primaryCategory.trim()} {areas[0]}"</em>
              {areas.length > 1 && <span className="text-brand-muted/60"> + {areas.length - 1} more keyword{areas.length > 2 ? 's' : ''}</span>}
            </p>
          )}
        </div>

        {/* ── 3. Service Areas ── */}
        <div className="anime-item flex flex-col gap-2.5" style={{ opacity: 0 }}>
          <label className="text-[11px] uppercase tracking-widest font-bold text-brand-muted pl-1">
            Service Areas <span className="text-brand-muted/60 font-normal normal-case">(one keyword per area)</span>
          </label>
          <div className="flex flex-wrap gap-2.5 mb-2">
            {areas.map(a => (
              <span
                key={a}
                className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-mint/80 px-4 py-2 text-sm font-semibold text-brand-midnight shadow-sm hover:shadow-md hover:border-brand-sage transition-all"
              >
                <svg className="w-3 h-3 text-brand-forest flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                {a}
                <button
                  type="button"
                  onClick={() => removeArea(a)}
                  className="bg-brand-frost/80 text-brand-muted hover:text-brand-midnight rounded-full w-5 h-5 flex items-center justify-center transition-colors -mr-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={areaInput}
              onChange={e => setAreaInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArea())}
              placeholder="e.g. Newport North Carolina, Morehead City NC"
              className="flex-1 w-full rounded-2xl border border-brand-mint/60 bg-brand-frost/40 px-5 py-3.5 text-sm placeholder-brand-muted/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-sage/20 transition-all shadow-sm"
            />
            <button
              type="button"
              onClick={addArea}
              className="px-6 py-3.5 rounded-2xl bg-brand-mint/30 hover:bg-brand-sage text-brand-pine hover:text-white text-sm font-bold tracking-wide transition-all duration-300 active:scale-95 whitespace-nowrap"
            >
              Add Area
            </button>
          </div>
        </div>

        {/* ── Preview Keywords ── */}
        <div className="anime-item" style={{ opacity: 0 }}>
          <button
            type="button"
            onClick={handlePreviewKeywords}
            disabled={!primaryCategory.trim() || areas.length === 0 || previewLoading}
            className="flex items-center gap-2 rounded-2xl border border-brand-mint/80 bg-brand-frost/60 hover:bg-brand-mint/30 px-5 py-3 text-sm font-semibold text-brand-pine transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {previewLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            )}
            {previewLoading
              ? 'Generating…'
              : previewKeywords.length > 0
                ? `Preview (${previewKeywords.length} keyword${previewKeywords.length !== 1 ? 's' : ''})`
                : 'Preview keywords'}
            {previewKeywords.length > 0 && !previewLoading && (
              <span
                onClick={e => { e.stopPropagation(); setPreviewOpen(o => !o); }}
                className="ml-1 text-brand-muted hover:text-brand-pine"
              >
                {previewOpen ? '▲' : '▼'}
              </span>
            )}
          </button>

          {previewOpen && previewKeywords.length > 0 && (
            <div className="mt-3 p-4 rounded-2xl border border-brand-mint/40 bg-white/70 flex flex-wrap gap-2">
              {previewKeywords.map((kw, i) => (
                <span key={`${i}-${kw}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-frost border border-brand-mint/60 px-3 py-1.5 text-[11px] font-semibold text-brand-midnight shadow-sm">
                  <svg className="w-3 h-3 text-brand-forest flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <div className="anime-item pt-4" style={{ opacity: 0 }}>
          <button
            type="submit"
            disabled={disabled || !businessName.trim() || !primaryCategory.trim() || syncing}
            className="w-full relative overflow-hidden group bg-brand-midnight hover:bg-[#112316] text-white py-5 px-8 rounded-2xl font-bold tracking-widest uppercase text-sm shadow-[0_8px_20px_-8px_rgba(15,46,27,0.8)] hover:shadow-[0_12px_24px_-8px_rgba(15,46,27,1)] transition-all duration-300 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
          >
            <div className="absolute inset-x-0 w-full h-[200%] bg-gradient-brand transition-transform duration-700 ease-in-out -translate-y-full blur-md opacity-20 group-hover:translate-y-0 pointer-events-none" />
            <span className="relative flex items-center justify-center gap-3 py-1">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              Check Google Maps Rankings
              {areas.length > 0 && (
                <span className="text-brand-mint/80 font-normal normal-case tracking-normal text-xs">
                  ({areas.length} area{areas.length !== 1 ? 's' : ''}
                  {previewKeywords.length > 0
                    ? <> · {previewKeywords.length} keyword{previewKeywords.length !== 1 ? 's' : ''}</>
                    : <> · use Preview for keyword count</>}
                  )
                </span>
              )}
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
