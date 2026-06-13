import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const dataObj = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-gray-100 shadow-2xl rounded-2xl z-[9999] min-w-[200px] max-w-[240px] pointer-events-none">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-50">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Report Date</span>
            <span className="text-sm font-bold text-gray-800">{dataObj.date}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Time</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              {dataObj.time}
            </span>
          </div>
        </div>
        
        <div className="space-y-3">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-[11px] text-gray-500 font-medium truncate max-w-[150px]" title={entry.name}>
                  {entry.name}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-gray-400">Rank:</span>
                <span className={`text-xl font-black ${entry.value === 20 ? 'text-gray-300' : 'text-emerald-700'}`}>
                  {entry.value === 20 ? '>20' : `#${entry.value}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function RankChart({ scans, selectedKeyword, setSelectedKeyword }) {

  // Extract all unique keywords
  const allKeywords = useMemo(() => {
    const kwSet = new Set();
    scans.forEach(s => {
      if (Array.isArray(s.map_ranks)) {
        s.map_ranks.forEach(r => {
          if (r.keyword) kwSet.add(r.keyword);
        });
      }
    });
    return Array.from(kwSet);
  }, [scans]);

  // Format data
  const data = scans.map(s => {
    const d = new Date(s.scanned_at);
    return {
      timestamp: s.scanned_at,
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullTime: d.toLocaleString(),
      ... (Array.isArray(s.map_ranks) ? s.map_ranks.reduce((acc, r) => {
        acc[r.keyword] = r.rank != null ? r.rank : 20;
        return acc;
      }, {}) : {})
    };
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full mt-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 px-2">
        <div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">Google Search Rank Tracking</h3>
          <p className="text-sm text-gray-500 font-medium">Historical performance over time</p>
        </div>

        {/* Custom Dropdown */}
        <div className="relative w-full sm:w-80">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-3 text-sm font-bold text-gray-700 shadow-sm hover:border-emerald-500/50 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
          >
            <span className="text-left leading-tight py-1">{selectedKeyword === 'ALL' ? 'All Keywords ' : selectedKeyword}</span>
            <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
              <div className="absolute z-20 mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-72 overflow-y-auto py-2">
                <button
                  className={`w-full text-left px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-emerald-50 ${selectedKeyword === 'ALL' ? 'text-emerald-700 bg-emerald-50/50' : 'text-gray-600'}`}
                  onClick={() => { setSelectedKeyword('ALL'); setIsOpen(false); }}
                >
                  All Keywords
                </button>
                {allKeywords.map(kw => (
                  <button
                    key={kw}
                    className={`w-full text-left px-5 py-3 text-sm font-semibold transition-colors hover:bg-emerald-50 ${selectedKeyword === kw ? 'text-emerald-700 bg-emerald-50/50' : 'text-gray-600'}`}
                  onClick={() => { setSelectedKeyword(kw); setIsOpen(false); }}
                >
                  <span className="leading-normal">{kw}</span>
                </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart Render */}
      <div className="h-[350px] sm:h-[450px] w-full bg-white border border-gray-50 rounded-2xl sm:rounded-3xl p-2 sm:p-4 shadow-sm overflow-hidden">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              dy={10}
            />
            <YAxis 
              reversed 
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }} 
              tickLine={false} 
              axisLine={false} 
              domain={[1, 20]} 
              width={30}
              dx={-5}
            />
            
            {selectedKeyword !== 'ALL' && (
              <Tooltip 
                content={CustomTooltip} 
                cursor={{ stroke: '#10B981', strokeWidth: 1, strokeDasharray: '5 5' }} 
                allowEscapeViewBox={{ x: false, y: false }}
                offset={12}
                wrapperStyle={{ zIndex: 60, pointerEvents: 'none' }}
              />
            )}

            {selectedKeyword === 'ALL' ? (
              allKeywords.map((kw, i) => (
                <Line 
                  key={kw} 
                  type="monotone" 
                  dataKey={kw} 
                  name={kw} 
                  stroke={colors[i % colors.length]} 
                  strokeWidth={2.5} 
                  dot={{ r: 4, fill: colors[i % colors.length], strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls
                />
              ))
            ) : (
              <Line 
                type="monotone" 
                dataKey={selectedKeyword} 
                name={selectedKeyword} 
                stroke="#059669" 
                strokeWidth={5} 
                dot={{ r: 6, strokeWidth: 3, stroke: '#059669', fill: '#fff' }} 
                activeDot={{ r: 10, fill: '#059669', stroke: '#fff', strokeWidth: 4 }} 
                animationDuration={1500}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);
}
