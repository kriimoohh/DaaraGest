import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotifItem {
  id: string;
  type: string;
  titre: string;
  message: string;
  lu: boolean;
  entite_type: string | null;
  entite_id: string | null;
  created_at: string;
}

interface NotifResponse {
  notifications: NotifItem[];
  non_lues: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function TypeIcon({ type }: { type: string }) {
  const color = TYPE_ICON_COLORS[type] ?? 'var(--ink-3)';

  if (type === 'absence_eleve') {
    return (
      <svg width={18} height={18} viewBox="0 0 24 24" fill={color}>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        <path d="M19.59 13L18 14.59 16.41 13 15 14.41 16.59 16 15 17.59 16.41 19 18 17.41 19.59 19 21 17.59 19.41 16 21 14.41z" />
      </svg>
    );
  }
  if (type === 'paiement_retard') {
    return (
      <svg width={18} height={18} viewBox="0 0 24 24" fill={color}>
        <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
      </svg>
    );
  }
  if (type === 'note_insuffisante') {
    return (
      <svg width={18} height={18} viewBox="0 0 24 24" fill={color}>
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
    );
  }
  if (type === 'absence_professeur') {
    return (
      <svg width={18} height={18} viewBox="0 0 24 24" fill={color}>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    );
  }
  // Default bell
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill={color}>
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  );
}

const TYPE_ICON_COLORS: Record<string, string> = {
  absence_eleve:        'var(--danger)',
  paiement_retard:      'var(--warning)',
  note_insuffisante:    'var(--terra)',
  absence_personnel:    'var(--info)',
  absence_professeur:   'var(--info)', // alias historique (cf. notifications.service.ts)
};

// ── NotificationBell ──────────────────────────────────────────────────────────

export function NotificationBell() {
  const { t } = useTranslation();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.get<NotifResponse>('/api/v1/notifications');
      setNotifs(res?.notifications ?? []);
      setUnread(res?.non_lues ?? 0);
    } catch {
      // Silently fail for background polling
    }
  }, []);

  // Initial fetch + auto-refresh every 60s
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markOne = async (id: string) => {
    const notif = notifs.find(n => n.id === id);
    if (!notif || notif.lu) return;
    try {
      await api.put(`/api/v1/notifications/${id}/lue`, {});
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await api.put('/api/v1/notifications/lire-toutes', {});
      setNotifs(prev => prev.map(n => ({ ...n, lu: true })));
      setUnread(0);
      toast.success('Toutes les notifications marquées comme lues');
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setMarkingAll(false); }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-3)',
          padding: 6,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'background 0.15s',
        }}
        title={t('notifications.titre')} aria-label={t('notifications.titre')}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2, right: 2,
              background: 'var(--danger)',
              color: '#fff',
              borderRadius: '50%',
              width: 16, height: 16,
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: 320,
            background: 'var(--paper)',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 100,
            marginTop: 8,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--rule)',
              background: 'var(--paper-2)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
              {t('notifications.titre')}
              {unread > 0 && (
                <span
                  style={{
                    marginInlineStart: 6,
                    background: 'var(--danger)',
                    color: '#fff',
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                  }}
                >
                  {unread}
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={markingAll}
                style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 11,
                  color: 'var(--terra)', fontWeight: 500,
                  padding: 0,
                }}
              >
                {markingAll ? '…' : t('notifications.tout_lire')}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div
                style={{
                  padding: 24, textAlign: 'center',
                  fontSize: 13, color: 'var(--ink-4)',
                }}
              >
                {t('notifications.aucune')}
              </div>
            ) : (
              notifs.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--rule)',
                    background: n.lu ? 'var(--paper)' : 'var(--paper-2)',
                    cursor: n.lu ? 'default' : 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: 32, height: 32,
                      borderRadius: '50%',
                      background: `color-mix(in srgb, ${TYPE_ICON_COLORS[n.type] ?? 'var(--ink-3)'} 10%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TypeIcon type={n.type} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13, fontWeight: n.lu ? 400 : 600,
                        color: 'var(--ink)', marginBottom: 2,
                        display: 'flex', justifyContent: 'space-between',
                        gap: 4,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.titre}
                      </span>
                      {!n.lu && (
                        <span
                          style={{
                            flexShrink: 0,
                            width: 8, height: 8,
                            borderRadius: '50%',
                            background: 'var(--danger)',
                            marginTop: 3,
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12, color: 'var(--ink-3)',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
