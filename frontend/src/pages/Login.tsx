import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { LogoMark } from '../components/ui/LogoMark';

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
    } catch (err) {
      // Remonter le message serveur quand il existe (ex. compte verrouillé après
      // trop de tentatives), sinon message générique traduit.
      setError(err instanceof Error && err.message ? err.message : t('auth.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Controls */}
      <div style={{ position: 'absolute', top: 16, insetInlineEnd: 16, display: 'flex', gap: 8 }}>
        <button className="tb-pill" onClick={toggleLang} title={t('login.langue', 'Langue')}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 00-1.38-3.56A8.03 8.03 0 0118.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 015.08 16zm2.95-8H5.08a7.987 7.987 0 014.33-3.56A15.65 15.65 0 008.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 01-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
          </svg>
          {i18n.language === 'fr' ? 'AR' : 'FR'}
        </button>
        <button className="tb-btn" onClick={toggleTheme} title={t('login.theme', 'Thème')}>
          {theme === 'dark' ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
            </svg>
          ) : (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3a9 9 0 100 18A9 9 0 0012 3zm0 16a7 7 0 010-14c.34 0 .67.03 1 .07A5.99 5.99 0 0010 11a6 6 0 006 6 5.99 5.99 0 004.93-2.93c.04.32.07.66.07 1a7 7 0 01-9 6.93z" />
            </svg>
          )}
        </button>
      </div>

      <div className="login-card">
        {/* Brand */}
        <div className="login-brand" style={{ flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <LogoMark size={64} />
          <div style={{ textAlign: 'center' }}>
            <div className="sb-name" style={{ fontSize: 22 }}>Daara<span style={{ color: 'var(--terra)' }}>Gest</span></div>
            <div className="sb-tag">{t('login.tagline', 'Gestion scolaire franco-arabe')}</div>
          </div>
        </div>

        <h1 className="login-title">{t('auth.login', 'Connexion')}</h1>
        <p className="login-sub">{t('app.tagline', 'La gestion de votre école, simplifiée')}</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="identifiant">{t('auth.identifiant', 'Identifiant')}</label>
            <input
              id="identifiant"
              type="text"
              className="input"
              value={identifiant}
              onChange={e => setIdentifiant(e.target.value)}
              required
              autoComplete="username"
              placeholder="admin"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">{t('auth.password', 'Mot de passe')}</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--danger-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--danger-text)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: 14 }}
          >
            {loading ? (
              <>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                  <circle cx={12} cy={12} r={10} strokeOpacity={0.25} />
                  <path d="M12 2a10 10 0 0110 10" />
                </svg>
                {t('login.connexion_loading', 'Connexion…')}
              </>
            ) : t('auth.submit', 'Se connecter')}
          </button>
        </form>

        <div className="divider" style={{ marginTop: 24 }} />
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-4)' }}>
          {t('login.footer', 'École franco-arabe · Sénégal')}
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
