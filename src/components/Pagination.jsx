import React from 'react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  // Always show pagination UI for layout consistency, even if only 1 page
  const safeTotalPages = Math.max(1, totalPages);

  const getPages = () => {
    const pages = [];
    const showMax = 7;

    if (safeTotalPages <= showMax) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (currentPage > 4) pages.push('...');

    let rangeStart = Math.max(2, currentPage - 1);
    let rangeEnd = Math.min(safeTotalPages - 1, currentPage + 1);
    
    if (currentPage <= 4) rangeEnd = 5;
    else if (currentPage >= safeTotalPages - 3) rangeStart = safeTotalPages - 4;

    for (let i = rangeStart; i <= rangeEnd; i++) {
      if (i > 1 && i < safeTotalPages) pages.push(i);
    }

    if (currentPage < safeTotalPages - 3) pages.push('...');
    pages.push(safeTotalPages);

    return [...new Set(pages)];
  };

  const pages = getPages();

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {/* Prev Arrow */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#0f172a] disabled:opacity-20 transition-all cursor-pointer disabled:cursor-default"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pages.map((p, i) => {
          if (p === '...') {
            return (
              <span key={`dots-${i}`} className="px-1 text-slate-300 font-bold text-xs tracking-widest">
                ...
              </span>
            );
          }

          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`flex h-9 min-w-[36px] items-center justify-center rounded-lg text-sm font-bold transition-all duration-200 
                ${p === currentPage 
                  ? 'bg-[#0f172a] text-white shadow-lg shadow-slate-900/20' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-[#0f172a]'}
              `}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Next Arrow */}
      <button
        onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
        disabled={currentPage === safeTotalPages}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#0f172a] disabled:opacity-20 transition-all cursor-pointer disabled:cursor-default"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
