import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { LogoIcon } from '../components/ui/LogoIcon';

export function Login() {
  const { t, i18n } = useTranslation();
  const { signIn, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { updatePreferences } = useAuthStore();

  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const toggleLang = () => {
    const next = i18n.language === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(next);
    document.documentElement.dir  = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    updatePreferences(next, theme);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(identifiant, password);
    } catch {
      setError(t('auth.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#0F172A' }}
    >
      {/* ── Left panel — brand ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12"
        style={{ background: '#0F172A' }}
      >
        {/* Top: logo */}
        <div className="flex items-center gap-3">
          <LogoIcon size={42} />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 800,
              color: 'white',
            }}
          >
            Daara<span style={{ color: '#10B981' }}>Gest</span>
          </span>
        </div>

        {/* Middle: headline */}
        <div>
          <h2
            className="mb-6 leading-tight"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              fontWeight: 900,
              color: 'white',
              letterSpacing: '-0.03em',
            }}
          >
            La gestion de<br />
            votre école,{' '}
            <span style={{ color: '#10B981' }}>simplifiée.</span>
          </h2>
          <p className="text-base" style={{ color: '#64748B', fontFamily: 'var(--font-body)' }}>
            Élèves · Professeurs · Notes · Bulletins · Finances
          </p>

          {/* Accent bar */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: '#1E293B' }} />
            <span className="text-xs font-semibold" style={{ color: '#F59E0B', fontFamily: 'var(--font-body)' }}>
              École Franco-Arabe · Sénégal
            </span>
            <div className="h-px flex-1" style={{ background: '#1E293B' }} />
          </div>
        </div>

        {/* Bottom: tagline */}
        <p className="text-xs" style={{ color: '#334155' }}>
          DaaraGest v1.0 · Identité graphique confidentielle
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-8 relative"
        style={{ background: theme === 'dark' ? '#0F172A' : '#F1F5F9' }}
      >
        {/* Top controls */}
        <div className="absolute top-5 end-5 flex items-center gap-2">
          <button
            onClick={toggleLang}
            className="h-8 px-3 rounded-lg text-xs font-semibold border transition-colors shadow-sm" style={{background: theme==='dark'?'#1E293B':'white', borderColor: theme==='dark'?'#334155':'#E2E8F0', color: theme==='dark'?'#CBD5E1':'#475569'}}
          >
            {i18n.language === 'fr' ? 'العربية' : 'Français'}
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors shadow-sm text-sm" style={{background: theme==='dark'?'#1E293B':'white', borderColor: theme==='dark'?'#334155':'#E2E8F0', color: theme==='dark'?'#CBD5E1':'#475569'}}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <LogoIcon size={40} />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 800,
              color: theme === 'dark' ? '#F1F5F9' : '#0F172A',
            }}
          >
            Daara<span style={{ color: '#10B981' }}>Gest</span>
          </span>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1
              className="mb-1"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 800,
                color: theme === 'dark' ? '#F1F5F9' : '#0F172A',
                letterSpacing: '-0.02em',
              }}
            >
              Connexion
            </h1>
            <p className="text-sm" style={{ color: '#64748B', fontFamily: 'var(--font-body)' }}>
              {t('app.tagline')}
            </p>
            {/* Gold underline */}
            <div className="mt-3 h-0.5 w-12 rounded-full" style={{ background: '#F59E0B' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="identifiant"
                className="block text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#475569', fontFamily: 'var(--font-body)' }}
              >
                {t('auth.identifiant')}
              </label>
              <input
                id="identifiant"
                type="text"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none"
                style={{
                  background: theme === 'dark' ? '#1E293B' : 'white',
                  borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
                  color: theme === 'dark' ? '#F1F5F9' : '#0F172A',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)'; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = theme === 'dark' ? '#334155' : '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#475569', fontFamily: 'var(--font-body)' }}
              >
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none"
                style={{
                  background: theme === 'dark' ? '#1E293B' : 'white',
                  borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
                  color: theme === 'dark' ? '#F1F5F9' : '#0F172A',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)'; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = theme === 'dark' ? '#334155' : '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <div
                className="p-3 rounded-xl text-sm border"
                style={{
                  background: '#FEF2F2',
                  borderColor: '#FECACA',
                  color: '#DC2626',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{
                background: loading ? '#10B981' : 'linear-gradient(135deg, #10B981, #14B8A6)',
                boxShadow: '0 4px 12px rgba(16,185,129,0.30)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connexion…
                </span>
              ) : t('auth.submit')}
            </button>
          </form>

          {/* Gold accent footer */}
          <div className="mt-8 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: theme === 'dark' ? '#1E293B' : '#E2E8F0' }} />
            <span className="text-xs font-semibold" style={{ color: '#F59E0B', fontFamily: 'var(--font-body)' }}>
              ✦ DaaraGest
            </span>
            <div className="h-px flex-1" style={{ background: theme === 'dark' ? '#1E293B' : '#E2E8F0' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
