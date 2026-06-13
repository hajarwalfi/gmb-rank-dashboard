import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiUrl } from '../apiBase';
import TranscriptViewer from '../components/TranscriptViewer';

// Skeleton loading CSS
const SKELETON_CSS = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes checkPop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
.skeleton-shimmer {
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.check-pop {
  animation: checkPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
.step-fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

// Step names for progressive loading (matches backend batch order)
const STEP_LABELS = [
  'Preparation Phase',
  'GMB Checkup',
  'Step 1 - LeadConnector Access',
  'Step 2 - Website Walkthrough',
  'Step 3 - Form & SMS Test',
  'Step 4 - Google Reviews & Referral',
  'Step 5 - GMB Optimization & Integrity',
  'Step 6 - Card Verification',
  'Step 7 - A2P Client Briefing',
  'Step 8 - Social Proof / Results',
  'Step 9 - Update Form',
  'Step 10 - Update GoHighLevel Pipeline',
  'Step 11 - Regular Updates',
  'Close the Call'
];

const OLD_UI_STEP_TEMPLATES = [
  {
    stepName: 'LeadConnector Access',
    aliases: ['leadconnector access', 'leadconnector'],
    fallbackItems: [
      'Client logs into LeadConnector',
      'Add client as Staff in Client Sub Account\nSettings → Staff → Advanced Settings',
      'Set password for client',
      'Client confirms successful login',
    ],
    goal: 'Client has login access + can respond to messages.',
    warning: 'If login fails → STOP and resolve before continuing.',
    sectionLabel: 'SETUP',
  },
  {
    stepName: 'Website Walkthrough',
    aliases: ['website walkthrough', 'walkthrough'],
    fallbackItems: [
      'Walk client through every page',
      'Ask for specific design/content changes',
      'Write ALL changes live in Google Doc',
      'Explain Blog Strategy (SEO & Traffic)',
      'Submit Google Doc to builders',
    ],
    goal: 'Capture all required changes clearly in writing.',
    sectionLabel: 'WALKTHROUGH',
  },
  {
    stepName: 'Form & SMS Test',
    aliases: ['sms test', 'form & sms test'],
    fallbackItems: [
      'Submit website form live',
      'Check conversations in Sub Account',
      'Confirm client received SMS notification',
      'Client saves contact as "Business Notification"',
      'Client replies from LeadConnector app',
      'Reply appears in CRM Conversations',
      '"System Update" contact saved by client',
    ],
    goal: 'Website Form → SMS Notification → Reply in CRM.',
    sections: [
      { label: 'TEST FLOW', count: 4 },
      { label: 'REPLY VERIFICATION', count: 3 }
    ],
  },
  {
    stepName: 'Google Review & Referral System',
    aliases: ['google reviews', 'referral', 'review funnel'],
    fallbackItems: [
      'Open 1 Year Follow Up Form Builder',
      'Send integration link to client',
      'Submit test form (Own Name/Number)',
      'Show 5-star link vs Private Feedback logic',
      'Review Review/Referral workflow',
      'Explain 8-day wait / 8-week recurring',
      'Request past customer database (CSV)',
      'Explain 4-week SMS cadence logic',
    ],
  },
  {
    stepName: 'GMB Optimization & Integrity',
    aliases: ['gmb optimization', 'gmb'],
    fallbackItems: [
      'Profile Completion: All fields filled; description keyword-rich.',
      'Services: All core services added with clear descriptions.',
      'Photos: Logo, cover, team, and work photos (NO STOCK).',
      'Business Info: Correct hours, phone, and website link.',
      'Profile Health: Green check status; no errors/suspensions.',
      'Service Areas: Specific geographic areas added correctly.',
      'Auto Review Replies: Mention we auto-reply to all their Google reviews.',
      'Weekly Google Posts: Mention we create daily Google posts on their profile every week for 5-star reviews.',
    ],
    goal: 'Optimize for visibility without triggering suspensions.',
    subtitle: 'HIGH IMPACT',
    sections: [
      { label: 'PROFILE SETUP', count: 3 },
      { label: 'VERIFICATION', count: 5 }
    ],
    criticalWarning: {
      title: 'Critical — Do Not Violate',
      message: 'Never edit: Business Name, Primary Category, or Address.',
      badges: ['Name', 'Category', 'Address']
    },
  },
  {
    stepName: 'Card Verification',
    aliases: ['card verification', 'card'],
    fallbackItems: [
      'Manually rebill client $1 activation fee for subscription\nWe need this $1 to start the activation fee for the monthly subscription — without it, messaging won\'t work.',
      'If $1 charge succeeds — card is verified, proceed with onboarding',
      'If $1 charge fails — switch them to another subscription with a new card\nUse Stripe or another payment processor to verify a working card.',
      'Confirm a valid, working card is on file',
      'A2P costs $20: Inform client that the A2P registration fee is $20 (we cover it)',
      'If client declines A2P: Stop screen sharing, then buy a toll-free number for them during the call\nUse YOUR ID to purchase the toll-free number — do NOT do this while screen sharing.',
      'Have client save the toll-free number as a contact on their phone',
      'Have client save the TextGrid number as a contact on their phone',
      'Total contacts saved: 2 numbers — toll-free number AND TextGrid number',
      'Confirm both numbers are saved as contacts before moving on',
    ],
    goal: 'Verify client has a valid card on file so messaging will work.',
    sections: [
      { label: 'CARD VERIFICATION (REQUIRED)', count: 4 },
      { label: 'IF CLIENT DECLINES A2P ADD-ON', count: 6 }
    ],
    warning: 'Messaging will NOT work without a verified card — do not skip this step.',
  },
  {
    stepName: 'A2P Client Briefing',
    aliases: ['a2p', 'messaging system'],
    fallbackItems: [
      'Tell client we will eventually switch their phone systems to A2P',
      'Explain A2P benefits: reply stops reduced by ~90%, much better human deliverability, far less spam',
      'Explain A2P registration means their business can send automated messages through any type of software',
      'Show client what A2P registration is — Google it live on screen share so they can see',
      'Mention we fill out an A2P Registration form on their behalf',
      'Tell client the form costs $20 to start, but we cover that cost',
      'Explain the only con: ~$10–15/month extra depending on messaging volume',
      'Tell client: once registration is complete, we will give them a new stronger number to enable it',
    ],
    goal: 'Inform the client about A2P registration and its benefits.',
    sections: [
      { label: 'REQUIRED — EXPLAIN TO CLIENT', count: 8 }
    ],
    warning: 'Every client MUST be informed about A2P during onboarding — do not skip this.',
  },
  {
    stepName: 'Show Client Results — Social Proof',
    aliases: ['social proof', 'results'],
    fallbackItems: [
      'Google "concrete contractor Muskegon Michigan" live on screen share',
      'Show client: McKinley Concrete is ranked #1 on Google',
      'Explain that reviews are the main reason they rank so high and get so many leads',
      'Point out their Google review count and rating',
      'Google "plumber Newport NC" live on screen share',
      'Show client: MC Maintenance is ranked #2 on Google',
      'Explain that reviews drove them to the top and are generating consistent leads',
      'Point out their Google review count and rating',
      'Key message: The reason these businesses are getting tons of leads is because of their reviews',
      'Explain: more reviews = higher Google ranking = more visibility = more leads',
      'Tell client: this is exactly what we are building for YOUR business',
      'Emphasize: getting reviews is the single most important thing they can do to grow',
    ],
    goal: 'Show the client real examples of businesses we rank on Google — this builds trust and emphasizes the importance of reviews.',
    banner: 'This step is REQUIRED — every client must see these results. Reviews are the #1 reason these businesses are getting leads.',
    sections: [
      { label: 'MCKINLEY CONCRETE', count: 4 },
      { label: 'MC MAINTENANCE', count: 4 },
      { label: 'DRIVE THE POINT HOME', count: 4 }
    ],
    warning: 'Do NOT skip this step — showing real proof is critical to getting client buy-in on reviews.',
  },
  {
    stepName: 'Update Form',
    aliases: ['form submission', 'update form'],
    fallbackItems: [
      'Open the Onboarding Form (link below)\nhttps://onboarding-form-usaaaa.vercel.app/',
      'Choose between English or Spanish before filling out the form',
      'Fill in all required fields and submit the form',
      'Confirm form submission was successful',
      'AFTER submitting the Onboarding Form: Open the Client Tracking Editor (link below)',
      'Verify client business name is correct',
      'Verify client phone number is correct',
      'Verify client email address is correct',
      'Verify website URL is correct',
      'Update any website change notes for builders',
      'Confirm all tracking details are accurate and saved\nDouble-check everything — builders rely on this info to make updates.',
      'Create call recording ticket with Fathom\nFor Fathom setup — make sure you get invited to our team Fathom from your work/personal email.',
    ],
    goal: 'Update the Onboarding Form after every call — this is REQUIRED. Make sure you choose between English and Spanish.',
    sections: [
      { label: 'ONBOARDING FORM (REQUIRED)', count: 4 },
      { label: 'UPDATE CLIENT TRACKING (REQUIRED — DO THIS AFTER THE FORM)', count: 7 },
      { label: 'FATHOM RECORDING', count: 1 }
    ],
    warning: 'Do NOT close the call without updating the Onboarding Form AND the Client Tracking Editor — both must happen every time.',
    isUpdateForm: true,
  },
  {
    stepName: 'Update GoHighLevel Pipeline',
    aliases: ['pipeline setup', 'pipeline', 'gohighlevel'],
    fallbackItems: [
      'Open client card in GoHighLevel',
      'Move card to correct pipeline stage',
      'Verify all contact details are up to date',
      'Confirm pipeline stage reflects onboarding completion',
    ],
    goal: 'Move the client card to the correct pipeline stage after onboarding.',
    sections: [
      { label: 'PIPELINE UPDATE', count: 4 }
    ],
  },
  {
    stepName: 'Regular Updates',
    aliases: ['regular updates', 'updates'],
    fallbackItems: [
      'Watch the Regular Updates walkthrough video\nClick "Help Me" to view the full tutorial.',
      'Understand the regular update workflow and frequency',
      'Confirm you know how to submit regular updates going forward',
    ],
    goal: 'Understand the ongoing update process for clients after onboarding.',
    sections: [
      { label: 'REGULAR UPDATE TASKS', count: 3 }
    ],
  },
];

const PREPARATION_REQUIRED_TABS = [
  { text: 'Agency Sub Account', aliases: ['agency sub account'] },
  { text: 'Client Sub Account', aliases: ['client sub account'] },
  { text: 'Client Website (Netlify)', aliases: ['client website', 'netlify', 'website tab'] },
  { text: 'Client Google My Business profile', aliases: ['google my business', 'gmb profile'] },
  { text: 'Fathom connected to Google Meet', aliases: ['fathom', 'google meet'], subtext: 'Ensure Fathom is recording via Google Meet before the call starts' },
];

const PREPARATION_GMB_CHECKUP = [
  { text: 'Verify GMB listing is connected in sub account', aliases: ['gmb listing', 'listing is connected'] },
  { text: 'Confirm business info is accurate (name, address, phone)', aliases: ['business info', 'name matches', 'address is correct', 'phone number is correct'] },
  { text: 'Check GMB reviews are syncing properly', aliases: ['reviews', 'review monitoring', '5-star'] },
  { text: 'Ensure Google Posts are enabled and scheduled', aliases: ['google posts', 'posts are enabled'] },
];

const parseDateSafe = (d) => {
  if (!d) return 0;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown Date';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(d);
  } catch (e) {
    return 'Invalid Date';
  }
}

function toStepRank(value) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const numeric = Number(value);
  if (numeric <= 0) return 0;
  return Math.max(0, Math.min(5, Math.round(numeric / 2)));
}

function cleanStepName(stepName) {
  if (!stepName || typeof stepName !== 'string') return '';
  return stepName.replace(/^Step\s*\d+\s*[-–—:]\s*/i, '').trim();
}

function buildChecklistFromCard(stepName, items = [], stepObj = {}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const name = (stepName || '').toLowerCase();

  if (name.includes('preparation') || name.includes('before the call')) {
    return {
      type: 'preparation',
      requiredTabs: stepObj.requiredTabs || [],
      gmbCheckup: stepObj.gmbCheckup || []
    };
  }

  let goal = '';
  let warning = '';
  let banner = '';
  let sections = [];

  if (name.includes('leadconnector')) {
    goal = 'Client has login access + can respond to messages.';
    warning = 'If login fails → STOP and resolve before continuing.';
    sections = [{ label: 'SETUP', items: safeItems }];
  } else if (name.includes('walkthrough')) {
    goal = 'Capture all required changes clearly in writing.';
    sections = [{ label: 'WALKTHROUGH', items: safeItems }];
  } else if (name.includes('form') && name.includes('sms')) {
    goal = 'Website Form → SMS Notification → Reply in CRM.';
    // Split items into FLOW and VERIFICATION
    const flowItems = safeItems.slice(0, 4);
    const verificationItems = safeItems.slice(4);
    sections = [
      { label: 'TEST FLOW', items: flowItems },
      { label: 'REPLY VERIFICATION', items: verificationItems }
    ];
  } else if (name.includes('review') || name.includes('referral')) {
    goal = 'Set up automated review and referral triggers.';
    const setupItems = safeItems.slice(0, 4);
    const referralsItems = safeItems.slice(4);
    return {
      type: 'specializedFullWidth',
      items: safeItems,
      goal,
      subtitle: 'THE MONEY MAKER',
      banner: 'This is the most important section — do not rush.',
      sections: [
        { label: 'SETUP & DEMO', items: setupItems },
        { label: 'REFERRALS & CADENCE', items: referralsItems }
      ]
    };
  } else if (name.includes('gmb optimization') || name.includes('gmb integrity')) {
    goal = 'Optimize for visibility without triggering suspensions.';
    const setupItems = safeItems.slice(0, 3);
    const verificationItems = safeItems.slice(3);
    return {
      type: 'specializedFullWidth',
      items: safeItems,
      goal,
      subtitle: 'HIGH IMPACT',
      isHighImpact: true,
      sections: [
        { label: 'PROFILE SETUP', items: setupItems },
        { label: 'VERIFICATION', items: verificationItems }
      ],
      criticalWarning: {
        title: 'Critical — Do Not Violate',
        message: 'Never edit: Business Name, Primary Category, or Address.',
        badges: ['Name', 'Category', 'Address']
      }
    };
  } else if (name.includes('card verification')) {
    goal = 'Verify client has a valid card on file so messaging will work.';
    warning = 'Messaging will NOT work without a verified card — do not skip this step.';
    const cardItems = safeItems.slice(0, 4);
    const declineItems = safeItems.slice(4);
    sections = [
      { label: 'CARD VERIFICATION (REQUIRED)', items: cardItems },
      { label: 'IF CLIENT DECLINES A2P ADD-ON', items: declineItems }
    ];
    return { type: 'standard', items: safeItems, goal, warning, sections };
  } else if (name.includes('a2p')) {
    goal = 'Inform the client about A2P registration and its benefits.';
    warning = 'Every client MUST be informed about A2P during onboarding — do not skip this.';
    sections = [{ label: 'REQUIRED — EXPLAIN TO CLIENT', items: safeItems }];
    return { type: 'standard', items: safeItems, goal, warning, sections };
  } else if (name.includes('social proof') || name.includes('client results')) {
    goal = 'Show the client real examples of businesses we rank on Google — this builds trust and emphasizes the importance of reviews.';
    banner = 'This step is REQUIRED — every client must see these results. Reviews are the #1 reason these businesses are getting leads.';
    warning = 'Do NOT skip this step — showing real proof is critical to getting client buy-in on reviews.';
    const mckinleyItems = safeItems.slice(0, 4);
    const maintenanceItems = safeItems.slice(4, 8);
    const driveHomeItems = safeItems.slice(8);
    return {
      type: 'specializedFullWidth',
      items: safeItems,
      goal,
      banner,
      warning,
      noHelpMe: true,
      sections: [
        { label: 'MCKINLEY CONCRETE', items: mckinleyItems },
        { label: 'MC MAINTENANCE', items: maintenanceItems },
        { label: 'DRIVE THE POINT HOME', items: driveHomeItems }
      ]
    };
  } else if (name.includes('update onboarding') || name.includes('update form')) {
    goal = 'Update the Onboarding Form after every call — this is REQUIRED. Make sure you choose between English and Spanish.';
    warning = 'Do NOT close the call without updating the Onboarding Form AND the Client Tracking Editor — both must happen every time.';
    const formItems = safeItems.slice(0, 4);
    const trackingItems = safeItems.slice(4, 11);
    const fathomItems = safeItems.slice(11);
    return {
      type: 'specializedFullWidth',
      items: safeItems,
      goal,
      warning,
      isUpdateForm: true,
      sections: [
        { label: 'ONBOARDING FORM (REQUIRED)', items: formItems },
        { label: 'UPDATE CLIENT TRACKING (REQUIRED — DO THIS AFTER THE FORM)', items: trackingItems },
        { label: 'FATHOM RECORDING', items: fathomItems }
      ]
    };
  } else if (name.includes('pipeline') || name.includes('gohighlevel')) {
    goal = 'Move the client card to the correct pipeline stage after onboarding.';
    sections = [{ label: 'PIPELINE UPDATE', items: safeItems }];
    return { type: 'standard', items: safeItems, goal, sections };
  } else if (name.includes('regular updates')) {
    goal = 'Understand the ongoing update process for clients after onboarding.';
    sections = [{ label: 'REGULAR UPDATE TASKS', items: safeItems }];
    return { type: 'standard', items: safeItems, goal, sections };
  } else {
    sections = [{ label: 'CHECKLIST', items: safeItems }];
  }

  return { type: 'standard', items: safeItems, goal, warning, sections };
}

function buildPreparationItems(requiredTabsApi = [], gmbCheckupApi = []) {
  const source = [...requiredTabsApi, ...gmbCheckupApi].filter(Boolean);

  const mapItems = (templates) => templates.map((template) => {
    const hit = source.find((item) => {
      const text = String(item?.itemText || item?.itemId || '').toLowerCase();
      return template.aliases.some((alias) => text.includes(alias));
    });
    return {
      ...(hit || { itemText: template.text, covered: false, reason: '' }),
      subtext: template.subtext || null
    };
  });

  return {
    requiredTabs: mapItems(PREPARATION_REQUIRED_TABS),
    gmbCheckup: mapItems(PREPARATION_GMB_CHECKUP)
  };
}

async function fetchLatestGrade(taskId, reportId = null) {
  // 1. Try to fetch the specific report by ID if provided (instant cache hit path)
  if (reportId) {
    try {
      const res = await fetch(apiUrl(`/api/onboarding/report-by-id/${reportId}`));
      if (res.ok) {
        const reportData = await res.json();
        if (reportData && reportData.id) return reportData;
      }
    } catch (e) {
      console.warn('[Report] Failed to fetch specific report by ID, falling back to taskId search:', e);
    }
  }

  // 2. Fallback to searching all grades for the given taskId
  const res = await fetch(`${apiUrl('/api/onboarding-grades')}?taskId=${encodeURIComponent(taskId)}&limit=100`);
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  if (!contentType.includes('application/json')) {
    const bodyPreview = await res.text().catch(() => '');
    throw new Error(
      `Invalid API response for onboarding grades (expected JSON). ` +
      `Got: ${contentType || 'unknown content-type'}${bodyPreview ? ` | Preview: ${bodyPreview.slice(0, 80)}` : ''}`
    );
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to fetch onboarding grades');

  const allGrades = Array.isArray(data?.grades) ? data.grades : [];

  // If we have a specific reportId, look for exactly that one
  if (reportId) {
    const matching = allGrades.find(g => String(g?.id) === String(reportId));
    if (matching) return matching;

    // If not found yet, it might still be generating
    const pendingError = new Error('Transcript grading is still pending...');
    pendingError.pending = true;
    throw pendingError;
  }

  // Fallback to latest for the task
  const sameTask = allGrades.filter((g) => String(g?.taskId || '') === String(taskId));
  const latest = sameTask.sort(
    (a, b) => parseDateSafe(b?.gradedAt || b?.createdAt) - parseDateSafe(a?.gradedAt || a?.createdAt)
  )[0];

  if (!latest) {
    const pendingError = new Error('Transcript grading is still pending.');
    pendingError.pending = true;
    throw pendingError;
  }
  return latest;
}

export default function OnboardingChecklistReportPage() {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId') || '';
  const reportId = searchParams.get('reportId') || '';
  const businessFromQuery = searchParams.get('businessName') || '';
  const isProgressiveMode = searchParams.get('mode') === 'progressive';
  const [loadingMessage, setLoadingMessage] = useState('Loading report...');
  const [grade, setGrade] = useState(null);
  const [error, setError] = useState('');
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [isTranscriptViewerOpen, setIsTranscriptViewerOpen] = useState(false);
  const [isPreparationHelpOpen, setIsPreparationHelpOpen] = useState(false);
  const [isStep1HelpOpen, setIsStep1HelpOpen] = useState(false);
  const [isStep2HelpOpen, setIsStep2HelpOpen] = useState(false);
  const [isStep3HelpOpen, setIsStep3HelpOpen] = useState(false);
  const [isStep4HelpOpen, setIsStep4HelpOpen] = useState(false);
  const [isStep5HelpOpen, setIsStep5HelpOpen] = useState(false);
  const [isStep6HelpOpen, setIsStep6HelpOpen] = useState(false);
  const [isStep8HelpOpen, setIsStep8HelpOpen] = useState(false);
  const [isStep9HelpOpen, setIsStep9HelpOpen] = useState(false);
  const [isRegularUpdatesHelpOpen, setIsRegularUpdatesHelpOpen] = useState(false);

  // Progressive loading state
  const [progressiveData, setProgressiveData] = useState(null);
  const [stepStatuses, setStepStatuses] = useState({}); // { 0: 'completed', 1: 'loading', 2: 'pending' }
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [allResults, setAllResults] = useState([]);
  const [isProgressiveComplete, setIsProgressiveComplete] = useState(false);

  // Progressive loading effect
  useEffect(() => {
    if (!isProgressiveMode) return;

    const stored = sessionStorage.getItem('onboarding_progressive');
    if (!stored) {
      setError('No progressive data found. Please submit the form again.');
      return;
    }

    try {
      const data = JSON.parse(stored);
      setProgressiveData(data);

      // Initialize all steps as pending
      const initialStatuses = {};
      for (let i = 0; i < data.totalBatches; i++) {
        initialStatuses[i] = 'pending';
      }
      setStepStatuses(initialStatuses);

      // Start progressive loading
      runProgressiveAnalysis(data);
    } catch (e) {
      setError('Failed to parse progressive data.');
    }
  }, [isProgressiveMode]);

  // Progressive analysis function
  const runProgressiveAnalysis = useCallback(async (data) => {
    const { transcript, conductor, client, totalBatches, batchNames, taskId, businessName, gmbProfileName, fathomLink } = data;
    const results = [];

    for (let i = 0; i < totalBatches; i++) {
      // Set current step to loading
      setCurrentStepIndex(i);
      setStepStatuses(prev => ({ ...prev, [i]: 'loading' }));

      // Add small artificial delay for visual feedback (300ms - faster!)
      await new Promise(r => setTimeout(r, 300));

      try {
        const batchRes = await fetch(apiUrl('/api/onboarding/analyze-batch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, conductor, client, batchIndex: i }),
        });
        const batchData = await batchRes.json();

        if (!batchRes.ok) {
          setStepStatuses(prev => ({ ...prev, [i]: 'error' }));
          toast.error(`Failed: ${batchNames[i]}`);
          continue;
        }

        results.push(...batchData.results);
        setAllResults([...results]);

        // Mark step as completed
        setStepStatuses(prev => ({ ...prev, [i]: 'completed' }));

        // Quick delay after completion for checkmark animation (150ms)
        await new Promise(r => setTimeout(r, 150));

      } catch (err) {
        setStepStatuses(prev => ({ ...prev, [i]: 'error' }));
        toast.error(`Error: ${batchNames[i]}`);
      }
    }

    // All batches complete - finalize
    setCurrentStepIndex(totalBatches);
    toast.loading('Finalizing report...', { id: 'finalize' });

    try {
      const finalizeRes = await fetch(apiUrl('/api/onboarding/finalize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          businessName,
          gmbProfileName,
          fathomLink,
          transcript,
          allResults: results
        }),
      });
      const finalizeData = await finalizeRes.json();

      if (finalizeRes.ok) {
        toast.success('Analysis complete!', { id: 'finalize' });
        setIsProgressiveComplete(true);

        // Fetch the final report
        const gradeData = await fetchLatestGrade(taskId, finalizeData.reportId);
        setGrade(gradeData);

        // Clear session storage
        sessionStorage.removeItem('onboarding_progressive');
      } else {
        toast.error('Finalization failed', { id: 'finalize' });
      }
    } catch (err) {
      toast.error('Finalization error', { id: 'finalize' });
    }
  }, []);

  // Check if any modal is open
  const isAnyModalOpen = isTranscriptViewerOpen || isPreparationHelpOpen || isStep1HelpOpen ||
    isStep2HelpOpen || isStep3HelpOpen || isStep4HelpOpen || isStep5HelpOpen ||
    isStep6HelpOpen || isStep8HelpOpen || isStep9HelpOpen || isRegularUpdatesHelpOpen;

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    let disposed = false;
    async function runPoll() {
      if (!taskId) {
        setError('Task ID missing in URL. Please submit from onboarding form first.');
        return;
      }
      for (let i = 0; i < 18; i += 1) {
        try {
          const latest = await fetchLatestGrade(taskId, reportId);
          if (!disposed) {
            setGrade(latest);
            setError('');
          }
          return;
        } catch (err) {
          if (!err?.pending || i === 17) {
            if (!disposed) setError(err.message || 'Failed to load report.');
            return;
          }
          if (!disposed) setLoadingMessage('Transcript processing in progress. Auto-refreshing report...');
          await new Promise((resolve) => setTimeout(resolve, 7000));
        }
      }
    }
    runPoll();
    return () => { disposed = true; };
  }, [taskId]);

  const computed = useMemo(() => {
    const stepsFromApi = Array.isArray(grade?.steps)
      ? grade.steps.filter(Boolean).map((step) => ({
        ...step,
        items: Array.isArray(step?.items) ? step.items.filter(Boolean) : [],
      }))
      : [];
    const requiredTabs = Array.isArray(grade?.requiredTabs) ? grade.requiredTabs.filter(Boolean) : [];
    const gmbCheckup = Array.isArray(grade?.gmbCheckup) ? grade.gmbCheckup.filter(Boolean) : [];

    const pickStep = (template) => {
      const hit = stepsFromApi.find((s) => {
        const name = String(s?.stepName || '').toLowerCase();
        return template.aliases.some((alias) => name.includes(alias));
      });

      // Always use template's fallbackItems as the UI items
      // But get covered status from API data if available
      const templateItems = template.fallbackItems.map((itemText) => {
        const mainText = itemText.split('\n')[0].toLowerCase();

        // Try to find matching item from API
        let matchedItem = null;
        if (hit && Array.isArray(hit.items)) {
          matchedItem = hit.items.find((apiItem) => {
            const apiText = String(apiItem?.itemText || apiItem?.itemId || '').toLowerCase();
            // Check for keyword matches
            const keywords = mainText.split(' ').filter(w => w.length > 3);
            return keywords.some(kw => apiText.includes(kw)) || apiText.includes(mainText.slice(0, 15));
          });
        }

        return {
          itemText,
          covered: matchedItem?.covered || false,
          reason: matchedItem?.reason || '',
          confidence: matchedItem?.confidence || 0,
          timestamp: matchedItem?.timestamp || null,
        };
      });

      return {
        stepName: template.stepName,
        items: templateItems,
      };
    };

    const preparationData = buildPreparationItems(requiredTabs, gmbCheckup);
    const preparationStep = {
      stepName: 'Before the Call — Tabs Must Be Open',
      items: [...preparationData.requiredTabs, ...preparationData.gmbCheckup],
      requiredTabs: preparationData.requiredTabs,
      gmbCheckup: preparationData.gmbCheckup,
    };

    const visualSteps = OLD_UI_STEP_TEMPLATES.map((template) => pickStep(template));
    const steps = [preparationStep, ...visualSteps];

    // Calculate score based on actual UI items (template-based)
    const allUIItems = steps.flatMap(s => Array.isArray(s.items) ? s.items : []);
    const TOTAL_ITEMS = 92;
    const completedItems = allUIItems.filter(i => i && i.covered === true).length;
    const totalItems = TOTAL_ITEMS;

    // Exact Algorithm: (coveredItems / totalItems) * 10
    const coverageRatio = totalItems > 0 ? (completedItems / totalItems) : 0;
    const automatedScore = Math.floor(coverageRatio * 10 * 10) / 10;
    const progress = Math.round(coverageRatio * 100);
    const scorableSteps = steps.slice(1);
    const rankAvg = scorableSteps.length
      ? Number(
        (
          scorableSteps.reduce((acc, step) => {
            const items = Array.isArray(step?.items) ? step.items : [];
            const stepCompleted = items.filter((i) => i?.covered === true).length;
            const stepScore = items.length > 0 ? (stepCompleted / items.length) * 10 : 0;
            return acc + toStepRank(stepScore);
          }, 0) / scorableSteps.length
        ).toFixed(2)
      )
      : 0;

    return { steps, completedItems, totalItems, automatedScore, progress, rankAvg };
  }, [grade]);

  // Use the computed score based on actual UI items (92 total)
  const finalScore = computed.automatedScore;
  const finalStatus = (() => {
    if (finalScore >= 8) return 'EXCELLENT';
    if (finalScore >= 6) return 'GOOD';
    if (finalScore >= 4) return 'AVERAGE';
    if (finalScore >= 2) return 'POOR';
    return 'VERY POOR';
  })();
  const isChecked = (item) => item?.covered === true;

  const displayName = businessFromQuery || grade?.taskName || grade?.clientName || 'Onboarding Launch Call';
  const reportDate = formatDate(grade?.gradedAt || grade?.createdAt);
  const transcriptUrl = grade?.fathomLink || grade?.callLink || grade?.callUrl || grade?.meetingUrl || '';

  if (error) {
    return (
      <div className="min-h-screen bg-brand-frost flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white p-6 sm:p-8 rounded-xl sm:rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
          <div className="text-red-500 text-4xl sm:text-5xl mb-3 sm:mb-4">⚠️</div>
          <h2 className="text-xl sm:text-2xl font-bold text-brand-midnight mb-2">Oops!</h2>
          <p className="text-brand-muted mb-4 sm:mb-6 text-sm sm:text-base">{error}</p>
          <Link to="/onboarding-auto-scoring" className="inline-block bg-brand-forest text-white px-5 sm:px-6 py-2 rounded-lg font-semibold hover:bg-brand-pine transition-colors text-sm sm:text-base">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  // Progressive loading UI
  if (isProgressiveMode && !isProgressiveComplete) {
    const completedCount = Object.values(stepStatuses).filter(s => s === 'completed').length;
    const totalSteps = progressiveData?.totalBatches || STEP_LABELS.length;
    const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    return (
      <div className="min-h-screen bg-brand-frost pb-20">
        <style>{SKELETON_CSS}</style>

        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:h-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <img src="/images/logo-Cah1EKSX.png" alt="Logo" className="h-6 sm:h-8 w-auto" />
              <div className="h-6 sm:h-8 w-px bg-gray-200 hidden sm:block" />
              <div>
                <h1 className="text-base sm:text-xl font-bold text-gray-900">{businessFromQuery || 'Analyzing Call...'}</h1>
                <p className="text-[10px] sm:text-xs text-brand-muted font-medium mt-0.5">AI Analysis in Progress</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex-1 sm:w-48 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-sage rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs sm:text-sm font-bold text-gray-400">
                <span className="text-brand-sage">{completedCount}</span>/{totalSteps}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-6 sm:mt-10">
          {/* Title */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-midnight mb-2">Analyzing Onboarding Call</h2>
            <p className="text-gray-500 text-sm sm:text-base">Each step is being analyzed by AI. Please wait...</p>
          </div>

          {/* Steps List */}
          <div className="space-y-3 sm:space-y-4">
            {STEP_LABELS.map((label, index) => {
              const status = stepStatuses[index] || 'pending';
              const isActive = index === currentStepIndex;

              return (
                <div
                  key={index}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-300 ${status === 'completed' ? 'border-green-200' :
                    status === 'loading' ? 'border-brand-sage' :
                      status === 'error' ? 'border-red-200' :
                        'border-gray-100'
                    } ${isActive ? 'ring-2 ring-brand-sage/30' : ''}`}
                >
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    {/* Status Icon */}
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${status === 'completed' ? 'bg-green-100' :
                      status === 'loading' ? 'bg-brand-sage/10' :
                        status === 'error' ? 'bg-red-100' :
                          'bg-gray-100'
                      }`}>
                      {status === 'completed' && (
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 check-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {status === 'loading' && (
                        <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-brand-sage border-t-transparent rounded-full animate-spin" />
                      )}
                      {status === 'error' && (
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {status === 'pending' && (
                        <span className="text-gray-400 font-bold text-sm sm:text-base">{index + 1}</span>
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${status === 'completed' ? 'text-green-600' :
                          status === 'loading' ? 'text-brand-sage' :
                            status === 'error' ? 'text-red-500' :
                              'text-gray-400'
                          }`}>
                          {status === 'completed' ? 'COMPLETED' :
                            status === 'loading' ? 'ANALYZING...' :
                              status === 'error' ? 'ERROR' :
                                'PENDING'}
                        </span>
                      </div>
                      <h3 className={`text-sm sm:text-base font-semibold truncate ${status === 'completed' ? 'text-gray-700' :
                        status === 'loading' ? 'text-brand-midnight' :
                          'text-gray-400'
                        }`}>
                        {label}
                      </h3>
                    </div>

                    {/* Skeleton for pending */}
                    {status === 'pending' && (
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-16 h-3 rounded skeleton-shimmer" />
                        <div className="w-10 h-3 rounded skeleton-shimmer" />
                      </div>
                    )}

                    {/* Score badge for completed */}
                    {status === 'completed' && (
                      <div className="flex items-center gap-2 step-fade-in">
                        <span className="px-2 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-lg">
                          ✓ Done
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Finalization message */}
          {currentStepIndex >= (progressiveData?.totalBatches || STEP_LABELS.length) && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-sage/10 rounded-full">
                <div className="w-4 h-4 border-2 border-brand-sage border-t-transparent rounded-full animate-spin" />
                <span className="text-brand-sage font-semibold text-sm">Generating Final Report...</span>
              </div>
            </div>
          )}

          {/* Back link */}
          <div className="mt-10 pt-6 border-t border-gray-100">
            <Link to="/onboarding-auto-scoring" className="text-brand-sage font-semibold hover:text-brand-forest text-sm">
              ← Back to form
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!grade) {
    return (
      <div className="min-h-screen bg-brand-frost flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="animate-spin rounded-full h-10 sm:h-12 w-10 sm:w-12 border-b-2 border-brand-forest mb-3 sm:mb-4"></div>
        <p className="text-brand-muted font-medium text-sm sm:text-base text-center">{loadingMessage}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-frost pb-20">
      {/* Skeleton + Modal Scrollbar Styles */}
      <style>{SKELETON_CSS}</style>
      <style>{`
        .modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .modal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-scroll::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
          border-radius: 3px;
        }
        .modal-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #9ca3af;
        }
        .modal-scroll::-webkit-scrollbar-button {
          display: none;
        }
        .modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: #d1d5db transparent;
        }
      `}</style>
      {/* Header Bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-0 sm:h-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <img src="/images/logo-Cah1EKSX.png" alt="Logo" className="h-6 sm:h-8 w-auto" />
            <div className="h-6 sm:h-8 w-px bg-gray-200 hidden sm:block" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-none truncate">{displayName}</h1>
                <img src="/images/star.svg" className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" alt="star" />
              </div>
              <p className="text-[10px] sm:text-xs text-brand-muted font-medium mt-0.5 sm:mt-1 hidden sm:block">Execution &gt; Conversation</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 w-full sm:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none sm:w-48 h-2 sm:h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className="absolute top-0 left-0 h-full bg-brand-sage rounded-full transition-all duration-1000"
                  style={{ width: `${computed.progress}%` }}
                />
              </div>
              <span className="text-xs sm:text-sm font-bold text-gray-400 flex-shrink-0">
                <span className="text-brand-sage">{computed.completedItems}</span>/{computed.totalItems}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto">
              <Link to="/onboarding-auto-scoring" className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 rounded-lg text-[10px] sm:text-xs font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                Back
              </Link>
              <button
                onClick={() => setIsTranscriptViewerOpen(true)}
                disabled={!grade?.transcript}
                className={`px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap ${grade?.transcript ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}
              >
                Transcript
              </button>
              <button onClick={() => window.print()} className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 rounded-lg text-[10px] sm:text-xs font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                Export
              </button>
              <button
                onClick={() => {
                  // Reload without progressive mode - just refresh the report page
                  const url = new URL(window.location.href);
                  url.searchParams.delete('mode');
                  window.location.href = url.toString();
                }}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 rounded-lg text-[10px] sm:text-xs font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
              >
                <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restart
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 sm:mt-8 space-y-4 sm:space-y-6">
        {/* Performance Summary */}
        <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="text-center md:text-left">
              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-bold">Automated Performance Grade</div>
              <div className="text-4xl sm:text-5xl font-black text-brand-midnight mt-1 sm:mt-2">{Number(finalScore).toFixed(1)} / 10</div>
              <div className="text-xs sm:text-sm font-semibold text-gray-600 mt-1 sm:mt-2">Status: {finalStatus}</div>
            </div>
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-semibold text-gray-800">{reportDate}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Analysis Type</span><span className="font-semibold text-gray-800">AI + Algorithm Based</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Completed</span><span className="font-semibold text-gray-800">{computed.completedItems}/{computed.totalItems}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Rank Avg</span><span className="font-semibold text-gray-800">{computed.rankAvg} / 5</span></div>
              <div className="flex justify-between"><span className="text-gray-500">AI Confidence</span><span className="font-semibold text-gray-800">{Math.round((grade?.confidenceAvg || 0) * 100)}%</span></div>
            </div>
          </div>
        </section>

        {/* Watch section */}
        <section className="bg-white rounded-xl sm:rounded-2xl border border-brand-mint/50 overflow-hidden shadow-sm">
          <button
            onClick={() => setIsVideoExpanded(!isVideoExpanded)}
            className="w-full flex items-center justify-between p-3 sm:p-5 hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="bg-brand-frost p-1.5 sm:p-2 rounded-lg">
                <img src="/images/play.svg" className="w-4 sm:w-5 h-4 sm:h-5" alt="play" />
              </div>
              <span className="text-sm sm:text-lg font-bold text-brand-midnight">Watch Before Using Checklist</span>
            </div>
            <svg
              className={`w-5 sm:w-6 h-5 sm:h-6 text-gray-400 transition-transform flex-shrink-0 ${isVideoExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isVideoExpanded && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-brand-mint/20 bg-brand-frost/20">
              <div className="relative w-full rounded-xl overflow-hidden border border-gray-200" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src="https://www.loom.com/embed/0d9631cc042c40d7adb1b1243fce4223"
                  className="absolute inset-0 w-full h-full"
                  frameBorder="0"
                  allowFullScreen
                  title="Daily Checklist Submission Tutorial"
                />
              </div>
            </div>
          )}
        </section>

        {/* Checklist Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
          {(() => {
            let numberedStepCount = 0;
            return computed.steps.map((step, index) => {
              const stepData = buildChecklistFromCard(step.stepName || '', step.items || [], step);
              const coveredCount = (step.items || []).filter(i => i.covered === true).length;
              const totalCount = (step.items || []).length;

              if (stepData.type === 'preparation') {
                return (
                  <div key={index} className="lg:col-span-2 bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 sm:p-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-4 sm:mb-8">
                      <div className="flex gap-3 sm:gap-5">
                        <div className="bg-brand-frost w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center rounded-xl flex-shrink-0">
                          <img src="/images/top-right-arrow.svg" className="w-5 sm:w-6 h-5 sm:h-6" alt="Phase Icon" />
                        </div>
                        <div>
                          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] block mb-0.5 sm:mb-1">
                            PREPARATION PHASE
                          </span>
                          <h2 className="text-lg sm:text-2xl font-bold text-brand-midnight tracking-tight">Before the Call — Tabs Must Be Open</h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-auto">
                        <button
                          onClick={() => setIsPreparationHelpOpen(true)}
                          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-gray-100 rounded-full hover:shadow-sm transition-all group"
                        >
                          <img src="/images/play.svg" className="w-3 sm:w-3.5 h-3 sm:h-3.5" alt="help" />
                          <span className="text-[10px] sm:text-xs font-bold text-brand-sage">Help Me</span>
                        </button>
                        <div className="bg-brand-frost px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                          <span className="text-xs sm:text-sm font-bold text-gray-500">
                            <span className="text-brand-sage">{coveredCount}</span>/{totalCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-12">
                      <div>
                        <div className="relative mb-4 sm:mb-6">
                          <h3 className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-brand-forest">REQUIRED TABS</h3>
                          <div className="absolute -bottom-2 left-0 w-full h-px bg-gray-50" />
                        </div>
                        <div className="space-y-4 sm:space-y-6 pt-2">
                          {stepData.requiredTabs.map((item, idx) => {
                            const textLines = ((item?.itemText || item?.itemId || '')).split('\n');
                            const mainText = textLines[0];
                            const subText = textLines.slice(1).join('\n');
                            return (
                              <div key={idx} className="flex items-start sm:items-center gap-3 sm:gap-4 group">
                                <div className={`w-5 sm:w-6 h-5 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 sm:mt-0 ${isChecked(item) ? 'bg-brand-forest border-brand-forest shadow-sm' : 'border-[#E2E8F0] bg-white'}`}>
                                  {isChecked(item) && <img src="/images/check-mark.svg" className="w-3 sm:w-3.5 h-3 sm:h-3.5 [filter:brightness(0)_invert(1)]" alt="ok" />}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                    <span className={`text-sm sm:text-base leading-tight font-medium transition-colors ${isChecked(item) ? 'text-gray-400 line-through decoration-gray-300' : 'text-[#1F2B3D]'}`}>
                                      {mainText.includes(':') ? (
                                        <>
                                          <span className="font-extrabold">{mainText.split(':')[0]}:</span>{' '}
                                          {mainText.split(':').slice(1).join(':')}
                                        </>
                                      ) : mainText}
                                    </span>
                                    {isChecked(item) && typeof item?.confidence === 'number' && (
                                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                                        {Math.round(item.confidence * 100)}%
                                      </span>
                                    )}
                                    {item?.timestamp && (
                                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono">
                                        {item.timestamp}
                                      </span>
                                    )}
                                  </div>
                                  {item.subtext && (
                                    <span className="text-[10px] sm:text-xs italic text-[#718096] mt-1">
                                      {item.subtext}
                                    </span>
                                  )}
                                  {subText && !item.subtext && (
                                    <span className="text-[10px] sm:text-xs italic text-[#718096] mt-1">{subText}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="relative mb-4 sm:mb-6">
                          <h3 className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-brand-forest">SUB ACCOUNT GMB CHECKUP</h3>
                          <div className="absolute -bottom-2 left-0 w-full h-px bg-gray-50" />
                        </div>
                        <div className="space-y-4 sm:space-y-6 pt-2">
                          {stepData.gmbCheckup.map((item, idx) => {
                            const textLines = ((item?.itemText || item?.itemId || '')).split('\n');
                            const mainText = textLines[0];
                            const subText = textLines.slice(1).join('\n');
                            return (
                              <div key={idx} className="flex items-start sm:items-center gap-3 sm:gap-4">
                                <div className={`w-5 sm:w-6 h-5 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 sm:mt-0 ${isChecked(item) ? 'bg-brand-forest border-brand-forest shadow-sm' : 'border-[#E2E8F0] bg-white'}`}>
                                  {isChecked(item) && <img src="/images/check-mark.svg" className="w-3 sm:w-3.5 h-3 sm:h-3.5 [filter:brightness(0)_invert(1)]" alt="ok" />}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                    <span className={`text-sm sm:text-base leading-tight font-medium transition-colors ${isChecked(item) ? 'text-gray-400 line-through decoration-gray-300' : 'text-brand-midnight'}`}>
                                      {mainText.includes(':') ? (
                                        <>
                                          <span className="font-extrabold">{mainText.split(':')[0]}:</span>{' '}
                                          {mainText.split(':').slice(1).join(':')}
                                        </>
                                      ) : mainText}
                                    </span>
                                    {isChecked(item) && typeof item?.confidence === 'number' && (
                                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                                        {Math.round(item.confidence * 100)}%
                                      </span>
                                    )}
                                    {item?.timestamp && (
                                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono">
                                        {item.timestamp}
                                      </span>
                                    )}
                                  </div>
                                  {subText && (
                                    <span className="text-[10px] sm:text-xs italic text-[#718096] mt-1">{subText}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Warning Box */}
                    <div className="mt-6 sm:mt-8 bg-red-50 border border-red-100 rounded-xl px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
                      <svg className="w-4 sm:w-5 h-4 sm:h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-sm sm:text-base font-medium text-red-600">
                        Do NOT start the call until ALL of these are open and loaded.
                      </span>
                    </div>

                  </div>
                );
              }

              numberedStepCount++;

              if (stepData.type === 'specializedFullWidth') {
                return (
                  <div key={index} className="lg:col-span-2 bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 sm:p-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-4 sm:mb-6">
                      <div className="flex gap-3 sm:gap-4">
                        <div className="bg-brand-frost w-8 sm:w-10 h-8 sm:h-10 flex items-center justify-center rounded-xl flex-shrink-0">
                          <img src="/images/top-right-arrow.svg" className="w-4 sm:w-5 h-4 sm:h-5 opacity-80" alt="Step Icon" />
                        </div>
                        <div>
                          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] block mb-0.5">
                            STEP {numberedStepCount} — {stepData.subtitle}
                          </span>
                          <h2 className="text-base sm:text-xl font-bold text-brand-midnight leading-tight">{cleanStepName(step.stepName)}</h2>
                        </div>
                      </div>
                      {(() => {
                        const currentStep = numberedStepCount;
                        const hasHelp = currentStep === 4 || currentStep === 5 || currentStep === 9;
                        return (
                          <div className="flex items-center gap-2 sm:gap-2.5 self-end sm:self-auto">
                            {hasHelp && (
                              <button
                                onClick={() => {
                                  if (currentStep === 4) setIsStep4HelpOpen(true);
                                  else if (currentStep === 5) setIsStep5HelpOpen(true);
                                  else if (currentStep === 9) setIsStep8HelpOpen(true);
                                }}
                                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-gray-100 rounded-full hover:shadow-sm transition-all group"
                              >
                                <img src="/images/play.svg" className="w-3 sm:w-3.5 h-3 sm:h-3.5" alt="help" />
                                <span className="text-[10px] sm:text-xs font-bold text-brand-sage">Help Me</span>
                              </button>
                            )}
                            <div className="bg-brand-frost px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full min-w-[36px] sm:min-w-[40px] text-center">
                              <span className="text-[10px] sm:text-xs font-bold text-gray-400 leading-none">
                                <span className="text-brand-sage">{coveredCount}</span>/{totalCount}
                              </span>
                            </div>
                            <div className="bg-blue-50 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full text-center">
                              <span className="text-[10px] sm:text-xs font-bold text-blue-600 leading-none">
                                {totalCount > 0 ? Number((coveredCount / totalCount * 10).toFixed(1)) : 0}/10
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {stepData.goal && (
                      <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-gray-50/50 border-l-4 border-brand-sage flex items-start sm:items-center gap-2 sm:gap-3">
                        <img src="/images/goal.svg" className="w-3.5 sm:w-4 h-3.5 sm:h-4 mt-0.5 sm:mt-0 flex-shrink-0" alt="goal" />
                        <p className="text-[11px] sm:text-xs font-semibold text-gray-600 tracking-tight">
                          <span className="text-brand-midnight">Goal:</span> {stepData.goal}
                        </p>
                      </div>
                    )}

                    {stepData.banner && (
                      <div className="mb-4 sm:mb-8 p-2.5 sm:p-3 rounded-xl bg-[#3f883f0d] border border-brand-sage/10 text-center">
                        <p className="text-xs sm:text-sm font-semibold text-brand-forest">
                          {stepData.banner}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-12">
                      {stepData.sections.map((section, sIdx) => (
                        <div key={sIdx}>
                          <div className="relative mb-4 sm:mb-6">
                            <h3 className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-brand-forest">{section.label}</h3>
                            <div className="absolute -bottom-2 left-0 w-full h-px bg-gray-50" />
                          </div>
                          <div className="space-y-3 sm:space-y-4 pt-1">
                            {(section.items || []).map((item, idx) => {
                              const textLines = ((item?.itemText || item?.itemId || '')).split('\n');
                              const mainText = textLines[0];
                              const subText = textLines.slice(1).join('\n');
                              return (
                                <div key={idx} className="flex items-start sm:items-center gap-3 sm:gap-4">
                                  <div className={`w-5 sm:w-6 h-5 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0 transition-all ${isChecked(item) ? 'bg-brand-forest border-brand-forest shadow-sm' : 'border-[#E2E8F0] bg-white'}`}>
                                    {isChecked(item) && <img src="/images/check-mark.svg" className="w-3 sm:w-3.5 h-3 sm:h-3.5 [filter:brightness(0)_invert(1)]" alt="ok" />}
                                  </div>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                      <span className={`text-sm sm:text-base leading-tight font-medium transition-colors ${isChecked(item) ? 'text-gray-400 line-through decoration-gray-300' : 'text-[#1F2B3D]'}`}>
                                        {mainText.includes(':') ? (
                                          <>
                                            <span className="font-extrabold">{mainText.split(':')[0]}:</span>{' '}
                                            {mainText.split(':').slice(1).join(':')}
                                          </>
                                        ) : mainText}
                                      </span>
                                      {isChecked(item) && typeof item?.confidence === 'number' && (
                                        <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                                          {Math.round(item.confidence * 100)}%
                                        </span>
                                      )}
                                      {item?.timestamp && (
                                        <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono">
                                          {item.timestamp}
                                        </span>
                                      )}
                                    </div>
                                    {subText && (
                                      <span className="text-[10px] sm:text-xs italic text-[#718096] mt-1">{subText}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {stepData.criticalWarning && (
                      <div className="mt-6 sm:mt-8 p-4 sm:p-6 rounded-xl border-2 border-red-200 bg-red-50/50">
                        <div className="flex flex-col items-center text-center gap-3">
                          <div className="flex items-center gap-2 text-red-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-base sm:text-lg font-bold">{stepData.criticalWarning.title}</span>
                          </div>
                          <p className="text-sm text-gray-600">{stepData.criticalWarning.message}</p>
                          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-1">
                            {stepData.criticalWarning.badges.map((badge, idx) => (
                              <span key={idx} className="px-3 sm:px-4 py-1.5 sm:py-2 border border-red-300 rounded-lg text-red-600 text-xs sm:text-sm font-medium flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {badge}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {stepData.isUpdateForm && (
                      <div className="mt-4 sm:mt-8 space-y-3 sm:space-y-4">
                        {/* CTA Box 1 - Open Onboarding Form */}
                        <div className="p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-brand-sage/10 bg-[#3f883f05] text-center flex flex-col items-center gap-2 sm:gap-3">
                          <img src="/images/critical-green.svg" className="w-5 sm:w-6 h-5 sm:h-6" alt="critical" />
                          <h4 className="text-sm sm:text-[17px] font-bold text-brand-forest">REQUIRED After Every Onboarding</h4>
                          <p className="text-xs sm:text-[13px] text-gray-500 max-w-xl leading-relaxed">
                            This is the onboarding form — fill it out after every call. Choose between English and Spanish.<br />
                            <span className="italic text-[10px] sm:text-xs mt-1 block opacity-70">Need help? Click the <span className="font-bold">Help Me</span> button above to watch a walkthrough video.</span>
                          </p>
                          <Link
                            to="/onboarding-auto-scoring"
                            className="mt-1 sm:mt-2 flex items-center gap-2 px-4 sm:px-7 py-2 sm:py-2.5 bg-brand-forest text-white rounded-lg font-bold hover:shadow-lg transition-all text-xs sm:text-sm"
                          >
                            <img src="/images/top-right-arrow -white.svg" className="w-3.5 sm:w-4 h-3.5 sm:h-4" alt="arrow" />
                            Open Onboarding Form
                          </Link>
                        </div>

                        {/* CTA Box 2 - Open Client Tracking Editor */}
                        <div className="p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-brand-sage/10 bg-[#3f883f05] text-center flex flex-col items-center gap-2 sm:gap-3">
                          <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-white flex items-center justify-center border border-brand-sage/20 shadow-sm">
                            <img src="/images/top-right-arrow.svg" className="w-4 sm:w-5 h-4 sm:h-5" alt="arrow" />
                          </div>
                          <h4 className="text-sm sm:text-[17px] font-bold text-brand-forest uppercase tracking-tight">ALSO REQUIRED — Do This After the Form</h4>
                          <p className="text-xs sm:text-[13px] text-gray-500 max-w-xl leading-relaxed">
                            Use this tool AFTER submitting the Onboarding Form to update client tracking for website builders.
                          </p>
                          <a
                            href="https://click.acquisition-central.com/client-tracking-editor.html?taskId=86af4perz"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 sm:mt-2 flex items-center gap-2 px-4 sm:px-7 py-2 sm:py-2.5 bg-brand-forest text-white rounded-lg font-bold hover:shadow-lg transition-all text-xs sm:text-sm"
                          >
                            <img src="/images/top-right-arrow -white.svg" className="w-3.5 sm:w-4 h-3.5 sm:h-4" alt="arrow" />
                            Open Client Tracking Editor
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={index} className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 sm:p-8 flex flex-col h-full">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-4 sm:mb-6">
                    <div className="flex gap-3 sm:gap-4">
                      <div className="bg-brand-frost w-8 sm:w-10 h-8 sm:h-10 flex items-center justify-center rounded-xl flex-shrink-0">
                        <img src="/images/top-right-arrow.svg" className="w-4 sm:w-5 h-4 sm:h-5 opacity-80" alt="Step Icon" />
                      </div>
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-gray-400 block mb-0.5">
                          STEP {numberedStepCount}
                        </span>
                        <h2 className="text-base sm:text-xl font-bold text-brand-midnight leading-tight">{cleanStepName(step.stepName)}</h2>
                      </div>
                    </div>
                    {(() => {
                      const currentStepNum = numberedStepCount;
                      const stepNameLower = (step.stepName || '').toLowerCase();
                      const isRegularUpdates = stepNameLower.includes('regular updates');
                      const isPipelineStep = stepNameLower.includes('pipeline') || stepNameLower.includes('gohighlevel');
                      const stepsWithHelp = [1, 2, 3, 4, 5, 6, 8];
                      const hasHelpVideo = stepsWithHelp.includes(currentStepNum) || isRegularUpdates || isPipelineStep;
                      const openHelpModal = () => {
                        if (isRegularUpdates) setIsRegularUpdatesHelpOpen(true);
                        else if (isPipelineStep) setIsStep9HelpOpen(true);
                        else if (currentStepNum === 1) setIsStep1HelpOpen(true);
                        else if (currentStepNum === 2) setIsStep2HelpOpen(true);
                        else if (currentStepNum === 3) setIsStep3HelpOpen(true);
                        else if (currentStepNum === 4) setIsStep4HelpOpen(true);
                        else if (currentStepNum === 5) setIsStep5HelpOpen(true);
                        else if (currentStepNum === 6) setIsStep6HelpOpen(true);
                        else if (currentStepNum === 8) setIsStep8HelpOpen(true);
                      };
                      return (
                        <div className="flex items-center gap-1.5 sm:gap-2.5 self-end sm:self-auto flex-wrap">
                          {hasHelpVideo && (
                            <>
                              <button
                                onClick={openHelpModal}
                                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-gray-100 rounded-full hover:shadow-sm transition-all group"
                              >
                                <img src="/images/play.svg" className="w-3 sm:w-3.5 h-3 sm:h-3.5" alt="help" />
                                <span className="text-[10px] sm:text-xs font-bold text-brand-sage">Help Me</span>
                              </button>
                            </>
                          )}
                          <div className="bg-brand-frost px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full min-w-[36px] sm:min-w-[40px] text-center">
                            <span className="text-[10px] sm:text-xs font-bold text-gray-400 leading-none">
                              <span className="text-brand-sage">{coveredCount}</span>/{totalCount}
                            </span>
                          </div>
                          <div className="bg-blue-50 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full text-center">
                            <span className="text-[10px] sm:text-xs font-bold text-blue-600 leading-none">
                              {totalCount > 0 ? Number((coveredCount / totalCount * 10).toFixed(1)) : 0}/10
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {stepData.goal && (
                    <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-gray-50/50 border-l-4 border-brand-sage flex items-start sm:items-center gap-2 sm:gap-3">
                      <img src="/images/goal.svg" className="w-3.5 sm:w-4 h-3.5 sm:h-4 mt-0.5 sm:mt-0 flex-shrink-0" alt="goal" />
                      <p className="text-[11px] sm:text-xs font-semibold text-gray-600 tracking-tight">
                        <span className="text-brand-midnight">Goal:</span> {stepData.goal}
                      </p>
                    </div>
                  )}

                  <div className="flex-1 space-y-5 sm:space-y-8">
                    {stepData.sections.map((section, sIdx) => (
                      <div key={sIdx}>
                        <div className="relative mb-3 sm:mb-4">
                          <h3 className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-brand-forest">{section.label}</h3>
                          <div className="absolute -bottom-1 left-0 w-full h-px bg-gray-50" />
                        </div>
                        <div className="space-y-3 sm:space-y-4 pt-1">
                          {(section.items || []).map((item, idx) => {
                            const textLines = ((item?.itemText || item?.itemId || '')).split('\n');
                            const mainText = textLines[0];
                            const subText = textLines.slice(1).join('\n');
                            return (
                              <div key={idx} className="flex items-start sm:items-center gap-3 sm:gap-4">
                                <div className={`w-5 sm:w-6 h-5 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0 transition-all ${isChecked(item) ? 'bg-brand-forest border-brand-forest shadow-sm' : 'border-[#E2E8F0] bg-white'}`}>
                                  {isChecked(item) && <img src="/images/check-mark.svg" className="w-3 sm:w-3.5 h-3 sm:h-3.5 [filter:brightness(0)_invert(1)]" alt="ok" />}
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                    <span className={`text-sm sm:text-base leading-tight font-medium transition-colors ${isChecked(item) ? 'text-gray-400 line-through decoration-gray-300' : 'text-[#1F2B3D]'}`}>
                                      {mainText.includes(':') ? (
                                        <>
                                          <span className="font-extrabold">{mainText.split(':')[0]}:</span>{' '}
                                          {mainText.split(':').slice(1).join(':')}
                                        </>
                                      ) : mainText}
                                    </span>
                                    {isChecked(item) && typeof item?.confidence === 'number' && (
                                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                                        {Math.round(item.confidence * 100)}%
                                      </span>
                                    )}
                                    {item?.timestamp && (
                                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono">
                                        {item.timestamp}
                                      </span>
                                    )}
                                  </div>
                                  {subText && (
                                    <span className="text-[10px] sm:text-xs italic text-[#718096] mt-1">{subText}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {stepData.warning && (
                    <div className="mt-4 sm:mt-8 p-2.5 sm:p-3 rounded-xl border border-[#fee2e2] bg-[#fff5f5] flex items-start sm:items-center gap-2 sm:gap-3">
                      <img src="/images/warn.svg" className="w-3.5 sm:w-4 h-3.5 sm:h-4 mt-0.5 sm:mt-0 flex-shrink-0" alt="warn" />
                      <p className="text-xs sm:text-[13px] font-medium text-[#ef4444]">
                        {stepData.warning}
                      </p>
                    </div>
                  )}

                </div>
              );
            });
          })()}
        </div>

        {/* Final CTA Box */}
        <div className="mt-6 sm:mt-12 bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-12 text-center flex flex-col items-center gap-4 sm:gap-6">
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-[#3f883f0d] border border-brand-sage/20 flex items-center justify-center">
              <img src="/images/star.svg" className="w-5 sm:w-6 h-5 sm:h-6 [filter:sepia(1)_saturate(500%)_hue-rotate(70deg)]" alt="sparkle" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-brand-midnight">Close The Call</h2>
            <p className="text-gray-500 max-w-2xl leading-relaxed text-xs sm:text-sm px-2">
              Answer all final client questions, give a final "Use the form after EVERY job" reminder, and
              send a quick text to Kurtis with the client name once the call is disconnected.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10 mt-1 sm:mt-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full border-2 border-[#E2E8F0] bg-white" />
              <span className="text-sm sm:text-base font-bold text-brand-midnight">Questions Answered</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full border-2 border-[#E2E8F0] bg-white" />
              <span className="text-sm sm:text-base font-bold text-brand-midnight">Texted Kurtis</span>
            </div>
          </div>

          <div className="w-full max-w-xl mt-2 sm:mt-4">
            <button className="w-full bg-[#94a3b8] text-white py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md text-sm sm:text-base">
              <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Submit Onboarding
            </button>
            <p className="mt-3 sm:mt-4 text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              Complete all {computed.totalItems - computed.completedItems} remaining items to submit
            </p>
          </div>
        </div>

        <div className="pt-6 sm:pt-10 border-t border-gray-100 mt-6 sm:mt-10">
          <Link to="/onboarding-auto-scoring" className="group flex items-center gap-2 text-brand-sage font-bold hover:text-brand-forest transition-colors text-sm sm:text-base">
            <svg className="w-4 sm:w-5 h-4 sm:h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to onboarding form
          </Link>
        </div>
      </main>

      {/* Transcript Viewer Modal */}
      <TranscriptViewer
        transcript={grade?.transcript || ''}
        detectedMoments={[
          ...(grade?.requiredTabs || []),
          ...(grade?.gmbCheckup || []),
          ...(grade?.steps || []).flatMap(s => s?.items || []),
          ...(grade?.closeCall || [])
        ].filter(Boolean)}
        isOpen={isTranscriptViewerOpen}
        onClose={() => setIsTranscriptViewerOpen(false)}
      />

      {/* Preparation Help Modal */}
      {isPreparationHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsPreparationHelpOpen(false)}
              className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">
                Before the Call — Tabs Must Be Open — Help Videos
              </h2>
            </div>

            {/* Videos */}
            <div className="space-y-4 sm:space-y-6">
              {/* Video 1 */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Pre-Call Setup Walkthrough</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.loom.com/embed/1610ec455ec84225b779136c4634b985"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    title="Pre-Call Setup Walkthrough"
                  />
                </div>
              </div>

              {/* Video 2 */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Sub Account GMB Checkup — Part 1</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.loom.com/embed/9a6d381439f04fb0ab0bb7e46d224f73"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    title="Sub Account GMB Checkup Part 1"
                  />
                </div>
              </div>

              {/* Video 3 */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Sub Account GMB Checkup — Part 2</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.loom.com/embed/08dc6ac2bdc546f5bba84f8788c3f64d"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    title="Sub Account GMB Checkup Part 2"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1 - LeadConnector Access Help Modal */}
      {isStep1HelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsStep1HelpOpen(false)}
              className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">
                LeadConnector Access — Help Videos
              </h2>
            </div>

            {/* Video */}
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">LeadConnector Setup Guide</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.loom.com/embed/d51a223a8c444bf5bccb35e12bb725c5"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    title="LeadConnector Setup Guide"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 - Website Walkthrough Help Modal */}
      {isStep2HelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsStep2HelpOpen(false)}
              className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">
                Website Walkthrough — Help Videos
              </h2>
            </div>

            {/* Video */}
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Website Walkthrough Guide</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.loom.com/embed/47b0d45cb8884f02be8354707c1ccab9"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    title="Website Walkthrough Guide"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 - Form & SMS Test Help Modal */}
      {isStep3HelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsStep3HelpOpen(false)}
              className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">
                Form & SMS Test — Help Videos
              </h2>
            </div>

            {/* Video */}
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Navigating LeadConnector: Onboarding and System Updates Guide</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.loom.com/embed/16243ba4e44149249c995f1c60612d08"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    title="Navigating LeadConnector: Onboarding and System Updates Guide"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 - Google Review & Referral System Help Modal */}
      {isStep4HelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsStep4HelpOpen(false)}
              className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">
                Google Review & Referral System — Help Videos
              </h2>
            </div>

            {/* Videos */}
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Review System Overview</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.loom.com/embed/1bb76460d4e748249cedbb8cbd8956a8"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    title="Review System Overview"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Referral Cadence Explained</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe
                    src="https://www.loom.com/embed/placeholder-step5b"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    title="Referral Cadence Explained"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5 - GMB Optimization & Integrity Help Modal */}
      {isStep5HelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            <button onClick={() => setIsStep5HelpOpen(false)} className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" /></svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">GMB Optimization & Integrity — Help Videos</h2>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">GMB Optimization Walkthrough</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe src="https://www.loom.com/embed/db8b0c49eb4546ac852564ae21928fd7" className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen title="GMB Optimization Walkthrough" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 6 - A2P / Card Verification Help Modal */}
      {isStep6HelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            <button onClick={() => setIsStep6HelpOpen(false)} className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" /></svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">A2P Client Briefing — Help Videos</h2>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Card Verification & A2P Walkthrough</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe src="https://www.loom.com/embed/e703f189d61c407ca9bd5678d9bd5ce8" className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen title="Card Verification & A2P Walkthrough" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 9 - Update Form Help Modal */}
      {isStep8HelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            <button onClick={() => setIsStep8HelpOpen(false)} className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" /></svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">Update Form — Help Videos</h2>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">ClickUp Update Guide</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe src="https://www.loom.com/embed/93fcbf4eb8e04175a1d6f81815d2fc6c" className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen title="ClickUp Update Guide" />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Client Tracking Editor Walkthrough</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe src="https://www.loom.com/embed/031d2eb73c21448d89fcab4d5dcd2513" className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen title="Client Tracking Editor Walkthrough" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 9 - Update GoHighLevel Pipeline Help Modal */}
      {isStep9HelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            <button onClick={() => setIsStep9HelpOpen(false)} className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" /></svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">Update GoHighLevel Pipeline — Help Videos</h2>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">GoHighLevel Pipeline Update</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe src="https://www.loom.com/embed/e3bf112736a9433fa2230c611ae184f8" className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen title="GoHighLevel Pipeline Update" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regular Updates Help Modal */}
      {isRegularUpdatesHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-scroll p-4 sm:p-6">
            <button onClick={() => setIsRegularUpdatesHelpOpen(false)} className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pr-8">
              <svg className="w-5 h-5 text-brand-sage flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" /></svg>
              <h2 className="text-base sm:text-lg font-semibold text-brand-midnight">Regular Updates — Help Videos</h2>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-brand-midnight">Regular Updates</h4>
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200">
                  <iframe src="https://www.loom.com/embed/fed23b2f867642189d0475ba0a166c14" className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen title="Regular Updates" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
