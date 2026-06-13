import React, { useEffect, useState } from 'react';
import { apiUrl } from '../apiBase';

function bannerFromApi(data) {
  if (data?.ok && data.pillLabel) return data;
  const err = typeof data?.error === 'string' ? data.error : 'Invalid response from API.';
  return {
    ok: false,
    state: 'idle',
    pillLabel: 'Idle',
    detail: err,
    daysUntilNext: null,
  };
}

export default function AutomationStatusBanner() {
  const [banner, setBanner] = useState(() => ({
    ok: true,
    state: 'idle',
    pillLabel: 'Idle',
    detail: 'Loading automation status…',
    daysUntilNext: null,
  }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(apiUrl('/api/automation/status-banner'), {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        let data = null;
        try {
          data = await res.json();
        } catch {
          throw new Error('Response was not JSON (check API URL / deploy).');
        }
        if (cancelled) return;
        if (!res.ok) {
          setBanner({
            ok: false,
            state: 'idle',
            pillLabel: 'Idle',
            detail: typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`,
            daysUntilNext: null,
          });
          return;
        }
        setBanner(bannerFromApi(data));
      } catch (e) {
        if (!cancelled) {
          setBanner({
            ok: false,
            state: 'idle',
            pillLabel: 'Idle',
            detail: String(e?.message || e || 'Fetch failed.'),
            daysUntilNext: null,
          });
        }
      }
    }
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const running = banner.state === 'running';
  const days = banner.daysUntilNext;
  const short =
    !running && typeof days === 'number' ? (days === 0 ? 'Soon' : `${days}d`) : '';

  /** Running: same chip as header `pageTitle` / Settings. Idle: same as Automation page “Waiting for Schedule”. */
  const base = 'flex min-w-fit shrink-0 items-center gap-2 leading-none shadow-sm min-h-8';
  const runningCls = `${base} text-[10px] font-black uppercase tracking-[0.3em] text-emerald-700 bg-emerald-50/50 px-4 py-2 rounded-xl border border-emerald-100/50 backdrop-blur-sm`;
  const idleCls = `${base} text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 ring-1 ring-amber-500/10`;

  return (
    <div
      role="status"
      title={String(banner.detail || '').trim() || undefined}
      className={running ? runningCls : idleCls}
    >
      {running ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" /> : null}
      <span className="whitespace-nowrap">{running ? 'Running' : banner.pillLabel}</span>
      {!running && short ? (
        <span className="hidden min-[420px]:inline whitespace-nowrap text-amber-600/90 font-bold normal-case tracking-normal">
          · {short}
        </span>
      ) : null}
    </div>
  );
}
