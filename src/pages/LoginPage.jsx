import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

/* ─────────────────────────── CSS for Animations ─────────────────────────── */
const LOGIN_CSS = `
@keyframes g-slide-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes g-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-slide-up { animation: g-slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-fade-in { animation: g-fade-in 1.2s ease forwards; }
.glass-panel {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
`;

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = LOGIN_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    // Hardcoded credentials as requested
    const VALID_EMAIL = 'kurtismaximumride@gmail.com';
    const VALID_PASS = 'Maximumride12!12345678';

    setTimeout(() => {
      if (email === VALID_EMAIL && password === VALID_PASS) {
        sessionStorage.setItem('isAdmin', 'true');
        sessionStorage.setItem('adminEmail', email);
        toast.success('Access granted. Welcome back!', {
          style: { borderRadius: '12px', background: '#064e3b', color: '#fff' }
        });
        onLoginSuccess();
      } else {
        toast.error('Invalid credentials. Please check your email or password.', {
          style: { borderRadius: '12px' }
        });
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Wrappers */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/40 rounded-full blur-[120px] animate-fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[120px] animate-fade-in" />
      
      <div className="w-full max-w-md relative z-10 animate-slide-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-500/20 mb-6 group transition-transform hover:scale-110 duration-500">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
               <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 uppercase italic">
            Search <span className="text-emerald-600 not-italic">Intelligence</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm tracking-wide uppercase">Admin Gateway • Internal Access Only</p>
        </div>

        <div className="glass-panel p-8 sm:p-10 rounded-[32px] shadow-2xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-5 py-4 bg-white/50 border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-900 placeholder:text-slate-300 font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-4 bg-white/50 border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-900 placeholder:text-slate-300 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-900/10 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3 mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sign In to Dashboard'
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-slate-400 text-xs font-medium tracking-wide">
          © 2026 Search Ranking Platform • v1.4.0
        </p>
      </div>

      {/* Mobile background tweaks */}
      <style>{`
        @media (max-width: 640px) {
          .glass-panel { padding: 32px 24px; border-radius: 24px; }
        }
      `}</style>
    </div>
  );
}
