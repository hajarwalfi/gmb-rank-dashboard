import React from 'react';

export default function CenteredLoader({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full py-12 mb-24 animate-in fade-in duration-500">
      <div className="relative flex h-16 w-16 items-center justify-center">
        {/* Outer pulse ring */}
        <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
        {/* Inner spinning loader */}
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-emerald-500 shadow-sm" />
      </div>
      <p className="mt-6 text-base font-bold tracking-tight text-slate-700">
        {message}
      </p>
      <div className="mt-2 flex items-center gap-1">
        <div className="h-1 w-1 animate-bounce rounded-full bg-emerald-500" />
        <div className="h-1 w-1 animate-bounce rounded-full bg-emerald-500 [animation-delay:0.2s]" />
        <div className="h-1 w-1 animate-bounce rounded-full bg-emerald-500 [animation-delay:0.4s]" />
      </div>
    </div>
  );
}
