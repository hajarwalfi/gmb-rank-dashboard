import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../apiBase';
import CenteredLoader from '../components/CenteredLoader';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return Math.round(n).toLocaleString('en-US');
}

function formatDeltaWeek(delta) {
  const n = Math.round(Number(delta) || 0);
  if (n === 0) return '0 vs weekly baseline';
  const sign = n > 0 ? '+' : '-';
  return `${sign}${Math.abs(n).toLocaleString('en-US')} vs weekly baseline`;
}

function MetricCard({ label, value, delta, accent, icon }) {
  const d = Number(delta) || 0;
  const deltaClass =
    d > 0 ? accent : d < 0 ? 'text-rose-600' : 'text-slate-400';
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black text-slate-900">{formatCompact(value)}</p>
          <p className={`mt-0.5 sm:mt-1 text-xs sm:text-sm font-semibold ${deltaClass}`}>
            {formatDeltaWeek(delta)}
          </p>
        </div>
        <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl ${icon.wrap}`}>
          <span className={`text-xs sm:text-sm ${icon.text}`}>{icon.glyph}</span>
        </div>
      </div>
    </article>
  );
}

function DashboardChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  return (
    <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{p.label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{Math.round(Number(p.value || 0)).toLocaleString('en-US')}</p>
      <p
        className={`mt-1 text-sm font-semibold ${Number(p.delta) > 0 ? p.deltaColor : Number(p.delta) < 0 ? 'text-rose-600' : 'text-slate-400'
          }`}
      >
        {formatDeltaWeek(p.delta)}
      </p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState({
    gmbAccounts: 0,
    keywordsTracked: 0,
    dailyTraffic: 0,
    reviews: 0,
  });
  const [delta, setDelta] = useState({
    gmbAccounts: 0,
    keywordsTracked: 0,
    dailyTraffic: 0,
    reviews: 0,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch(apiUrl('/api/dashboard/metrics'));
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch dashboard metrics');
        }

        if (!mounted) return;

        setMetrics({
          gmbAccounts: data.current?.gmbAccounts || 0,
          keywordsTracked: data.current?.keywordsTracked || 0,
          dailyTraffic: data.current?.dailyTraffic || 0,
          reviews: data.current?.reviews || 0,
        });

        setDelta({
          gmbAccounts: data.deltas?.gmbAccounts || 0,
          keywordsTracked: data.deltas?.keywordsTracked || 0,
          dailyTraffic: data.deltas?.dailyTraffic || 0,
          reviews: data.deltas?.reviews || 0,
        });
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Unable to load dashboard metrics');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      {
        key: 'gmbAccounts',
        label: 'Total GMB Accounts (CRM paying)',
        value: metrics.gmbAccounts,
        delta: delta.gmbAccounts,
        accent: 'text-emerald-600',
        icon: { glyph: 'G', wrap: 'bg-emerald-50', text: 'text-emerald-700 font-bold' },
      },
      {
        key: 'keywordsTracked',
        label: 'Keywords Tracked',
        value: metrics.keywordsTracked,
        delta: delta.keywordsTracked,
        accent: 'text-cyan-600',
        icon: { glyph: 'K', wrap: 'bg-cyan-50', text: 'text-cyan-700 font-bold' },
      },
      {
        key: 'dailyTraffic',
        label: 'Daily Traffic',
        value: metrics.dailyTraffic,
        delta: delta.dailyTraffic,
        accent: 'text-indigo-600',
        icon: { glyph: 'T', wrap: 'bg-indigo-50', text: 'text-indigo-700 font-bold' },
      },
      {
        key: 'reviews',
        label: 'Google Reviews',
        value: metrics.reviews,
        delta: delta.reviews,
        accent: 'text-amber-600',
        icon: { glyph: 'R', wrap: 'bg-amber-50', text: 'text-amber-700 font-bold' },
      },
    ],
    [delta, metrics]
  );

  const chartData = useMemo(
    () =>
      cards.map((card) => ({
        key: card.key,
        label: card.label,
        short: card.label
          .replace('Total ', '')
          .replace('Google ', '')
          .replace(' Tracked', '')
          .replace(' Accounts', ''),
        value: Number(card.value) || 0,
        delta: Number(card.delta) || 0,
        fill:
          card.key === 'gmbAccounts'
            ? '#10b981'
            : card.key === 'keywordsTracked'
              ? '#06b6d4'
              : card.key === 'dailyTraffic'
                ? '#6366f1'
                : '#f59e0b',
        deltaColor: card.accent,
      })),
    [cards]
  );

  if (loading) {
    return <CenteredLoader message="Loading dashboard metrics..." />;
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <MetricCard
            key={card.key}
            label={card.label}
            value={card.value}
            delta={card.delta}
            accent={card.accent}
            icon={card.icon}
          />
        ))}
      </div>


      <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-0.5 sm:gap-1">
          <h3 className="text-lg sm:text-xl font-black text-slate-900">Performance Overview</h3>
          <p className="text-xs sm:text-sm text-slate-500">Visual summary of the dashboard metrics.</p>
        </div>

        <div className="h-[280px] sm:h-[400px] w-full rounded-2xl border border-slate-100 bg-slate-50/70 p-1 sm:p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 6 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="short"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                dy={4}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={formatCompact}
                width={40}
              />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} content={<DashboardChartTooltip />} />
              <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={66} animationDuration={650}>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </section>
  );
}
