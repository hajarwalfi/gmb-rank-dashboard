import React, { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../apiBase';
import { IoCall, IoChatboxEllipsesOutline } from 'react-icons/io5';
import { AiOutlineGlobal } from 'react-icons/ai';
import TrafficChart from '../components/history/TrafficChart';
import RankChart from '../components/history/RankChart';
import ReviewChart from '../components/history/ReviewChart';
import ScreenshotTimeline from '../components/history/ScreenshotTimeline';
import ScanTable from '../components/history/ScanTable';
import RankImpressionsChart from '../components/history/RankImpressionsChart';
import CenteredLoader from '../components/CenteredLoader';
import Pagination from '../components/Pagination';

/* ─── helpers ─── */
function calcAvgRank(scan) {
  const ranks = Array.isArray(scan?.map_ranks)
    ? scan.map_ranks.map(r => Number(r.rank)).filter(n => !isNaN(n) && n > 0)
    : [];
  if (!ranks.length) return 0;
  return ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

function calcTraffic(scan) {
  const keywords = Array.isArray(scan?.map_ranks) ? scan.map_ranks : [];
  if (!keywords.length) return 0;
  for (const row of keywords) {
    const raw = row?.raw_traffic_data || {};
    const t = Number(raw.total_clicks ?? row?.estimated_clicks ?? row?.volume);
    if (Number.isFinite(t)) return t;
  }
  const legacy = keywords.map((r) => Number(r?.estimated_clicks)).find((n) => Number.isFinite(n) && n > 0);
  return Number.isFinite(legacy) ? legacy : 0;
}

function calcAvgLatestDailyMetric(scan, metricKey, fallbackKey = null) {
  const keywords = Array.isArray(scan?.map_ranks) ? scan.map_ranks : [];
  if (!keywords.length) return 0;
  const total = keywords.reduce((sum, row) => {
    const raw = row?.raw_traffic_data || {};
    const latestDay = Array.isArray(raw.daily_breakdown_desc) ? raw.daily_breakdown_desc[0] : null;
    const value = Number(latestDay?.[metricKey] ?? (fallbackKey ? raw?.[fallbackKey] : undefined) ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  return total / keywords.length;
}

/* ─── Summary card ─── */
const UpdatesRow = ({ type, title, value, prevValue, date, keywordCount }) => {
  const colors = {
    rank: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-100',
    traffic: 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-100',
    calls: 'bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-indigo-100',
    chat: 'bg-cyan-50 text-cyan-600 border-cyan-100 group-hover:bg-cyan-100',
    website: 'bg-violet-50 text-violet-600 border-violet-100 group-hover:bg-violet-100',
    review: 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-100',
  };
  const textColors = {
    rank: 'text-emerald-600',
    traffic: 'text-blue-600',
    review: 'text-amber-600',
  };
  const icons = {
    rank: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    traffic: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    calls: <IoCall className="w-5 h-5" />,
    chat: <IoChatboxEllipsesOutline className="w-5 h-5" />,
    website: <AiOutlineGlobal className="w-5 h-5" />,
    review: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  };
  const diff = value - prevValue;
  const improved = type === 'rank' ? diff < 0 : diff > 0;
  const absDiff = Math.abs(diff).toFixed(type === 'rank' ? 1 : 0);
  const metricText = type === 'rank'
    ? 'Positions'
    : type === 'review'
      ? 'Reviews'
      : type === 'calls'
        ? 'Calls'
        : type === 'chat'
          ? 'Chat Clicks'
          : type === 'website'
            ? 'Website Clicks'
            : 'Growth';
  const improvementText =
    diff === 0
      ? 'Stable'
      : `${improved ? '+' : '-'}${absDiff} ${metricText}`;

  const badgeCls = diff === 0
    ? 'bg-blue-50 text-blue-600 border-blue-100'
    : improved
      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
      : 'bg-rose-50 text-rose-600 border-rose-100';

  return (
    <div className="group relative bg-white p-4 sm:p-5 md:p-6 rounded-[2rem] border border-slate-100 hover:border-emerald-200 transition-all duration-500 cursor-pointer hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] hover:-translate-y-2 flex flex-col items-center text-center justify-between gap-3 md:gap-3.5 min-h-[200px] md:min-h-[260px]">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mt-2 transition-transform duration-500 group-hover:scale-110 ${colors[type]}`}>
        {icons[type]}
      </div>
      <div className={`absolute top-4 right-4 md:top-6 md:right-6 px-2.5 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider border shadow-sm ${badgeCls}`}>
        {improvementText}
      </div>
      <div>
        <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">{title}</h4>
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tighter">
            {type === 'rank' ? value.toFixed(1) : value.toLocaleString()}
          </span>
          {keywordCount > 0 && (
            <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase">/ {keywordCount} KW</span>
          )}
        </div>
      </div>
      <div className="pt-3 md:pt-4 border-t border-slate-50 w-full">
        <p className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Last Detected</p>
        <p className="text-[9px] sm:text-[10px] md:text-[11px] font-black text-slate-500 tabular-nums">{date}</p>
      </div>
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-b from-emerald-50/0 to-emerald-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
};

/* ─── Metric row SVG icons ─── */
const RankSVG = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const TrafficSVG = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const ReviewSVG = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const ArrowRightSVG = () => (
  <svg className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

/* ─── Metric config ─── */
const METRIC_CFG = {
  rank: {
    label: 'Rank',
    icon: <RankSVG />,
    iconBg: 'bg-emerald-50 text-emerald-600',
    goodBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badBadge: 'bg-rose-50 text-rose-700 border-rose-200',
    neutralBadge: 'bg-slate-100 text-slate-500 border-slate-200',
    textColor: 'text-emerald-600',
    goodTip: 'Authority peak — boost engagement & post frequency.',
    badTip: 'Audit required — citation drift detected, fix NAP.',
    stableTip: 'Stable position — maintain current optimization rhythm.',
    badgeLabel: (diff) => diff > 0 ? `+${diff} Rank Positions` : diff < 0 ? `${diff} Rank Drop` : 'Stable Position',
  },
  traffic: {
    label: 'Daily Clicks',
    icon: <TrafficSVG />,
    iconBg: 'bg-blue-50 text-blue-600',
    goodBadge: 'bg-blue-50 text-blue-700 border-blue-200',
    badBadge: 'bg-rose-50 text-rose-700 border-rose-200',
    neutralBadge: 'bg-slate-100 text-slate-500 border-slate-200',
    textColor: 'text-blue-600',
    goodTip: 'Market expansion — high CTR, maintain GBP post cadence.',
    badTip: 'Visibility loss — review post frequency & photo updates.',
    stableTip: 'Stable traffic — consider increasing post frequency.',
    badgeLabel: (diff) => diff > 0 ? `+${diff} Clicks Increase` : diff < 0 ? `${diff} Clicks Decrease` : 'Stable Traffic',
  },
  calls: {
    label: 'Calls',
    icon: <IoCall className="w-5 h-5" />,
    iconBg: 'bg-indigo-50 text-indigo-600',
    goodBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    badBadge: 'bg-rose-50 text-rose-700 border-rose-200',
    neutralBadge: 'bg-slate-100 text-slate-500 border-slate-200',
    textColor: 'text-indigo-600',
    goodTip: 'Call demand rising - keep response time fast.',
    badTip: 'Call intent dropped - review call CTA visibility.',
    stableTip: 'Call volume stable - maintain current coverage.',
    badgeLabel: (diff) => diff > 0 ? `+${diff} Calls Increase` : diff < 0 ? `${diff} Calls Decrease` : 'Stable Calls',
  },
  reviews: {
    label: 'Google Reviews',
    icon: <ReviewSVG />,
    iconBg: 'bg-amber-50 text-amber-600',
    goodBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    badBadge: 'bg-rose-50 text-rose-700 border-rose-200',
    neutralBadge: 'bg-slate-100 text-slate-500 border-slate-200',
    textColor: 'text-amber-600',
    goodTip: 'Social proof high — respond to reviews within 24h.',
    badTip: 'Trust stagnant — activate review generation campaign.',
    stableTip: 'Trust holding — encourage reviews via follow-up messages.',
    badgeLabel: (diff) => diff > 0 ? `+${diff} New Google Reviews` : diff < 0 ? `${diff} Reviews Lost` : 'Stable Reviews',
  },
};

/* ─── Single keyword group — keyword as rowSpan=3 first column ─── */
function KeywordGroup({ kwData, isLast, index }) {
  const metrics = [
    { key: 'rank', ...kwData.rank },
    { key: 'traffic', ...kwData.traffic },
    { key: 'reviews', ...kwData.reviews },
  ];


  return (
    <>
      {metrics.map((m, i) => {
        const cfg = METRIC_CFG[m.key];
        const isGood = m.diff > 0;
        const isStable = m.diff === 0;
        const isFirst = i === 0;
        const isLastRow = i === metrics.length - 1 && isLast;
        const tip = isStable ? cfg.stableTip : isGood ? cfg.goodTip : cfg.badTip;

        // Format delta: all metrics use absolute value display now.
        const deltaVal = m.diff > 0 ? `+${m.diff}` : m.diff < 0 ? `${m.diff}` : '+0';
        const deltaCls = isGood
          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
          : isStable
            ? 'text-blue-500 bg-blue-50 border-blue-200'
            : 'text-rose-600 bg-rose-50 border-rose-200';

        return (
          <tr
            key={m.key}
            className={`group transition-colors hover:bg-slate-50/60
              ${isFirst ? 'border-t-2 border-t-slate-200' : ''}
              ${isLastRow ? '' : 'border-b border-b-slate-100/70'}`}
          >
            {isFirst && (
              <td rowSpan={metrics.length} className="px-4 py-3 align-middle w-[20%] bg-slate-50/60 border-r border-slate-100">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight leading-snug break-words block">{kwData.keyword}</span>
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1 block">{metrics.length} metrics</span>
              </td>
            )}

            <td className="px-4 py-3 w-[18%]">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>{cfg.icon}</div>
                <span className={`text-[10px] font-black uppercase tracking-tight ${cfg.textColor}`}>{cfg.label}</span>
              </div>
            </td>

            <td className="px-4 py-3 w-[10%]">
              <span className="text-[11px] font-bold tabular-nums text-slate-900">{m.oldVal}</span>
            </td>

            <td className="px-4 py-3 w-[10%]">
              <span className="text-[12px] font-bold tabular-nums text-slate-900">{m.newVal}</span>
            </td>

            <td className="px-4 py-3 w-[14%]">
              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-black border tabular-nums ${deltaCls}`}>
                {deltaVal}
              </span>
            </td>

            <td className="px-4 py-3 w-[28%]">
              <div className="flex items-start gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${isGood ? 'bg-emerald-400' : isStable ? 'bg-blue-400' : 'bg-rose-400'}`} />
                <p className="text-[9.5px] font-medium text-slate-500 leading-tight">{tip}</p>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/* ─── Main exported page ─── */
export default function GmbHistoryDetailPage({ businessId, onBack }) {
  const [data, setData] = useState(null);
  const [trackingGalleryLinks, setTrackingGalleryLinks] = useState({ old: '', latest: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('view-updates');
  const [kwPage, setKwPage] = useState(1);
  const KW_PER_PAGE = 3; // 3 keywords × 3 rows = 9 rows per page
  const ROWS_PER_KEYWORD = 3;

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const encodedId = encodeURIComponent(businessId);
        const res = await fetch(apiUrl(`/api/history/${encodedId}`));
        if (!res.ok) throw new Error('Failed to fetch details');
        const json = await res.json();
        setData(json.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [businessId]);

  useEffect(() => {
    let cancelled = false;
    const fetchGalleryLinks = async () => {
      try {
        const gmbKey = String(businessId || '').trim();
        if (!gmbKey) return;
        const res = await fetch(apiUrl(`/api/tracking/compare?gmbKey=${encodeURIComponent(gmbKey)}`));
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json) return;
        const old = String(json.olderGalleryUrl || json.olderGalleryUrlFromJson || '').trim();
        const latest = String(json.latestGalleryUrl || json.latestGalleryUrlFromJson || '').trim();
        if (!cancelled) setTrackingGalleryLinks({ old, latest });
      } catch {
        // best effort fallback
      }
    };
    fetchGalleryLinks();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const scans = useMemo(() => {
    return Array.isArray(data?.scans)
      ? [...data.scans].sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))
      : [];
  }, [data]);

  const latest = scans[0] || null;
  const prev = scans[1] || null;
  const keywordCount = latest?.map_ranks?.length || 0;

  /* Build one group per keyword with rank / traffic / review diffs */
  const keywordGroups = useMemo(() => {
    if (!latest) return [];
    return (latest.map_ranks || []).map(kw => {
      const oldKw = (prev?.map_ranks || []).find(o => o.keyword === kw.keyword);

      /* rank: lower number = better, so diff = oldR - curR (positive = improved) */
      const curR = Number(kw.rank) || 0;
      const oldR = oldKw ? (Number(oldKw.rank) || 0) : 0;
      const rankDiff = oldR - curR;

      /* click metrics: use latest GBP day vs second-latest day */
      const curRaw = kw?.raw_traffic_data || {};
      const breakdown = Array.isArray(curRaw.daily_breakdown_desc) ? curRaw.daily_breakdown_desc : [];
      const latestDay = breakdown[0] || null;
      const secondLatestDay = breakdown[1] || null;
      const curT = Number(latestDay?.overview ?? curRaw.overview_clicks ?? 0) || 0;
      const oldT = Number(secondLatestDay?.overview ?? 0) || 0;
      const trafficDiff = Math.round(curT - oldT);
      /* reviews */
      const curC = latest.reviews?.total_count || 0;
      const prevC = prev?.reviews?.total_count || 0;

      return {
        keyword: kw.keyword.split(',')[0],
        rank: {
          oldVal: oldR ? `#${oldR}` : '—',
          newVal: `#${curR}`,
          diff: rankDiff,
        },
        traffic: {
          oldVal: `${Math.round(oldT)}`,
          newVal: `${Math.round(curT)}`,
          diff: trafficDiff,
        },
        reviews: {
          oldVal: `${prevC}`,
          newVal: `${curC}`,
          diff: curC - prevC,
        },
      };
    });
  }, [latest, prev]);

  const totalKwPages = Math.ceil(keywordGroups.length / KW_PER_PAGE);

  const pagedGroups = useMemo(() => {
    const start = (kwPage - 1) * KW_PER_PAGE;
    return keywordGroups.slice(start, start + KW_PER_PAGE);
  }, [keywordGroups, kwPage]);

  /* Reset page on tab switch */
  useEffect(() => { setKwPage(1); }, [activeTab]);

  if (loading) return <CenteredLoader message="Loading detailed history..." />;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const tabs = [
    { key: 'view-updates', label: 'Updates', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { key: 'impressions', label: 'Impressions', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
    { key: 'traffic', label: 'Traffic', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { key: 'reviews', label: 'Reviews', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
    { key: 'table', label: 'Data', icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { key: 'gallery', label: 'Gallery', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75h18a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H3A.75.75 0 002.25 6v12a.75.75 0 00.75.75z' },
  ];

  const scanDate = latest
    ? new Date(latest.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const getScanGalleryLink = (scan) => {
    const direct = String(scan?.galleryUrl || '').trim();
    if (direct) return direct;
    const resultLink = String(scan?.result?.galleryUrl || '').trim();
    if (resultLink) return resultLink;
    const nestedLink = String(scan?.gallery?.link || '').trim();
    if (nestedLink) return nestedLink;
    return '';
  };

  const latestGalleryLink =
    String(trackingGalleryLinks?.latest || '').trim() ||
    String(data?.gallery_links?.latest || '').trim() ||
    getScanGalleryLink(latest);
  const olderGalleryLink =
    String(trackingGalleryLinks?.old || '').trim() ||
    String(data?.gallery_links?.old || '').trim() ||
    getScanGalleryLink(prev) ||
    latestGalleryLink;

  return (
    <div className="mx-auto max-w-7xl animate-fade-in p-3 md:p-6 bg-slate-50 min-h-screen pb-10">

      {/* ── Back ── */}
      <button
        onClick={onBack}
        className="mb-6 sm:mb-8 group inline-flex items-center text-xs sm:text-sm font-black text-slate-900 hover:text-emerald-600 transition-all uppercase tracking-widest"
      >
        <span className="mr-3 text-base sm:text-lg transform transition-transform group-hover:-translate-x-1">&larr;</span>
        Return to Dashboard
      </button>

      {/* ── Business header card ── */}
      <div className="mb-6 sm:mb-8 rounded-[2rem] sm:rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-slate-100/60 flex flex-col md:flex-row justify-between md:items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-[100px]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-3 border border-emerald-100">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            Active Tracking
          </div>
          <h1 className="text-[18px] sm:text-3xl font-black text-slate-900 tracking-tighter leading-none mb-3 uppercase">
            {data.business_name || 'Business Profile'}
          </h1>
          <p className="text-slate-400 font-bold flex items-center gap-2 text-[10px] uppercase tracking-wide">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {data.location}
          </p>
        </div>
        <div className="mt-6 md:mt-0 relative z-10 flex justify-center">
          <div className="flex flex-col items-center gap-1.5 p-4 sm:p-5 bg-slate-900 rounded-[1.5rem] shadow-xl shadow-slate-100 min-w-[120px] sm:min-w-[140px]">
            <span className="text-xl sm:text-2xl font-black text-white leading-none">{scans.length}</span>
            <span className="text-[8px] sm:text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">Total Scans</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-6 flex items-center gap-3 overflow-x-auto pb-2 table-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`group relative flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
              ${activeTab === tab.key
                ? 'bg-slate-900 text-white shadow-[0_10px_25px_-5px_rgba(15,23,42,0.3)] scale-105'
                : 'bg-white text-slate-400 border border-slate-100 hover:border-emerald-200 hover:text-emerald-600 shadow-sm hover:shadow-md'}`}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${activeTab === tab.key ? 'text-emerald-400' : 'text-slate-300 group-hover:text-emerald-500'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main panel ── */}
      <div className="rounded-[2.5rem] bg-white p-1 shadow-sm border border-slate-100/60 overflow-hidden">

        {/* UPDATES TAB */}
        {activeTab === 'view-updates' && latest && prev && (
          <div className="p-4 sm:p-6">

            {/* Business growth label */}
            <div className="mb-8 flex items-center p-1.5 bg-slate-100/50 rounded-2xl w-fit border border-slate-100 gap-1">
              <div className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-emerald-600 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Business Growth
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-[10px] sm:gap-[12px] md:gap-[16px] mb-10 sm:mb-12">
              <UpdatesRow type="rank" title="Search Position" keywordCount={keywordCount} value={calcAvgRank(latest)} prevValue={calcAvgRank(prev)} date={scanDate} />
              <UpdatesRow type="traffic" title="Market Reach" keywordCount={keywordCount} value={calcTraffic(latest)} prevValue={calcTraffic(prev)} date={scanDate} />
              <UpdatesRow type="review" title="Reviews" keywordCount={0} value={latest.reviews?.total_count || 0} prevValue={prev.reviews?.total_count || 0} date={scanDate} />
              <UpdatesRow
                type="calls"
                title="Call Clicks"
                keywordCount={0}
                value={calcAvgLatestDailyMetric(latest, 'calls', 'call_clicks')}
                prevValue={calcAvgLatestDailyMetric(prev, 'calls', 'call_clicks')}
                date={scanDate}
              />
              <UpdatesRow
                type="chat"
                title="Chat Clicks"
                keywordCount={0}
                value={calcAvgLatestDailyMetric(latest, 'chat_clicks')}
                prevValue={calcAvgLatestDailyMetric(prev, 'chat_clicks')}
                date={scanDate}
              />
              <UpdatesRow
                type="website"
                title="Website Clicks"
                keywordCount={0}
                value={calcAvgLatestDailyMetric(latest, 'website_clicks')}
                prevValue={calcAvgLatestDailyMetric(prev, 'website_clicks')}
                date={scanDate}
              />
            </div>

            {/* Growth Intelligence Table */}
            <div className="animate-fade-in">

              {/* Section header */}
              <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Growth Intelligence Table</h2>
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-0.5">Keyword-Level Performance Analytics</p>
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[8px] sm:text-[9px] font-black uppercase border border-emerald-100 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />Rank
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[8px] sm:text-[9px] font-black uppercase border border-blue-100 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-blue-500" />Traffic
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[8px] sm:text-[9px] font-black uppercase border border-amber-100 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-500" />Reviews
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 overflow-hidden shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-x-auto table-scrollbar">
                <table className="w-full border-collapse min-w-[850px]" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      <th className="px-4 py-4 w-[20%] align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607" /></svg>
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">Keyword</span>
                        </div>
                      </th>
                      <th className="px-4 py-4 w-[18%] align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">Metric</span>
                        </div>
                      </th>
                      <th className="px-4 py-4 w-[10%] align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">Old</span>
                        </div>
                      </th>
                      <th className="px-4 py-4 w-[10%] align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">Now</span>
                        </div>
                      </th>
                      <th className="px-4 py-4 w-[14%] align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">Change</span>
                        </div>
                      </th>
                      <th className="px-4 py-4 w-[28%] align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">Suggestions</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedGroups.map((kw, i) => (
                      <KeywordGroup
                        key={`${kw.keyword}-${i}`}
                        kwData={kw}
                        isLast={i === pagedGroups.length - 1}
                        index={(kwPage - 1) * KW_PER_PAGE + i}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalKwPages > 1 && (
                <div className="mt-6 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Showing rows {(kwPage - 1) * KW_PER_PAGE * ROWS_PER_KEYWORD + 1}–{Math.min(kwPage * KW_PER_PAGE * ROWS_PER_KEYWORD, keywordGroups.length * ROWS_PER_KEYWORD)} of {keywordGroups.length * ROWS_PER_KEYWORD}
                  </p>
                  <Pagination currentPage={kwPage} totalPages={totalKwPages} onPageChange={setKwPage} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* No prev scan */}
        {activeTab === 'view-updates' && (!latest || !prev) && (
          <div className="p-24 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
            <p className="text-slate-400 font-black uppercase tracking-widest text-[9px]">
              Baseline Established • Next scan will show updates
            </p>
          </div>
        )}

        {/* Other tabs */}
        {activeTab !== 'view-updates' && (
          <div className="p-4 sm:p-8 ">
            {activeTab === 'impressions' && <RankImpressionsChart scans={scans} />}
            {activeTab === 'traffic' && <TrafficChart scans={scans} />}
            {activeTab === 'reviews' && <ReviewChart scans={scans} />}
            {activeTab === 'table' && <ScanTable scans={scans} />}
            {activeTab === 'gallery' && (
              <div className="max-w-3xl mx-auto">
                <div className="mb-6 text-center">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">GMB Gallery Links</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Last two scans visual proof</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/60 p-5 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Older Scan Gallery</p>
                    <button
                      type="button"
                      onClick={() => {
                        const url = olderGalleryLink || latestGalleryLink;
                        if (!url) return;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className={`inline-flex items-center justify-center w-full px-4 py-3 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                        olderGalleryLink || latestGalleryLink ? 'hover:bg-slate-700' : 'opacity-60'
                      }`}
                    >
                      Open Old Gallery
                    </button>
                  </div>
                  <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700 mb-2">Latest Scan Gallery</p>
                    <button
                      type="button"
                      onClick={() => {
                        const url = latestGalleryLink || olderGalleryLink;
                        if (!url) return;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className={`inline-flex items-center justify-center w-full px-4 py-3 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                        latestGalleryLink || olderGalleryLink ? 'hover:bg-emerald-700' : 'opacity-60'
                      }`}
                    >
                      Open Latest Gallery
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screenshot timeline */}
      {activeTab === 'impressions' && latest?.map_ranks?.length > 0 && (
        <div className="mt-6 rounded-[2.5rem] bg-white p-8 shadow-sm border border-slate-100/60 overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">Screenshot Timeline</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Visual Evidence Archive</p>
            </div>
          </div>
          <ScreenshotTimeline scans={scans} selectedKeyword="ALL" />
        </div>
      )}
    </div>
  );
}