import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Observabilité (optionnel). Import dynamique : sans VITE_SENTRY_DSN, @sentry/react
// n'est même pas téléchargé (zéro coût bundle quand désactivé).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  import('@sentry/react').then(Sentry => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0,
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
