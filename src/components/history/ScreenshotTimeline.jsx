import React from 'react';
import { outputsAssetUrl } from '../../apiBase';

export default function ScreenshotTimeline({ scans, selectedKeyword = 'ALL' }) {
  const flattenedScreenshots = [];

  scans.forEach(scan => {
    if (Array.isArray(scan.map_ranks)) {
      scan.map_ranks.forEach(rankObj => {
        if (selectedKeyword !== 'ALL' && rankObj.keyword !== selectedKeyword) return;

        // Support both snake_case and camelCase, and fallback to root scan screenshot
        const url = rankObj.screenshot_url || rankObj.screenshotUrl || scan.screenshot_url;

        if (!url) return;

        flattenedScreenshots.push({
          date: new Date(scan.scanned_at),
          keyword: rankObj.keyword,
          rank: rankObj.rank,
          url: url,
        });
      });
    }
  });

  if (flattenedScreenshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-gray-50 p-4 mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">No screenshots found for the selected view.</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">
          {selectedKeyword === 'ALL' ? 'Screenshot History (All Keywords)' : `Screenshot History: ${selectedKeyword}`}
        </h3>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-brand-mint/10">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-brand-pine">
                Date
              </th>
              <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-brand-pine">
                Time
              </th>
              {selectedKeyword === 'ALL' && (
                <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-brand-pine">
                  Keyword
                </th>
              )}
              <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-brand-pine">
                Rank
              </th>
              <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-brand-pine">
                Gallery Link
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {flattenedScreenshots.map((item, idx) => (
              <tr key={idx} className="transition-colors hover:bg-gray-50/50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-gray-900">
                  {item.date.toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-500">
                  {item.date.toLocaleTimeString()}
                </td>
                {selectedKeyword === 'ALL' && (
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" title={item.keyword}>
                    {item.keyword}
                  </td>
                )}
                <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-gray-900">
                  {item.rank != null ? item.rank : '-'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <a
                    href={outputsAssetUrl(item.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-brand-pine hover:text-brand-forest transition-colors hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Full Screen
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
