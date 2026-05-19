import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { API_BASE } from '../../lib/api';

interface ScanResult {
  action: 'arrivee' | 'depart' | 'deja_complet';
  heure: string;
  nom: string;
  professeur_id: string;
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
  professeur: { utilisateur: { nom_fr: string; prenom_fr: string | null } };
}

const ACTION_LABELS = {
  arrivee: { label: 'Arrivée enregistrée', bg: '#22c55e', icon: '✓' },
  depart: { label: 'Départ enregistré', bg: '#3b82f6', icon: '✓' },
  deja_complet: { label: 'Déjà enregistré aujourd\'hui', bg: '#f59e0b', icon: '⚠' },
};

export function ScannerPage() {
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
            id: `${result.professeur_id}-${Date.now()}`,
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

  const feedbackInfo = feedback ? ACTION_LABELS[feedback.action] : null;
  const overlayVisible = !!feedback || !!error;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
      fontFamily: 'system-ui, sans-serif',
      color: '#f1f5f9',
    }}>
      {/* En-tête */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
          DaaraGest
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
          Pointage par QR Code
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
          Scannez votre QR code pour enregistrer votre présence
        </p>
      </div>

      {/* Zone scanner */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#1e293b',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid #334155',
      }}>
        {/* Overlay feedback */}
        {overlayVisible && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: error ? 'rgba(239,68,68,0.95)' : feedbackInfo ? `${feedbackInfo.bg}ee` : 'transparent',
            borderRadius: 16,
            transition: 'background 0.2s',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {error ? '✗' : feedbackInfo?.icon}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', textAlign: 'center', padding: '0 24px' }}>
              {error ?? feedbackInfo?.label}
            </div>
            {feedback && (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 12 }}>
                  {feedback.nom}
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
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
            <div style={{ fontSize: 48 }}>📷</div>
            <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
              Cliquez sur le bouton ci-dessous pour démarrer la caméra
            </p>
            <button
              onClick={startScanner}
              style={{
                background: '#3b82f6', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 32px', fontSize: 15,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Démarrer le scanner
            </button>
          </div>
        )}
      </div>

      {started && (
        <button
          onClick={stopScanner}
          style={{
            marginTop: 12, background: 'transparent', color: '#64748b',
            border: '1px solid #334155', borderRadius: 8, padding: '8px 20px',
            fontSize: 13, cursor: 'pointer',
          }}
        >
          Arrêter la caméra
        </button>
      )}

      {/* Derniers scans de la session */}
      {historique.length > 0 && (
        <div style={{ width: '100%', maxWidth: 420, marginTop: 20 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
            Cette session
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historique.map(h => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#1e293b', borderRadius: 8, padding: '10px 14px',
                border: '1px solid #334155',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: h.action === 'arrivee' ? '#22c55e' : '#3b82f6',
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{h.nom}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {h.action === 'arrivee' ? 'Arrivée' : 'Départ'}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#cbd5e1' }}>
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
          <div style={{ fontSize: 12, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>
            Pointages du jour
          </div>
          <button
            onClick={chargerScansDuJour}
            style={{
              background: 'transparent', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: 11, padding: '2px 8px',
            }}
          >
            {loadingScans ? '…' : '↻ Actualiser'}
          </button>
        </div>

        {scansDuJour.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            Aucun scan aujourd'hui
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {scansDuJour.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#1e293b', borderRadius: 8, padding: '8px 14px',
                border: '1px solid #334155',
              }}>
                <span style={{ fontSize: 13 }}>
                  {s.professeur.utilisateur.prenom_fr} {s.professeur.utilisateur.nom_fr}
                </span>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, fontFamily: 'monospace' }}>
                  {s.heure_arrivee && (
                    <span style={{ color: '#4ade80' }}>↑ {s.heure_arrivee}</span>
                  )}
                  {s.heure_depart && (
                    <span style={{ color: '#60a5fa' }}>↓ {s.heure_depart}</span>
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
