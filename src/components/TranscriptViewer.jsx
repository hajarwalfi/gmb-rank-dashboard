import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * TranscriptViewer Component
 * Displays the full transcript with highlighted detected moments.
 * Features:
 * - Click timestamp to jump to that section
 * - Highlight matched checklist items
 * - Search/phrase filtering
 */
export default function TranscriptViewer({ 
  transcript = '', 
  detectedMoments = [],
  isOpen = false,
  onClose 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTimestamp, setActiveTimestamp] = useState(null);
  const contentRef = useRef(null);

  // Helper: Normalize '0:00', '[0:00]', or '0:00 - Name' to total seconds
  const parseTimeToSeconds = (t) => {
    if (!t) return -1;
    // Remove brackets and split by dash to handle "0:00 - Name"
    const clean = t.replace(/[\[\]]/g, '').split('-')[0].trim();
    const parts = clean.split(':').map(Number);
    if (parts.some(isNaN)) return -1;
    
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return -1;
  };

  // Parse detected moments from analysis items
  const moments = useMemo(() => {
    return detectedMoments
      .filter(m => m && m.covered && m.timestamp)
      .map(m => ({
        timestamp: m.timestamp,
        text: m.itemText,
        reason: m.reason || '', 
        confidence: m.confidence || 0
      }))
      .sort((a, b) => {
        const timeA = parseTimeToSeconds(a.timestamp);
        const timeB = parseTimeToSeconds(b.timestamp);
        return timeA - timeB;
      });
  }, [detectedMoments]);

  // Filter transcript lines based on search
  const filteredTranscript = useMemo(() => {
    if (!searchTerm.trim()) return transcript;
    const lines = transcript.split('\n');
    const filtered = lines.filter(line => 
      line.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered.join('\n');
  }, [transcript, searchTerm]);

  // Scroll to timestamp section with precision and normalized matching
  const jumpToTimestamp = (timestamp) => {
    setSearchTerm(''); // Clear search so the line exists in DOM
    setActiveTimestamp(timestamp);
    const targetSeconds = parseTimeToSeconds(timestamp);
    
    setTimeout(() => {
      if (contentRef.current) {
        const moment = moments.find(m => m.timestamp === timestamp);
        const quoteMatch = moment?.reason?.match(/"([^"]+)"/);
        const quote = quoteMatch ? quoteMatch[1] : (moment?.reason?.length < 100 ? moment?.reason : '');

        const transcriptLines = contentRef.current.querySelectorAll('.transcript-line');
        let element = null;

        // Strategy 1: Normalized Time Match (Handles 0:01 vs 00:01)
        if (targetSeconds !== -1) {
          for (const line of transcriptLines) {
            const lineTimeSource = line.getAttribute('data-timestamp');
            if (lineTimeSource && parseTimeToSeconds(lineTimeSource) === targetSeconds) {
              element = line;
              break;
            }
          }
        }

        // Strategy 2: Text Search Fallback
        if (!element) {
          for (const line of transcriptLines) {
            if (line.innerText.includes(timestamp)) {
              element = line;
              break;
            }
          }
        }

        // Strategy 3: Quote search fallback
        if (!element && quote && quote.length > 5) {
          for (const node of transcriptLines) {
            if (node.innerText.toLowerCase().includes(quote.toLowerCase())) {
              element = node;
              break;
            }
          }
        }

        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 150); 
  };

  if (!isOpen) return null;

  const currentTranscriptLines = filteredTranscript ? filteredTranscript.split('\n') : [];
  const activeSeconds = parseTimeToSeconds(activeTimestamp);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 animate-in fade-in duration-200 text-brand-midnight">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-brand-frost p-1.5 sm:p-2 rounded-lg shadow-sm">
              <svg className="w-4 sm:w-5 h-4 sm:h-5 text-brand-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-brand-midnight leading-tight tracking-tight">Call Transcript</h2>
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium tracking-wide">Syncing {moments.length} highlights to timeline</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors group"
          >
            <svg className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-forest transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search phrases (scrolling syncs automatically)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-sage/40 focus:border-brand-sage shadow-sm transition-all"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Detected Moments Sidebar */}
          {moments.length > 0 && (
            <div className="md:w-72 border-b md:border-b-0 md:border-r border-gray-100 p-3 sm:p-4 flex-shrink-0 bg-white">
              <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
                Detected Highlights
              </h3>
              <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto md:overflow-x-visible pb-2 md:pb-0 md:max-h-[calc(100vh-320px)] scrollbar-hide md:scrollbar-thin">
                {moments.map((moment, idx) => (
                  <button
                    key={idx}
                    onClick={() => jumpToTimestamp(moment.timestamp)}
                    className={`flex-shrink-0 min-w-[160px] sm:min-w-[200px] md:min-w-0 md:w-full text-left p-4 rounded-2xl transition-all duration-300 ${
                      activeTimestamp === moment.timestamp 
                        ? 'bg-brand-sage/20 border border-brand-sage shadow-md ring-2 ring-brand-sage/10 scale-[1.01]' 
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] sm:text-xs font-mono font-bold text-brand-forest px-1.5 py-0.5 bg-brand-sage/10 rounded">
                        {moment.timestamp}
                      </span>
                      <span className="text-[9px] sm:text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold shadow-sm whitespace-nowrap">
                        {Math.round(moment.confidence * 100)}% Match
                      </span>
                    </div>
                    <p className={`text-[10px] sm:text-xs leading-relaxed transition-colors ${activeTimestamp === moment.timestamp ? 'text-brand-midnight font-bold' : 'text-gray-600 font-medium'}`}>
                       {moment.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transcript Content */}
          <div 
            ref={contentRef}
            className="flex-1 p-4 sm:p-8 overflow-y-auto font-mono text-xs sm:text-sm leading-relaxed text-brand-midnight bg-white scroll-smooth"
          >
            <div className="max-w-3xl mx-auto space-y-1">
              {currentTranscriptLines.length > 0 ? (
                currentTranscriptLines.map((line, idx) => {
                  // Flexible detection for "0:01 - Kurtis Smith" OR "[0:01]"
                  const tsMatch = line.match(/^(\d+:\d+(?::\d+)?)\s+-|\[(\d+:\d+(?::\d+)?)\]/);
                  const tsStr = tsMatch ? (tsMatch[1] || tsMatch[2]) : null;
                  const lineSec = parseTimeToSeconds(tsStr);
                  const isActive = activeSeconds !== -1 && lineSec !== -1 && lineSec === activeSeconds;

                  return (
                    <div 
                      key={idx}
                      data-timestamp={tsStr}
                      className={`transcript-line px-4 py-2 rounded-xl transition-all duration-300 ${
                        isActive 
                          ? 'bg-brand-sage/25 text-brand-forest font-bold border-l-4 border-brand-forest shadow-lg ring-1 ring-brand-sage/50 translate-x-1' 
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {line}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-400 py-16 sm:py-24">
                  <p className="text-sm font-bold">No Transcript Content Found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/90 flex items-center justify-between font-bold">
          <div className="flex items-center gap-6">
            <span className="text-[10px] sm:text-xs text-gray-500">
               {transcript ? `${transcript.split('\n').length} Segments Captured` : '0 segments'}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] sm:text-xs text-green-700 uppercase tracking-widest">Live Sync Enabled</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-7 py-3 bg-brand-forest text-white rounded-2xl text-xs sm:text-sm shadow-lg hover:bg-brand-pine transition-all uppercase tracking-wider"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
