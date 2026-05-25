import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { API_BASE } from '../../lib/api';

interface ScanResult {
  action: 'arrivee' | 'depart' | 'deja_complet';
  heure: string;
  nom: string;
  personnel_id: string;
}

interface ScanHistorique {
  id: string;
  nom: string;
  heure: string;
  action: 'arrivee' | 'depart';
}

interface ScanDuJour {
  id: string;
  heure_arrivee: string | null;
  heure_depart: string | null;
  personnel: { utilisateur: { nom_fr: string; prenom_fr: string | null } };
}

const ACTION_STYLES = {
  arrivee: { bg: 'var(--success)', icon: '✓' },
  depart: { bg: 'var(--info)', icon: '✓' },
  deja_complet: { bg: 'var(--warning)', icon: '⚠' },
};

export function ScannerPage() {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [started, setStarted] = useState(false);
  const [feedback, setFeedback] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historique, setHistorique] = useState<ScanHistorique[]>([]);
  const [scansDuJour, setScansDuJour] = useState<ScanDuJour[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const processingRef = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charge l'etablissement_id depuis le localStorage (authStore zustand persist)
  const getEtablissementId = (): string | null => {
    try {
      const raw = localStorage.getItem('daaragest-auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.user?.etablissement_id ?? null;
    } catch {
      return null;
    }
  };

  const chargerScansDuJour = async () => {
    const etabId = getEtablissementId();
    if (!etabId) return;
    setLoadingScans(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/pointage/scans-jour?etablissement_id=${etabId}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data: ScanDuJour[] = await res.json();
        setScansDuJour(data);
      }
    } catch {
      // silencieux
    } finally {
      setLoadingScans(false);
    }
  };

  useEffect(() => {
    chargerScansDuJour();
  }, []);

  const handleScan = async (token: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    setError(null);
    setFeedback(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/pointage/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erreur lors du scan');
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => {
          setError(null);
          processingRef.current = false;
        }, 3000);
        return;
      }

      const result: ScanResult = data;
      setFeedback(result);

      if (result.action !== 'deja_complet') {
        setHistorique(prev => [
          {
            id: `${result.personnel_id}-${Date.now()}`,
            nom: result.nom,
            heure: result.heure,
            action: result.action as 'arrivee' | 'depart',
          },
          ...prev.slice(0, 9),
        ]);
        chargerScansDuJour();
      }

      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => {
        setFeedback(null);
        processingRef.current = false;
      }, 3000);
    } catch {
      setError('Erreur réseau. Vérifiez la connexion.');
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => {
        setError(null);
        processingRef.current = false;
      }, 3000);
    }
  };

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 5, qrbox: { width: 250, height: 250 } },
        (decodedText) => { handleScan(decodedText); },
        () => { /* ignore erreurs de non-détection */ }
      );
      setStarted(true);
    } catch {
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setStarted(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const feedbackInfo = feedback ? {
    ...ACTION_STYLES[feedback.action],
    label: t(`pointage.action_${feedback.action}`),
  } : null;
  const overlayVisible = !!feedback || !!error;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--paper)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--font-sans)',
      color: 'var(--ink)',
    }}>
      {/* En-tête */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
          {t('app.name', 'DaaraGest')}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
          {t('pointage.scanner_titre')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>
          {t('pointage.scanner_sub')}
        </p>
      </div>

      {/* Zone scanner */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--card)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid var(--rule)',
        boxShadow: 'var(--shadow)',
      }}>
        {/* Overlay feedback */}
        {overlayVisible && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: error ? 'var(--danger)' : feedbackInfo ? feedbackInfo.bg : 'transparent',
            borderRadius: 'var(--r-lg)',
            transition: 'background 0.2s',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12, color: '#fff' }}>
              {error ? '✗' : feedbackInfo?.icon}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', textAlign: 'center', padding: '0 24px' }}>
              {error ?? feedbackInfo?.label}
            </div>
            {feedback && (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 12, fontFamily: 'var(--font-display)' }}>
                  {feedback.nom}
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  {feedback.heure}
                </div>
              </>
            )}
          </div>
        )}

        <div id="qr-reader" style={{ width: '100%' }} />

        {!started && (
          <div style={{
            padding: 32, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 16,
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', textAlign: 'center', margin: 0 }}>
              {t('pointage.scanner_intro')}
            </p>
            <button
              onClick={startScanner}
              style={{
                background: 'var(--terra)', color: '#fff', border: 'none',
                borderRadius: 'var(--r-md)', padding: '12px 32px', fontSize: 15,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t('pointage.scanner_demarrer')}
            </button>
          </div>
        )}
      </div>

      {started && (
        <button
          onClick={stopScanner}
          style={{
            marginTop: 12, background: 'transparent', color: 'var(--ink-3)',
            border: '1px solid var(--rule)', borderRadius: 'var(--r-sm)', padding: '8px 20px',
            fontSize: 13, cursor: 'pointer',
          }}
        >
          {t('pointage.scanner_arreter')}
        </button>
      )}

      {/* Derniers scans de la session */}
      {historique.length > 0 && (
        <div style={{ width: '100%', maxWidth: 420, marginTop: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
            {t('pointage.scanner_session')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historique.map(h => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--card)', borderRadius: 'var(--r-sm)', padding: '10px 14px',
                border: '1px solid var(--rule)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: h.action === 'arrivee' ? 'var(--success)' : 'var(--info)',
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{h.nom}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {t(h.action === 'arrivee' ? 'pointage.label_arrivee' : 'pointage.label_depart')}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-2)' }}>
                    {h.heure}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scans du jour (depuis BDD) */}
      <div style={{ width: '100%', maxWidth: 420, marginTop: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', letterSpacing: 1, textTransform: 'uppercase' }}>
            {t('pointage.scanner_du_jour')}
          </div>
          <button
            onClick={chargerScansDuJour}
            style={{
              background: 'transparent', border: 'none', color: 'var(--ink-3)',
              cursor: 'pointer', fontSize: 11, padding: '2px 8px',
            }}
          >
            {loadingScans ? '…' : `↻ ${t('actions.actualiser')}`}
          </button>
        </div>

        {scansDuJour.length === 0 ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            {t('pointage.scanner_aucun_jour')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {scansDuJour.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--card)', borderRadius: 'var(--r-sm)', padding: '8px 14px',
                border: '1px solid var(--rule)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                  {s.personnel.utilisateur.prenom_fr} {s.personnel.utilisateur.nom_fr}
                </span>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  {s.heure_arrivee && (
                    <span style={{ color: 'var(--success)' }}>↑ {s.heure_arrivee}</span>
                  )}
                  {s.heure_depart && (
                    <span style={{ color: 'var(--info)' }}>↓ {s.heure_depart}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
