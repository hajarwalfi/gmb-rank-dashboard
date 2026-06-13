import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiUrl } from '../apiBase';
import Layout from '../components/Layout';
import RankingForm from '../components/RankingForm';
import RankingResults from '../components/RankingResults';
import ReportHistory from '../components/ReportHistory';
import GmbKeywordDashboard from '../components/GmbKeywordDashboard';

export default function RankingDashboard() {
  const [activeTab, setActiveTab] = useState('ranking');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const handleSubmit = async (data) => {
    setLoading(true);
    setError(null);
    setReport(null);
    setShowHistory(false);
    try {
      const res = await fetch(apiUrl('/api/ranking/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'We could not complete this ranking check right now.');
      }
      const result = await res.json();
      setReport({ ...result, primaryCategory: data.primaryCategory || '' });
    } catch (e) {
      setError(e.message || 'We could not complete this ranking check right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setError(null);
    setShowHistory(false);
  };

  const handleSaveReport = async () => {
    if (!report || saveBusy) return;
    setSaveBusy(true);
    try {
      const res = await fetch(apiUrl('/api/report/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: report.businessName,
          results: report.results,
          generatedAt: report.generatedAt,
          source: report.source,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.error(
          data.error || 'This report is already saved. Run a new search for another copy.',
          { duration: 5000 }
        );
        return;
      }
      if (!res.ok) throw new Error(data.error || 'We could not save this report right now.');
      toast.success(data.message || 'Your report has been saved successfully.', { duration: 4500 });
    } catch (e) {
      toast.error(e.message || 'We could not save this report right now. Please try again.');
    } finally {
      setSaveBusy(false);
    }
  };

  const handleReportResultsChange = (nextResults) => {
    setReport((prev) => (prev ? { ...prev, results: nextResults } : prev));
  };

  const navBtn =
    'rounded-2xl border border-brand-mint/80 bg-white/90 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-pine shadow-sm transition hover:bg-brand-frost print:hidden';

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('ranking')}
          className={`rounded-2xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition print:hidden ${
            activeTab === 'ranking'
              ? 'bg-brand-midnight text-white border border-brand-midnight'
              : 'border border-brand-mint/80 bg-white/90 text-brand-pine hover:bg-brand-frost'
          }`}
        >
          Ranking Analysis
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gmb')}
          className={`rounded-2xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition print:hidden ${
            activeTab === 'gmb'
              ? 'bg-brand-midnight text-white border border-brand-midnight'
              : 'border border-brand-mint/80 bg-white/90 text-brand-pine hover:bg-brand-frost'
          }`}
        >
          GMB Keyword Research
        </button>

        {activeTab === 'ranking' && (
          <>
            <button
              type="button"
              className={navBtn}
              onClick={() => {
                setShowHistory(true);
                setReport(null);
                setError(null);
              }}
            >
              Report Archive
            </button>
            {(report || showHistory || error) && (
              <button type="button" className={navBtn} onClick={handleReset}>
                New Ranking Analysis
              </button>
            )}
          </>
        )}
      </div>

      {activeTab === 'gmb' && <GmbKeywordDashboard />}

      {activeTab === 'ranking' && (
        <>
          {showHistory ? (
            <ReportHistory
              onBack={() => setShowHistory(false)}
              onPick={(r) => {
                setReport({
                  businessName: r.businessName,
                  results: r.results,
                  generatedAt: r.generatedAt,
                  source: r.source,
                });
                setShowHistory(false);
              }}
            />
          ) : !report ? (
            <>
              <RankingForm onSubmit={handleSubmit} disabled={loading} />
              {loading && (
                <div className="mt-6 rounded-xl border border-brand-mint bg-brand-white p-6 text-center shadow-sm flex flex-col items-center justify-center">
                  <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-brand-mint border-t-brand-forest shadow-sm" />
                  <p className="mt-4 font-medium text-brand-pine animate-pulse">Checking your ranking, this may take a moment...</p>
                </div>
              )}
              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center font-medium shadow-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          ) : (
            <RankingResults
              report={report}
              onNewSearch={handleReset}
              onSaveReport={handleSaveReport}
              saveBusy={saveBusy}
              onReportResultsChange={handleReportResultsChange}
            />
          )}
        </>
      )}
    </Layout>
  );
}
