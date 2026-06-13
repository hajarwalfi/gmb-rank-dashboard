import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiUrl } from '../apiBase';

const styles = {
  page: { maxWidth: 980, margin: '0 auto', padding: 24 },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
    padding: 24,
  },
  title: { margin: 0, fontSize: 26, fontWeight: 700, color: '#1f2937' },
  subtitle: { margin: '6px 0 20px', color: '#6b7280', fontSize: 14 },
  tabs: {
    display: 'inline-flex',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tab: {
    border: 'none',
    background: '#fff',
    color: '#111827',
    padding: '10px 18px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabActive: { background: '#2563eb', color: '#fff' },
  grid: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: '12px 18px', alignItems: 'center' },
  label: { fontWeight: 600, color: '#111827' },
  input: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: 9,
    padding: '11px 12px',
    fontSize: 15,
    outline: 'none',
  },
  autocomplete: { position: 'relative', width: '100%' },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    maxHeight: 250,
    overflowY: 'auto',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    zIndex: 20,
  },
  item: { padding: '10px 12px', fontSize: 15, lineHeight: 1.35, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' },
  note: { marginTop: 8, color: '#6b7280', fontSize: 12 },
  actions: { marginTop: 18 },
  submitBtn: {
    border: 'none',
    borderRadius: 9,
    padding: '11px 16px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    background: '#2563eb',
    color: '#fff',
    minWidth: 150,
  },
  msg: { marginTop: 12, fontSize: 14, minHeight: 20 },
};

const translations = {
  usa: {
    title: 'Onboarding Auto Scoring',
    subtitle: 'Submit onboarding call details to the onboarding submission API.',
    labels: {
      businessName: 'Business Name',
      gmbProfile: 'GMB Profile',
      callLink: 'Onboarding Call Link',
    },
    submit: 'Submit',
  },
  spanish: {
    title: 'Puntuacion Automatizada de Onboarding',
    subtitle: 'Envia los datos de la llamada al API de onboarding.',
    labels: {
      businessName: 'Nombre del Negocio',
      gmbProfile: 'Perfil de GMB',
      callLink: 'Link de Llamada de Onboarding',
    },
    submit: 'Enviar',
  },
};

function extractBusinessTasks(payload) {
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.tasks)
      ? payload.tasks
      : Array.isArray(payload?.data?.tasks)
        ? payload.data.tasks
        : [];

  return rawList
    .map((item) => {
      const taskId = item?.taskId ?? item?.task_id ?? item?.id ?? null;
      const name = item?.name ?? item?.taskName ?? item?.business_name ?? '';
      const bizOwner = item?.bizOwnerName ?? item?.biz_owner_name ?? item?.ownerName ?? '';
      return {
        taskId: taskId ? String(taskId).trim() : '',
        name: String(name || '').trim(),
        bizOwnerName: String(bizOwner || '').trim(),
      };
    })
    .filter((item) => item.taskId && item.name)
    .map((item) => ({ ...item, label: item.bizOwnerName ? `${item.name} (${item.bizOwnerName})` : item.name }));
}

function extractGmbNames(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.names)
      ? payload.names
      : Array.isArray(payload?.data?.names)
        ? payload.data.names
        : [];
  return raw.map((name) => String(name || '').trim()).filter(Boolean);
}

export default function OnboardingAutoScoringPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState('usa');
  const [businessTasks, setBusinessTasks] = useState([]);
  const [gmbNames, setGmbNames] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [businessValue, setBusinessValue] = useState('');
  const [gmbValue, setGmbValue] = useState('');
  const [callLink, setCallLink] = useState('');
  const [showBusinessMenu, setShowBusinessMenu] = useState(false);
  const [showGmbMenu, setShowGmbMenu] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 100, label: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [taskHint, setTaskHint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const businessWrapRef = useRef(null);
  const gmbWrapRef = useRef(null);

  const t = translations[lang] || translations.usa;

  const filteredBusiness = useMemo(() => {
    const q = businessValue.toLowerCase().trim();
    if (!q) return businessTasks.slice(0, 100);
    return businessTasks.filter((item) => item.label.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)).slice(0, 100);
  }, [businessTasks, businessValue]);

  const filteredGmb = useMemo(() => {
    const q = gmbValue.toLowerCase().trim();
    if (!q) return gmbNames.slice(0, 100);
    return gmbNames.filter((name) => name.toLowerCase().includes(q)).slice(0, 100);
  }, [gmbNames, gmbValue]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!businessWrapRef.current?.contains(event.target)) setShowBusinessMenu(false);
      if (!gmbWrapRef.current?.contains(event.target)) setShowGmbMenu(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    async function loadDropdowns() {
      setLoadingDropdowns(true);
      try {
        const businessPath = lang === 'spanish' ? '/api/clickup-client-tracking-names-spanish' : '/api/clickup-client-tracking-names';
        const [businessRes, gmbRes] = await Promise.all([
          fetch(`https://click.acquisition-central.com${businessPath}`),
          fetch(`https://click.acquisition-central.com/api/gmb-profile-names`),
        ]);
        const [businessData, gmbData] = await Promise.all([businessRes.json(), gmbRes.json()]);
        if (!businessRes.ok) throw new Error(businessData?.error || 'Failed to load business names');
        if (!gmbRes.ok) throw new Error(gmbData?.error || 'Failed to load GMB profile names');
        setBusinessTasks(extractBusinessTasks(businessData));
        setGmbNames(extractGmbNames(gmbData));
        setMessage({ text: 'Business names and GMB profiles loaded.', isError: false });
      } catch (error) {
        setMessage({ text: error.message || 'Failed to load dropdown data.', isError: true });
      } finally {
        setLoadingDropdowns(false);
      }
    }
    loadDropdowns();
  }, [lang]);

  const resolveTaskId = () => {
    if (selectedTaskId) return selectedTaskId;
    const typed = businessValue.trim().toLowerCase();
    if (!typed) return null;
    const exact = businessTasks.find((item) => item.label.toLowerCase() === typed || item.name.toLowerCase() === typed);
    if (!exact) return null;
    setSelectedTaskId(exact.taskId);
    setBusinessValue(exact.label);
    setTaskHint(`Bound Task ID: ${exact.taskId}`);
    return exact.taskId;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const taskId = resolveTaskId();
    if (!taskId || !callLink.trim()) {
      toast.error('Please fill all required fields.');
      return;
    }

    setSubmitting(true);
    setMessage({ text: '', isError: false });

    try {
      // STEP 1: Validate Call Link
      toast.loading('Validating Onboarding Call Link...', { id: 'validation' });

      const validateRes = await fetch(apiUrl('/api/onboarding/fathom-api-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          callLink: callLink.trim(),
          businessName: businessValue.trim(),
          gmbProfileName: gmbValue.trim()
        }),
      });
      const validateData = await validateRes.json();

      if (!validateRes.ok) {
        toast.error(validateData.error || 'Validation failed. Please check the Call Link.', { id: 'validation' });
        setSubmitting(false);
        return;
      }

      // Check if we got a cached response (skip AI analysis!)
      if (validateData.cached && validateData.reportId) {
        toast.success('Found cached result! Loading instantly...', { id: 'validation' });

        const params = new URLSearchParams({
          taskId,
          reportId: validateData.reportId,
          businessName: businessValue.trim(),
          gmbProfile: gmbValue.trim(),
          lang
        });
        navigate(`/onboarding-checklist-report?${params.toString()}`);
        return;
      }

      // Fresh analysis needed - navigate with progressive mode
      toast.success('Call Link validated! Starting analysis...', { id: 'validation' });

      const { transcript, conductor, client, totalBatches, batchNames } = validateData;

      sessionStorage.setItem('onboarding_progressive', JSON.stringify({
        taskId,
        businessName: businessValue.trim(),
        gmbProfileName: gmbValue.trim(),
        fathomLink: callLink.trim(),
        transcript,
        conductor,
        client,
        totalBatches,
        batchNames,
        lang
      }));

      const params = new URLSearchParams({
        taskId,
        businessName: businessValue.trim(),
        gmbProfile: gmbValue.trim(),
        lang,
        mode: 'progressive'
      });
      navigate(`/onboarding-checklist-report?${params.toString()}`);
    } catch (error) {
      setSubmitting(false);
      setIsAnalyzing(false);
      setMessage({ text: error.message || 'Validation failed.', isError: true });
    }
  };


  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={styles.card}>
        <h1 style={styles.title}>{t.title}</h1>
        <p style={styles.subtitle}>{t.subtitle}</p>

        <div style={styles.tabs}>
          <button
            type="button"
            style={{ ...styles.tab, ...(lang === 'usa' ? styles.tabActive : {}) }}
            onClick={() => {
              setLang('usa');
              setSelectedTaskId(null);
              setBusinessValue('');
              setTaskHint('Task ID auto-selected from Business Name.');
              setMessage({ text: '', isError: false });
              setIsAnalyzing(false);
              setSubmitting(false);
            }}
          >
            USA
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(lang === 'spanish' ? styles.tabActive : {}) }}
            onClick={() => {
              setLang('spanish');
              setSelectedTaskId(null);
              setBusinessValue('');
              setTaskHint('Task ID auto-selected from Business Name.');
              setMessage({ text: '', isError: false });
              setIsAnalyzing(false);
              setSubmitting(false);
            }}
          >
            Espanol
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.grid}>
            <label style={styles.label}>{t.labels.businessName} *</label>
            <div style={styles.autocomplete} ref={businessWrapRef}>
              <input
                value={businessValue}
                onFocus={() => setShowBusinessMenu(true)}
                onChange={(e) => {
                  setBusinessValue(e.target.value);
                  setSelectedTaskId(null);
                  setTaskHint('Select a business from dropdown to bind task automatically.');
                  setShowBusinessMenu(true);
                }}
                placeholder="Search and select..."
                required
                style={styles.input}
              />
              {showBusinessMenu && (
                <div style={styles.menu}>
                  {loadingDropdowns ? (
                    <div style={{ ...styles.item, display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" fill="none" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" fill="none" strokeLinecap="round" />
                      </svg>
                      Loading options...
                    </div>
                  ) : filteredBusiness.length ? (
                    filteredBusiness.map((item) => (
                      <div
                        key={`${item.taskId}-${item.label}`}
                        style={styles.item}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setBusinessValue(item.label);
                          setSelectedTaskId(item.taskId);
                          setTaskHint(`Bound Task ID: ${item.taskId}`);
                          setShowBusinessMenu(false);
                        }}
                      >
                        {item.label}
                      </div>
                    ))
                  ) : (
                    <div style={styles.item}>No results found</div>
                  )}
                </div>
              )}
            </div>

            <label style={styles.label}>{t.labels.gmbProfile}</label>
            <div style={styles.autocomplete} ref={gmbWrapRef}>
              <input
                value={gmbValue}
                onFocus={() => setShowGmbMenu(true)}
                onChange={(e) => {
                  setGmbValue(e.target.value);
                  setShowGmbMenu(true);
                }}
                placeholder="Search and select..."
                style={styles.input}
              />
              {showGmbMenu && (
                <div style={styles.menu}>
                  {loadingDropdowns ? (
                    <div style={{ ...styles.item, display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" fill="none" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" fill="none" strokeLinecap="round" />
                      </svg>
                      Loading options...
                    </div>
                  ) : filteredGmb.length ? (
                    filteredGmb.map((name) => (
                      <div
                        key={name}
                        style={styles.item}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setGmbValue(name);
                          setShowGmbMenu(false);
                        }}
                      >
                        {name}
                      </div>
                    ))
                  ) : (
                    <div style={styles.item}>No results found</div>
                  )}
                </div>
              )}
            </div>

            <label style={styles.label}>{t.labels.callLink} *</label>
            <input
              value={callLink}
              onChange={(e) => setCallLink(e.target.value)}
              placeholder="https://fathom.video/calls/..."
              required
              style={styles.input}
            />
          </div>

          <div style={styles.note}>{taskHint}</div>

          {isAnalyzing && (
            <div style={{ marginTop: 22, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: '#2563eb' }}>{progress.label}</span>
                <span style={{ color: '#64748b' }}>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 0 10px rgba(37, 99, 235, 0.3)'
                  }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                Doing step-by-step analysis to ensure accuracy and avoid timeouts.
              </div>
            </div>
          )}

          <div style={styles.actions}>
            <button type="submit" disabled={submitting} style={{ ...styles.submitBtn, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Running Multi-Stage Analysis...' : t.submit}
            </button>
          </div>
          <div style={{ ...styles.msg, color: message.isError ? '#b91c1c' : '#475569' }}>{message.text}</div>
        </form>
      </div>
    </div>
  );
}
