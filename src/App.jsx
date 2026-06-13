import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiUrl } from './apiBase';
import Layout from './components/Layout';
import RankingForm from './components/RankingForm';
import RankingResults from './components/RankingResults';
import ReportHistory from './components/ReportHistory';
import GmbKeywordDashboard from './components/GmbKeywordDashboard';
import GmbAccountsTablePage from './pages/GmbAccountsTablePage';
import OnboardingAutoScoringPage from './pages/OnboardingAutoScoringPage';
import OnboardingChecklistReportPage from './pages/OnboardingChecklistReportPage';
import LoginPage from './pages/LoginPage';
import GmbAutomationRunPage from './pages/GmbAutomationRunPage';
import GmbHistoryListPage from './pages/GmbHistoryListPage';
import GmbRankHistoryPage from './pages/GmbRankHistoryPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import DashboardSidebar from './components/DashboardSidebar';
import GmbNotificationsPage from './pages/GmbNotificationsPage';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = (location?.pathname || '').toLowerCase();
  
  // -- Auth Logic --
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Main dashboard state — must stay above any early return (Rules of Hooks)
  const [activeTab, setActiveTab] = useState('dashboard');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    const admin = sessionStorage.getItem('isAdmin');
    setIsLoggedIn(admin === 'true');
    setAuthChecked(true);
  }, []);

  // Sync tab + ranking sub-view from URL (?tab= & ?view= scan | archive | loading | results)
  useEffect(() => {
    if (pathname !== '/' && pathname !== '') return;
    const p = new URLSearchParams(location.search);
    const t = p.get('tab');
    if (t && ['dashboard', 'ranking', 'gmb', 'gmbaccounts', 'settings', 'history', 'notifications'].includes(t)) {
      setActiveTab(t);
    }
    const view = p.get('view');
    setShowHistory(view === 'archive');
    if (t === 'ranking' && view === 'scan') {
      setReport(null);
      setError(null);
      setLoading(false);
    }
  }, [location.search, pathname]);

  // Keep login state in sync when returning to the tab or after login in same session
  useEffect(() => {
    const sync = () => {
      setIsLoggedIn(sessionStorage.getItem('isAdmin') === 'true');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setIsLoggedIn(false);
    setShowHistory(false);
    setReport(null);
    setError(null);
    navigate('/');
  };

  if (!authChecked) return null; // Prevent flicker

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Route onboarding pages while preserving existing dashboard app logic below.
  if (pathname === '/onboarding-auto-scoring') {
    return <OnboardingAutoScoringPage />;
  }
  if (pathname === '/onboarding-checklist-report') {
    return <OnboardingChecklistReportPage />;
  }
  if (pathname === '/gmb-rank-history') {
    return <GmbRankHistoryPage />;
  }

  const handleReportArchiveNav = () => {
    setActiveTab('ranking');
    setShowHistory(true);
    setReport(null);
    setError(null);
    navigate('/?tab=ranking&view=archive');
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    setError(null);
    setReport(null);
    setShowHistory(false);
    navigate('/?tab=ranking&view=loading');
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
      navigate('/?tab=ranking&view=results');
    } catch (e) {
      setError(e.message || 'The search request failed. Please check your connection.');
      navigate('/?tab=ranking&view=error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setError(null);
    setShowHistory(false);
    navigate('/?tab=ranking&view=scan');
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
          'This report is already in your archive.',
          { duration: 5000 }
        );
        return;
      }
      if (!res.ok) throw new Error(data.error || 'We could not save this report right now.');
      toast.success('Report successfully added to archive.', { duration: 4500 });
    } catch (e) {
      toast.error('Failed to save the report. Please try again.');
    } finally {
      setSaveBusy(false);
    }
  };
  const handleReportResultsChange = (nextResults) => {
    setReport((prev) => {
      if (!prev) return prev;
      return { ...prev, results: nextResults };
    });
  };

  let pageTitle = '';
  if (activeTab === 'dashboard') pageTitle = 'Dashboard';
  else if (activeTab === 'gmb') pageTitle = 'GMB Keyword Research';
  else if (activeTab === 'gmbaccounts') pageTitle = 'GMB Accounts';
  else if (activeTab === 'settings') pageTitle = 'Settings';
  else if (activeTab === 'history') {
    pageTitle = 'Analysis Results';
  } else if (activeTab === 'ranking') {
    pageTitle = showHistory ? 'Report Archive' : 'Ranking Analysis';
  } else if (activeTab === 'notifications') {
    pageTitle = 'Notifications';
  }

  return (
    <Layout
      onLogout={handleLogout}
      pageTitle={pageTitle}
      sidebar={
        <DashboardSidebar
          activeTab={activeTab}
          showHistory={showHistory}
          onReportArchive={handleReportArchiveNav}
          onNewRankingAnalysis={handleReset}
          showNewRankingButton={activeTab === 'ranking' && Boolean(report || showHistory || error)}
          onLogout={handleLogout}
        />
      }
    >
      {/* ── GMB Keyword Research tab ── */}
      {activeTab === 'dashboard' && <AdminDashboardPage />}
      {activeTab === 'gmb' && <GmbKeywordDashboard />}
      {activeTab === 'gmbaccounts' && <GmbAccountsTablePage />}
      {activeTab === 'settings' && <GmbAutomationRunPage />}
      {activeTab === 'history' && <GmbHistoryListPage />}
      {activeTab === 'notifications' && <GmbNotificationsPage />}

      {/* ── Ranking Analysis tab (existing code — untouched) ── */}

      {activeTab === 'ranking' && (
        <>
          {showHistory ? (
            <ReportHistory
              onBack={() => navigate('/?tab=ranking&view=scan')}
              onPick={(r) => {
                setReport({
                  businessName: r.businessName,
                  results: r.results,
                  generatedAt: r.generatedAt,
                  source: r.source,
                });
                setShowHistory(false);
                navigate('/?tab=ranking&view=results');
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
