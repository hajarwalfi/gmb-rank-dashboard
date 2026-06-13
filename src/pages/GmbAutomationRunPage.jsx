import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { apiUrl } from '../apiBase';
import CenteredLoader from '../components/CenteredLoader';

function toDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function ceilToNextFiveMinutes(date = new Date(), plusMinutes = 5) {
  const next = new Date(date.getTime() + plusMinutes * 60 * 1000);
  next.setSeconds(0, 0);
  const mod = next.getMinutes() % 5;
  if (mod !== 0) next.setMinutes(next.getMinutes() + (5 - mod));
  return next;
}

function buildFiveMinuteOptions() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const hour12 = ((h + 11) % 12) + 1;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const label = `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
      out.push({ value, label });
    }
  }
  return out;
}

function parseScheduledDateTime(dateStr, timeStr) {
  const [y, m, d] = String(dateStr || '').split('-').map((n) => Number(n));
  const [hh, mm] = String(timeStr || '').split(':').map((n) => Number(n));
  if (
    !Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) ||
    !Number.isFinite(hh) || !Number.isFinite(mm)
  ) {
    return null;
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function toMs(v) {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function MultiLocationSelect({
  selectedIds,
  onChange,
  options,
  loading = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ref = useRef(null);
  const allIds = options.map((o) => o.locationId);
  const selectedCount = selectedIds.length;

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter(opt => (opt.title || '').toLowerCase().includes(lower));
  }, [options, searchTerm]);

  const allSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every(opt => selectedIds.includes(opt.locationId));
  }, [filteredOptions, selectedIds]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = (id) => {
    if (disabled) return;
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const toggleFilteredAll = () => {
    if (disabled) return;
    const filteredIds = filteredOptions.map(o => o.locationId);
    if (allSelected) {
      onChange(selectedIds.filter(id => !filteredIds.includes(id)));
    } else {
      const next = new Set([...selectedIds, ...filteredIds]);
      onChange(Array.from(next));
    }
  };

  const buttonLabel = loading
    ? 'Loading locations...'
    : selectedCount === 0
      ? 'Select GMB Profiles'
      : `${selectedCount} Profile(s) active`;

  return (
    <div className={`relative ${open ? 'z-[360]' : 'z-20'}`} ref={ref}>
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Business Selection</label>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        disabled={loading || disabled}
        className={`mt-2 w-full rounded-2xl border bg-white px-5 py-3.5 text-left text-sm font-black transition-all duration-300 focus:outline-none ${loading
          ? 'border-slate-100 text-slate-300 cursor-not-allowed'
          : disabled
            ? 'border-slate-100 text-slate-300 cursor-not-allowed'
          : open
            ? 'border-emerald-500 ring-4 ring-emerald-500/10 text-slate-900 shadow-lg scale-[1.02]'
            : 'border-slate-100 text-slate-600 hover:border-emerald-300 shadow-sm hover:shadow-md'
          }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{buttonLabel}</span>
          <span className={`shrink-0 transition-transform duration-500 ${open ? 'rotate-180' : ''}`}>
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </span>
      </button>

      {open && !loading && !disabled && (
        <div className="absolute left-0 right-0 top-full z-[380] mt-3 max-h-[28rem] overflow-hidden rounded-[2.5rem] border border-slate-100/50 bg-white/95 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col">
          <div className="p-4 border-b border-slate-50">
            <div className="relative">
              <input
                type="text"
                placeholder="Search profiles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-10 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all"
              />
              <svg className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" strokeLinecap="round" /></svg>
            </div>
          </div>

          <div className="overflow-auto flex-1 no-scrollbar pb-3">
            <label className="flex items-center gap-4 px-6 py-4 text-[10px] font-black text-slate-900 border-b border-slate-50 uppercase tracking-[0.2em] hover:bg-slate-50 transition-colors cursor-pointer sticky top-0 bg-white/90 backdrop-blur-sm z-10">
              <input type="checkbox" checked={allSelected} onChange={toggleFilteredAll} className="w-5 h-5 rounded-lg border-slate-200 text-emerald-600 focus:ring-emerald-500" />
              {searchTerm ? `Select all results (${filteredOptions.length})` : "Select All Profiles"}
            </label>
            {filteredOptions.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching profiles found</p>
              </div>
            ) : (
              filteredOptions.map((loc) => (
                <label key={loc.locationId} className="flex items-start gap-4 px-6 py-4 text-[11px] font-black text-slate-500 hover:bg-emerald-50/40 transition-all cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(loc.locationId)}
                    onChange={() => toggle(loc.locationId)}
                    className="mt-0.5 w-5 h-5 rounded-lg border-slate-200 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="truncate group-hover:text-slate-900 transition-colors">{loc.title}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemedDropdown({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((opt) => opt.value === value) || null;

  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className={`relative ${open ? 'z-[360]' : 'z-20'}`} ref={ref}>
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">{label}</label>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        disabled={disabled}
        className={`mt-2 w-full rounded-2xl border bg-white px-5 py-3.5 text-left text-sm font-black transition-all duration-300 focus:outline-none ${disabled
          ? 'border-slate-50 text-slate-300 cursor-not-allowed'
          : open
            ? 'border-emerald-500 ring-4 ring-emerald-500/10 text-slate-900 shadow-lg scale-[1.02]'
            : 'border-slate-100 text-slate-600 hover:border-emerald-300 shadow-sm hover:shadow-md'
          }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className={`${selected ? 'text-slate-900' : 'text-slate-400'} truncate`}>
            {selected ? selected.label : placeholder}
          </span>
          <span className={`shrink-0 transition-transform duration-500 ${open ? 'rotate-180' : ''}`}>
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-[380] mt-3 max-h-64 overflow-auto rounded-[2.5rem] border border-slate-100/50 bg-white/95 backdrop-blur-xl py-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] animate-in fade-in slide-in-from-top-4 duration-300 no-scrollbar">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest transition-all ${active
                  ? 'bg-emerald-50 text-emerald-700 font-black'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <span className="truncate block">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GmbAutomationRunPage() {
  const [loadingLocations, setLoadingLocations] = useState(true);
  /** Paying CRM + GBP-linked locations with ≥1 keyword in `services-keywords.json` (summary or list length). */
  const [qualifiedGmbCount, setQualifiedGmbCount] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [selectedTime, setSelectedTime] = useState(toTimeInputValue(ceilToNextFiveMinutes(new Date(), 5)));
  const [recurrence, setRecurrence] = useState('once');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [stopModalStep, setStopModalStep] = useState(null);
  const [stopBusy, setStopBusy] = useState(false);
  const [stopModePending, setStopModePending] = useState(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [activeJobLoading, setActiveJobLoading] = useState(true);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const pollingTimerRef = useRef(null);
  const previousHasActiveRef = useRef(false);

  const todayStr = toDateInputValue(new Date());
  const selectedLocations = useMemo(
    () => locations.filter((loc) => selectedLocationIds.includes(loc.locationId)),
    [locations, selectedLocationIds]
  );

  const recurrenceOptions = [
    { value: 'once', label: 'One-time (Run Once)' },
    { value: '2days', label: 'Every 2 Days' },
    { value: '5days', label: 'Every 5 Days' },
    { value: 'weekly', label: 'Weekly (Every 7 Days)' },
    { value: '14days', label: 'Every 2 Weeks (14 Days)' },
    { value: '20days', label: '20 Day Onboarding Cycle' },
    { value: 'monthly', label: 'Monthly Cycle' },
  ];

  const minTodayTime = useMemo(() => {
    const minTimeDate = ceilToNextFiveMinutes(new Date(), 5);
    return toTimeInputValue(minTimeDate);
  }, [selectedDate]);

  const timeOptions = useMemo(() => {
    const all = buildFiveMinuteOptions();
    if (selectedDate !== todayStr) return all;
    return all.filter((t) => t.value >= minTodayTime);
  }, [selectedDate, todayStr, minTodayTime]);

  useEffect(() => {
    if (!timeOptions.find((o) => o.value === selectedTime)) {
      setSelectedTime(timeOptions[0]?.value || '');
    }
  }, [timeOptions, selectedTime]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const fetchActiveJob = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/automation-runs/active-latest'));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not load active automation status right now.');
      const incoming = data.job || null;
      setActiveJob((prev) => {
        if (!incoming) return null;
        if (!prev) return incoming;
        if (String(prev.id || '') !== String(incoming.id || '')) return incoming;

        // Ignore stale out-of-order poll responses for the same running/scheduled job.
        const prevUpdated = toMs(prev.updatedAt);
        const nextUpdated = toMs(incoming.updatedAt);
        if (nextUpdated && prevUpdated && nextUpdated < prevUpdated) return prev;

        const prevProcessed = Number(prev?.progress?.processed || 0);
        const nextProcessed = Number(incoming?.progress?.processed || 0);
        const prevTotal = Number(prev?.progress?.total || 0);
        const nextTotal = Number(incoming?.progress?.total || 0);
        const prevFound = Number(prev?.progress?.found || 0);
        const nextFound = Number(incoming?.progress?.found || 0);
        const prevLocDone = Number(prev?.progress?.processedLocations || 0);
        const nextLocDone = Number(incoming?.progress?.processedLocations || 0);
        const status = String(incoming?.status || '').toLowerCase();
        if (status === 'running' || status === 'scheduled') {
          if (
            nextProcessed < prevProcessed ||
            nextTotal < prevTotal ||
            nextFound < prevFound ||
            nextLocDone < prevLocDone
          ) {
            return prev;
          }
        }
        return incoming;
      });
    } catch (e) {
      // Keep previous state on transient polling/network issues.
    } finally {
      setActiveJobLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLocations(true);
      try {
        const res = await fetch(apiUrl('/api/services-keywords?view=locations'));
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || 'We could not load locations right now.');
        if (!cancelled) {
          const list = Array.isArray(data.locations) ? data.locations : [];
          setLocations(list);
          const w = data.summary?.withKeywords ?? data.summary?.with_keywords_count;
          if (typeof w === 'number' && Number.isFinite(w)) {
            setQualifiedGmbCount(w);
          } else {
            setQualifiedGmbCount(list.length);
          }
        }
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'We could not load locations right now.');
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    stopPolling();
    fetchActiveJob();
    pollingTimerRef.current = setInterval(() => {
      fetchActiveJob();
    }, 5000);
    return () => stopPolling();
  }, [fetchActiveJob, stopPolling]);

  const handleOpenConfirmModal = () => {
    if (!selectedLocationIds.length) {
      toast.error("Please select at least one location first.");
      return;
    }
    setKeywordModalOpen(true);
  };

  const onConfirmSchedule = async () => {
    if (!selectedLocations.length) return;
    const dt = parseScheduledDateTime(selectedDate, selectedTime);
    if (!dt) {
      toast.error('Please choose a valid date and time.');
      return;
    }
    setScheduleBusy(true);
    try {
      const res = await fetch(apiUrl('/api/automation-runs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedLocations: selectedLocations.map((loc) => ({
            accountId: loc.accountId,
            locationId: loc.locationId,
            title: loc.title,
          })),
          scheduledAt: dt.toISOString(),
          recurrence: recurrence,
          keywords: selectedKeywords,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          isAllSelected: selectedLocationIds.length === locations.length,
          clientSource: 'google-search-ranking-ui',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not schedule this automation run right now.');
      setKeywordModalOpen(false);
      setConfirmOpen(false);
      setActiveJob(data.job || null);
      toast.success(`Automation scheduled successfully.`, { icon: '✅' });
    } catch (e) {
      toast.error(e.message || 'We could not schedule this automation run right now.');
    } finally {
      setScheduleBusy(false);
    }
  };

  const recurrenceLabel = useMemo(() => {
    return recurrenceOptions.find(o => o.value === recurrence)?.label || recurrence;
  }, [recurrence]);

  const liveRows = useMemo(
    () => (Array.isArray(activeJob?.result?.liveRows) ? activeJob.result.liveRows : []),
    [activeJob]
  );
  const stopStats = useMemo(() => {
    const dedupFound = new Set(
      liveRows
        .filter((r) => r.found)
        .map((r) => `${String(r.locationTitle || '').trim().toLowerCase()}|${String(r.keyword || '').trim().toLowerCase()}`)
    ).size;
    const withScreenshot = liveRows.filter((r) => r.found && r.screenshotUrl).length;
    const total = Number(activeJob?.progress?.total || 0);
    const processedRaw = Number(activeJob?.progress?.processed || liveRows.length || 0);
    const processed = total > 0 ? Math.min(Math.max(processedRaw, 0), total) : Math.max(processedRaw, 0);
    const foundRaw = Number(activeJob?.progress?.found || dedupFound || 0);
    const found = total > 0 ? Math.min(Math.max(foundRaw, 0), total) : Math.max(foundRaw, 0);
    const pendingScreenshot = Math.max(found - withScreenshot, 0);
    const pendingKeywords = Math.max(total - processed, 0);
    return { found, withScreenshot, pendingScreenshot, processed, total, pendingKeywords };
  }, [liveRows, activeJob]);

  const hasActiveJob = Boolean(activeJob && ['scheduled', 'running'].includes(String(activeJob.status || '')));
  const status = String(activeJob?.status || '').toLowerCase();
  const statusTone = status === 'running'
    ? 'text-emerald-500 bg-emerald-50 border-emerald-100 ring-emerald-500/10'
    : status === 'scheduled'
      ? 'text-amber-500 bg-amber-50 border-amber-100 ring-amber-500/10'
      : 'text-slate-500 bg-slate-50 border-slate-100 ring-slate-500/10';

  const totalCount = Number(activeJob?.progress?.total || 0);
  const processedCountRaw = Number(activeJob?.progress?.processed || 0);
  const processedCount = totalCount > 0 ? Math.min(Math.max(processedCountRaw, 0), totalCount) : Math.max(processedCountRaw, 0);
  const foundPct = totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : 0;

  const automationPoolDisplayTotal = useMemo(() => {
    if (typeof qualifiedGmbCount === 'number' && qualifiedGmbCount >= 0) return qualifiedGmbCount;
    return locations.length;
  }, [qualifiedGmbCount, locations.length]);

  /**
   * GMB profile progress: how many of the *selected* business profiles are done.
   * Server stores this as progress.processedLocations / progress.totalLocations (per executeJob + saveJobProgress).
   */
  const gmbProfileStats = useMemo(() => {
    if (!activeJob) return { done: 0, displayTotal: 0 };
    // Denominator = exactly what the user selected (e.g. 640 in Business Selection). Do not use a smaller
    // progress.totalLocations from the server (e.g. 625) when the live GMB list has 640.
    const selectedTotal = activeJob.allLocations
      ? Math.max(0, automationPoolDisplayTotal)
      : Math.max(0, Array.isArray(activeJob.locationTargets) ? activeJob.locationTargets.length : 0);
    const serverTotal = Math.max(0, Number(activeJob?.progress?.totalLocations ?? 0));
    const serverDone = Math.max(0, Number(activeJob?.progress?.processedLocations ?? 0));
    const displayTotal = selectedTotal > 0 ? selectedTotal : serverTotal;
    const done = displayTotal > 0 ? Math.min(serverDone, displayTotal) : serverDone;
    return { done, displayTotal };
  }, [activeJob, automationPoolDisplayTotal]);

  const requestStop = async (mode) => {
    if (!activeJob?.id) return;
    setStopBusy(true);
    setStopModePending(mode);
    try {
      const res = await fetch(apiUrl(`/api/automation-runs/${encodeURIComponent(activeJob.id)}/stop`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not stop this automation run right now.');
      setStopModalStep(null);
      if (data.removed) {
        setActiveJob(null);
        toast.success(mode === 'immediate' ? 'Automation deleted completely.' : 'Scheduled automation was removed successfully.', { icon: '✅' });
      } else {
        toast.success(mode === 'immediate' ? 'Automation terminated.' : 'Automation will stop after current task.', { icon: '✅' });
        fetchActiveJob();
      }
    } catch (e) {
      toast.error(e.message || 'We could not stop this automation run right now.');
    } finally {
      setStopBusy(false);
      setStopModePending(null);
    }
  };

  useEffect(() => {
    const hasActive = Boolean(activeJob && ['scheduled', 'running'].includes(String(activeJob.status || '')));
    if (hasActive) {
      const targets = Array.isArray(activeJob?.locationTargets) ? activeJob.locationTargets : [];
      if (activeJob?.allLocations) {
        if (locations.length) setSelectedLocationIds(locations.map((l) => l.locationId));
      } else if (targets.length) {
        setSelectedLocationIds(targets.map((t) => t.locationId).filter(Boolean));
      }
      if (activeJob?.recurrence) setRecurrence(activeJob.recurrence);
      if (Array.isArray(activeJob?.selectedKeywords)) setSelectedKeywords(activeJob.selectedKeywords);
      const dt = new Date(activeJob?.scheduledAt || '');
      if (Number.isFinite(dt.getTime())) {
        setSelectedDate(toDateInputValue(dt));
        setSelectedTime(toTimeInputValue(dt));
      }
    }

    if (previousHasActiveRef.current && !hasActive) {
      const next = ceilToNextFiveMinutes(new Date(), 5);
      setSelectedLocationIds([]);
      setSelectedKeywords([]);
      setRecurrence('once');
      setSelectedDate(toDateInputValue(new Date()));
      setSelectedTime(toTimeInputValue(next));
    }
    previousHasActiveRef.current = hasActive;
  }, [activeJob, locations]);

  if (loadingLocations || activeJobLoading) {
    return <CenteredLoader message="Loading dashboard metrics..." />;
  }

  return (
    <div className="mx-auto max-w-6xl animate-fade-in p-4 sm:p-8 min-h-screen bg-slate-50/30">
      <div className="mb-8 sm:mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl shadow-slate-200 shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.332.183-.582.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Automation Engine</h1>
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1.5">Recurring Analytics & Search Intelligence</p>
          </div>
        </div>
      </div>

      {activeJob && (
        <div className="mb-10 rounded-[2.5rem] sm:rounded-[3rem] bg-white p-6 sm:p-10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.08)] border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full -mr-48 -mt-48 blur-[130px] transition-opacity group-hover:opacity-100 opacity-60" />
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 sm:mb-10">
              <div className="text-center md:text-left">
                <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                  <h3 className="text-slate-900 text-xl sm:text-2xl font-black uppercase tracking-tighter">
                    {status === 'scheduled' ? 'Next Deployment Queued' : 'Active Deployment'}
                  </h3>
                  <span className={`flex h-2.5 w-2.5 rounded-full ${status === 'running' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                </div>
                <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em]">
                  {status === 'scheduled' ? 'Starts At' : 'Sync Period'}: {new Date(activeJob.scheduledAt).toLocaleDateString()} • {new Date(activeJob.scheduledAt).toLocaleTimeString()}
                </p>
                {Array.isArray(activeJob.locationTargets) && activeJob.locationTargets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 justify-center md:justify-start">
                    {activeJob.allLocations ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-50 text-[9px] font-black text-emerald-600 uppercase tracking-tight border border-emerald-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        All {automationPoolDisplayTotal} paying CRM+GMB-linked (≥1 keywords in snapshot)
                        <button 
                          onClick={() => setIsLocationModalOpen(true)}
                          className="ml-1 text-emerald-400 hover:text-emerald-700 transition-colors"
                        >
                          (View List)
                        </button>
                      </span>
                    ) : (
                      <>
                        {activeJob.locationTargets.slice(0, 4).map((target, idx) => (
                          <span key={idx} className="px-3 py-1 rounded-lg bg-slate-100 text-[9px] font-black text-slate-600 uppercase tracking-tight border border-slate-200">
                            {target.title}
                          </span>
                        ))}
                        {activeJob.locationTargets.length > 4 && (
                          <button
                            onClick={() => setIsLocationModalOpen(true)}
                            className="px-3 py-1 rounded-lg bg-slate-900 text-[9px] font-black text-white uppercase tracking-tight border border-slate-900 hover:bg-emerald-600 hover:border-emerald-600 transition-all active:scale-95 shadow-sm"
                          >
                            +{activeJob.locationTargets.length - 4} More
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm ${statusTone}`}>
                {status === 'scheduled' ? 'Waiting for Schedule' : status}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-10">
              {[
                { label: "Completed", val: `${processedCount}/${totalCount}`, color: "text-slate-900" },
                { label: "Detected", val: stopStats.found, color: "text-emerald-600" },
                { label: "Progress", val: `${foundPct}%`, color: "text-slate-900" },
                { label: "Pending", val: stopStats.pendingKeywords, color: "text-slate-400" },
                {
                  label: "GMB profiles",
                  val:
                    gmbProfileStats.displayTotal > 0
                      ? `${gmbProfileStats.done}/${gmbProfileStats.displayTotal}`
                      : "—",
                  color: "text-indigo-600",
                },
              ].map((stat, i) => (
                <div key={i} className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100 backdrop-blur-sm hover:border-emerald-200 hover:bg-white transition-all duration-500 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{stat.label}</p>
                  <p className={`text-2xl font-black tabular-nums ${stat.color}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            <div className="relative pt-1">
              <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-slate-100 border border-slate-50 shadow-inner p-0.5">
                <div
                  style={{ width: `${foundPct}%` }}
                  className="shadow-lg flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 ease-out rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-8 space-y-8">
          <div className="rounded-[2.5rem] sm:rounded-[3rem] bg-white p-6 sm:p-10 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.06)] border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full -mr-40 -mt-40 blur-[120px]" />

            <div className="relative z-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <MultiLocationSelect
                  selectedIds={selectedLocationIds}
                  onChange={setSelectedLocationIds}
                  options={locations}
                  loading={loadingLocations}
                  disabled={hasActiveJob}
                />
                <ThemedDropdown
                  label="Recurrence Model"
                  value={recurrence}
                  onChange={setRecurrence}
                  options={recurrenceOptions}
                  placeholder="Select Frequency"
                  disabled={hasActiveJob}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Start Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={todayStr}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    disabled={hasActiveJob}
                    className="mt-2 w-full rounded-2xl border border-slate-100 bg-white px-5 py-3.5 text-sm font-black text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 shadow-sm transition-all"
                  />
                </div>
                <ThemedDropdown
                  label={`Execution Time (${selectedDate === todayStr ? 'Next Slots' : 'Local'})`}
                  value={selectedTime}
                  onChange={setSelectedTime}
                  options={timeOptions}
                  placeholder="Select Time"
                  disabled={hasActiveJob}
                />
              </div>

              <div className="pt-8 sm:pt-10 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="flex items-center gap-4 bg-slate-50/80 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-slate-100 w-full sm:w-auto">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 ${hasActiveJob ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">
                    {hasActiveJob ? "System Occupied" : "Engine Ready for Deployment"}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  {hasActiveJob && (
                    <button
                      onClick={() => setStopModalStep('confirm')}
                      className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-white text-rose-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-50 transition-all shadow-sm active:scale-95"
                    >
                      Terminate
                    </button>
                  )}
                  <button
                    onClick={handleOpenConfirmModal}
                    disabled={!selectedLocationIds.length || hasActiveJob || scheduleBusy}
                    className={`px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl
                          ${!selectedLocationIds.length || hasActiveJob || scheduleBusy
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-emerald-600 hover:shadow-emerald-200/50 hover:-translate-y-1 active:scale-95'}`}
                  >
                    {scheduleBusy ? "Deploying..." : "Schedule Automation"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-sm sticky top-8">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8 border-b border-slate-50 pb-4">Engine Metrics</h4>
            <div className="space-y-8">
              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 shrink-0 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Auto-Persistence</p>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed mt-1">All scan results are automatically committed to the historical JSON archive.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 shrink-0 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Recurring Engine</p>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed mt-1">Schedules are strictly managed via a backend cron architecture for precision.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 shrink-0 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Conflict Shield</p>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed mt-1">System prevents multiple overlapping automations to ensure data integrity.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {keywordModalOpen && (
        <div className="fixed inset-0 z-[520] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-[0_50px_120px_-20px_rgba(0,0,0,0.5)] border border-slate-200 flex flex-col max-h-[80vh]">
            {/* HEADER */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  Deployment Confirmation
                </h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
                  Review & Initialize Automation
                </p>
              </div>

              <button
                onClick={() => setKeywordModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            {/* CONFIRMATION CONTENT */}
            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-4">Selected Businesses</label>
                <div className="grid grid-cols-1 gap-3">
                  {selectedLocations.map((loc) => (
                    <div key={loc.locationId} className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <span className="text-sm font-black text-slate-700">{loc.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Recurrence</label>
                  <p className="text-xs font-black text-slate-900">{recurrenceLabel}</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Start Schedule</label>
                  <p className="text-xs font-black text-slate-900">{selectedDate} @ {selectedTime}</p>
                </div>
              </div>

              <div className="p-6 rounded-[2rem] bg-emerald-50 border border-emerald-100 flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-[11px] font-black text-emerald-900 uppercase tracking-tight">Intelligence Note</p>
                  <p className="text-[10px] font-bold text-emerald-700/70 leading-relaxed mt-1">
                    System will automatically fetch and merge the best keyword candidates for each business upon execution.
                  </p>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/30 shrink-0 flex items-center justify-between">
              <button
                onClick={() => setKeywordModalOpen(false)}
                className="text-sm font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={onConfirmSchedule}
                disabled={scheduleBusy}
                className="px-8 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-200/50 transition-all active:scale-95 disabled:bg-slate-200 disabled:cursor-not-allowed"
              >
                {scheduleBusy ? "Deploying..." : "Confirm & Deploy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stopModalStep === 'confirm' && (
        <div className="fixed inset-0 z-[540] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[min(92vw,520px)] bg-white rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl p-6 sm:p-10 animate-in zoom-in duration-300 border border-slate-100">
            <div className="w-16 h-16 rounded-[2rem] bg-rose-50 flex items-center justify-center text-rose-500 mb-8">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Abort Deployment?</h3>
            <p className="text-xs text-slate-500 font-bold leading-relaxed mb-10 uppercase tracking-widest">This action will cease the current tracking cycle. All progress until now will be preserved.</p>
            <div className="flex items-center justify-end gap-6">
              <button disabled={stopBusy} onClick={() => setStopModalStep(null)} className="text-[11px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-900 disabled:opacity-50">Hold Request</button>
              <button disabled={stopBusy} onClick={() => setStopModalStep('mode')} className="px-8 py-4 rounded-2xl bg-rose-500 text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-600 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
                {stopBusy ? 'Processing...' : 'Confirm Stop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLocationModalOpen && (
        <div className="fixed inset-0 z-[560] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-[0_50px_120px_-20px_rgba(0,0,0,0.5)] border border-slate-200 flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  Deployment Scope
                </h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
                  {activeJob?.allLocations ? "Syncing with all current GMB profiles" : "Manually Selected Profiles"}
                </p>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
              <div className="space-y-3">
                {(activeJob?.allLocations ? locations : (activeJob?.locationTargets || [])).map((loc, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-emerald-200 hover:bg-white transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{loc.title}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{loc.locationIdShort || 'GMB ACTIVE'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Total:{' '}
                  {activeJob?.allLocations ? automationPoolDisplayTotal : activeJob?.locationTargets?.length} Profiles
                </span>
                {activeJob?.allLocations && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-[8px] font-black text-emerald-700 uppercase">Live Sync</span>
                )}
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {stopModalStep === 'mode' && (
        <div className="fixed inset-0 z-[550] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[min(92vw,760px)] bg-white rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl p-6 sm:p-10 animate-in zoom-in duration-300 border border-slate-100">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8 sm:mb-10">Termination Strategy</h3>
            <div className="space-y-6">
              <button
                onClick={() => requestStop('graceful')}
                disabled={stopBusy}
                className="w-full p-6 rounded-[2rem] bg-emerald-50 border border-emerald-100 text-left hover:bg-emerald-100 transition-all group shadow-sm"
              >
                <p className="text-[12px] font-black text-emerald-800 uppercase tracking-widest">
                  {stopModePending === 'graceful' ? 'Processing...' : 'Graceful Shutdown'}
                </p>
                <p className="text-[10px] font-bold text-emerald-600/60 uppercase mt-2 tracking-tight">Finish current keyword process before termination</p>
              </button>
              <button
                onClick={() => requestStop('immediate')}
                disabled={stopBusy}
                className="w-full p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-left hover:bg-rose-100 transition-all group shadow-sm"
              >
                <p className="text-[12px] font-black text-rose-800 uppercase tracking-widest">
                  {stopModePending === 'immediate' ? 'Processing...' : 'Emergency Kill'}
                </p>
                <p className="text-[10px] font-bold text-rose-600/60 uppercase mt-2 tracking-tight">Instant termination of all active background threads</p>
              </button>
            </div>
            <button disabled={stopBusy} onClick={() => setStopModalStep(null)} className="w-full mt-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-900 disabled:opacity-50">Return to View</button>
          </div>
        </div>
      )}
    </div>
  );
}
