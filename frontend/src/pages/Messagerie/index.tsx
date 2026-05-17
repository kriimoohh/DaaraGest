import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Utilisateur { id: string; nom_fr: string; prenom_fr: string; role: string }
interface Participant { id: string; nom_fr: string; prenom_fr: string; role: string }
interface DernierMessage { corps: string; expediteur: { nom_fr: string; prenom_fr: string }; created_at: string }
interface Conversation {
  id: string;
  sujet: string;
  type: 'individuel' | 'broadcast';
  cibles_roles: string[] | null;
  created_at: string;
  updated_at: string;
  dernier_message: DernierMessage | null;
  participants: Participant[];
  non_lu: boolean;
}
interface Message {
  id: string;
  corps: string;
  expediteur: { id: string; nom_fr: string; prenom_fr: string };
  created_at: string;
}
interface ConversationDetail {
  id: string;
  sujet: string;
  type: string;
  participants: Participant[];
  messages: Message[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  'admin': 'Administrateur',
  'directeur': 'Directeur',
  'gestionnaire': 'Gestionnaire',
  'agent de scolarité': 'Agent de scolarité',
  'professeur': 'Professeur',
  'pointeur': 'Pointeur',
};

const BROADCAST_ROLES = ['directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function tempsRelatif(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const heures = Math.floor(diff / 3600000);
  const jours = Math.floor(diff / 86400000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  if (heures < 24) return `il y a ${heures}h`;
  if (jours === 1) return 'hier';
  return `il y a ${jours}j`;
}

function heureMsg(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── New Conversation Modal ─────────────────────────────────────────────────────

interface NouvelleConvProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conv: ConversationDetail) => void;
  api: ReturnType<typeof useApi>;
}

function NouvelleConversationModal({ isOpen, onClose, onCreated, api }: NouvelleConvProps) {
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [type, setType] = useState<'individuel' | 'broadcast'>('individuel');
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSujet(''); setCorps(''); setType('individuel');
    setSearchUser(''); setSelectedUsers(new Set()); setSelectedRoles(new Set());
    api.get<Utilisateur[]>('/api/v1/messagerie/utilisateurs')
      .then(r => setUtilisateurs(r ?? []))
      .catch(() => {});
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredUsers = utilisateurs.filter(u => {
    const q = searchUser.toLowerCase();
    return !q || `${u.prenom_fr} ${u.nom_fr}`.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const toggleUser = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  };

  const handleSend = async () => {
    if (!sujet.trim()) { toast.error('Le sujet est requis'); return; }
    if (!corps.trim()) { toast.error('Le message est requis'); return; }
    if (type === 'individuel' && selectedUsers.size === 0) { toast.error('Sélectionnez au moins un destinataire'); return; }
    if (type === 'broadcast' && selectedRoles.size === 0) { toast.error('Sélectionnez au moins un rôle'); return; }
    setSaving(true);
    try {
      const payload: { sujet: string; corps: string; destinataire_ids?: string[]; cibles_roles?: string[] } = {
        sujet: sujet.trim(),
        corps: corps.trim(),
      };
      if (type === 'individuel') payload.destinataire_ids = [...selectedUsers];
      else payload.cibles_roles = [...selectedRoles];
      const conv = await api.post<ConversationDetail>('/api/v1/messagerie', payload);
      onCreated(conv);
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur lors de l\'envoi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau message" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Sujet" value={sujet} onChange={e => setSujet(e.target.value)} placeholder="Sujet du message..." />

        {/* Type toggle */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['individuel', 'broadcast'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                style={{
                  padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500, border: '1.5px solid',
                  cursor: 'pointer',
                  background: type === t ? 'var(--terra)' : 'transparent',
                  borderColor: type === t ? 'var(--terra)' : 'var(--rule)',
                  color: type === t ? '#fff' : 'var(--ink-3)',
                }}>
                {t === 'individuel' ? 'Individuel' : 'Diffusion (par rôle)'}
              </button>
            ))}
          </div>
        </div>

        {/* Destinataires */}
        {type === 'individuel' ? (
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Destinataires {selectedUsers.size > 0 && <span style={{ color: 'var(--terra)' }}>({selectedUsers.size} sélectionné{selectedUsers.size > 1 ? 's' : ''})</span>}
            </label>
            <Input value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder="Rechercher un utilisateur..." />
            <div style={{ marginTop: 8, border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', maxHeight: 200, overflowY: 'auto' }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>Aucun utilisateur</div>
              ) : filteredUsers.map(u => (
                <label key={u.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
                    background: selectedUsers.has(u.id) ? 'var(--terra-soft)' : 'transparent',
                    borderBottom: '1px solid var(--rule)',
                  }}>
                  <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleUser(u.id)} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{u.prenom_fr} {u.nom_fr}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)', marginInlineStart: 8 }}>{ROLE_LABELS[u.role] ?? u.role}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Rôles destinataires {selectedRoles.size > 0 && <span style={{ color: 'var(--terra)' }}>({selectedRoles.size} rôle{selectedRoles.size > 1 ? 's' : ''})</span>}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BROADCAST_ROLES.map(role => (
                <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer', background: selectedRoles.has(role) ? 'var(--terra-soft)' : 'var(--paper-2)' }}>
                  <input type="checkbox" checked={selectedRoles.has(role)} onChange={() => toggleRole(role)} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Message */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Message</label>
          <textarea
            value={corps}
            onChange={e => setCorps(e.target.value)}
            placeholder="Écrire votre message..."
            rows={4}
            className="input"
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSend} loading={saving}>Envoyer</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export function MessageriePage() {
  const api = useApi();
  const userId = useAuthStore(s => s.user?.id ?? '');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reponse, setReponse] = useState('');
  const [sending, setSending] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [searchConv, setSearchConv] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const loadConversations = async () => {
    setLoadingConvs(true);
    try {
      const data = await api.get<Conversation[]>('/api/v1/messagerie');
      setConversations(data ?? []);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoadingConvs(false); }
  };

  useEffect(() => { loadConversations(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load conversation detail
  const openConversation = async (conv: Conversation) => {
    setLoadingDetail(true);
    setSelected(null);
    setReponse('');
    try {
      const detail = await api.get<ConversationDetail>(`/api/v1/messagerie/${conv.id}`);
      setSelected(detail);
      // Mark as read locally
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, non_lu: false } : c));
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoadingDetail(false); }
  };

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages?.length]);

  const handleSendReponse = async () => {
    if (!selected || !reponse.trim()) return;
    setSending(true);
    try {
      const msg = await api.post<Message>(`/api/v1/messagerie/${selected.id}/messages`, { corps: reponse.trim() });
      setSelected(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setReponse('');
      // Refresh conversation list for updated timestamps
      loadConversations();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendReponse();
    }
  };

  const filteredConvs = conversations.filter(c => {
    const q = searchConv.toLowerCase();
    return !q || c.sujet.toLowerCase().includes(q) || c.participants.some(p => `${p.prenom_fr} ${p.nom_fr}`.toLowerCase().includes(q));
  });

  return (
    <>
      <PageHeader title="Messagerie" />

      <NouvelleConversationModal
        isOpen={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onCreated={(conv) => {
          setSelected(conv);
          loadConversations();
        }}
        api={api}
      />

      <div style={{ display: 'flex', height: 'calc(100vh - 160px)', gap: 0, background: 'var(--card)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>

        {/* ── Left panel: Conversations ── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderInlineEnd: '1px solid var(--rule)' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--rule)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Conversations</h3>
            <Input
              value={searchConv}
              onChange={e => setSearchConv(e.target.value)}
              placeholder="Rechercher..."
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingConvs ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>Chargement…</div>
            ) : filteredConvs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>Aucune conversation</div>
            ) : filteredConvs.map(conv => {
              const isActive = selected?.id === conv.id;
              const otherParticipants = conv.participants.filter(p => p.id !== userId);
              const participantsLabel = otherParticipants.length > 0
                ? otherParticipants.map(p => p.prenom_fr).join(', ')
                : 'Vous';
              return (
                <button key={conv.id} onClick={() => openConversation(conv)}
                  style={{
                    width: '100%', textAlign: 'start', padding: '12px 16px', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid var(--rule)',
                    background: isActive ? 'var(--terra-soft)' : 'transparent',
                    transition: 'background 0.1s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      {conv.non_lu && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--terra)', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 13, fontWeight: conv.non_lu ? 700 : 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {conv.sujet}
                      </span>
                    </div>
                    {conv.updated_at && (
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', flexShrink: 0 }}>{tempsRelatif(conv.updated_at)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {participantsLabel}
                  </div>
                  {conv.dernier_message && (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                      {conv.dernier_message.corps}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* New message button */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--rule)' }}>
            <Button onClick={() => setNewConvOpen(true)} style={{ width: '100%' }} icon={<span style={{ fontWeight: 700 }}>+</span>}>
              Nouveau message
            </Button>
          </div>
        </div>

        {/* ── Right panel: Messages ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {loadingDetail ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
              Chargement…
            </div>
          ) : !selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--ink-4)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
              <p style={{ fontSize: 14, color: 'var(--ink-4)', textAlign: 'center' }}>
                Sélectionnez une conversation<br />ou créez-en une nouvelle
              </p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{selected.sujet}</h3>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                  <span style={{ fontWeight: 500 }}>Participants : </span>
                  {selected.participants.map((p, i) => (
                    <span key={p.id}>
                      {p.prenom_fr} {p.nom_fr}{p.id === userId ? ' (Vous)' : ''}
                      {i < selected.participants.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selected.messages.length === 0 ? (
                  <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-4)', paddingTop: 32 }}>Aucun message</div>
                ) : selected.messages.map(msg => {
                  const isOwn = msg.expediteur.id === userId;
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!isOwn && (
                          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500 }}>{msg.expediteur.prenom_fr} {msg.expediteur.nom_fr}</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{heureMsg(msg.created_at)}</span>
                        {isOwn && (
                          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500 }}>Vous</span>
                        )}
                      </div>
                      <div style={{
                        maxWidth: '72%', padding: '10px 14px', borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        background: isOwn ? 'var(--terra)' : 'var(--paper-2)',
                        color: isOwn ? '#fff' : 'var(--ink)',
                      }}>
                        {msg.corps}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply box */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--rule)', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  value={reponse}
                  onChange={e => setReponse(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrire un message… (Ctrl+Entrée pour envoyer)"
                  rows={2}
                  className="input"
                  style={{ flex: 1, resize: 'none', fontFamily: 'inherit', fontSize: 13 }}
                />
                <Button onClick={handleSendReponse} loading={sending} disabled={!reponse.trim()}>
                  Envoyer
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
