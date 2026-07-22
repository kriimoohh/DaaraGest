import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, monthName, weekdayShortNames } from '../../lib/dates';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Evenement {
  id: string;
  titre_fr: string;
  description: string | null;
  date_debut: string;
  date_fin: string;
  type: string;
  couleur: string;
  createur: { nom_fr: string; prenom_fr: string };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  vacances:  'var(--success)',
  examen:    'var(--warning)',
  evenement: 'var(--info)',
  fermeture: 'var(--danger)',
  reunion:   'var(--terra)',
};

const TYPE_LABELS: Record<string, string> = {
  vacances:  'calendrier.vacances',
  examen:    'calendrier.examen',
  evenement: 'calendrier.evenement',
  fermeture: 'calendrier.fermeture',
  reunion:   'calendrier.reunion',
};

const GESTION_ROLES = ['admin', 'directeur', 'gestionnaire'];

function formatTypeBadge(type: string): 'success' | 'warning' | 'info' | 'error' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = {
    vacances: 'success',
    examen: 'warning',
    evenement: 'info',
    fermeture: 'error',
    reunion: 'neutral',
  };
  return map[type] ?? 'neutral';
}

function formatDate(dateStr: string) {
  return fmtDate(dateStr, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Calendar grid helpers ─────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  // month is 0-based
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0=Sun..6=Sat → convert to Mon-based (0=Mon..6=Sun)
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function eventSpansDay(ev: Evenement, year: number, month: number, day: number): boolean {
  const date = new Date(year, month, day);
  const start = new Date(ev.date_debut);
  const end = new Date(ev.date_fin);
  // Normalize to midnight
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EventForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  title,
}: {
  form: {
    titre_fr: string;
    description: string;
    date_debut: string;
    date_fin: string;
    type: string;
    couleur: string;
  };
  setForm: Dispatch<SetStateAction<typeof form>>;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={title}
      size="md"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel}>{t('actions.annuler')}</Button>
          <Button onClick={onSubmit} loading={saving}>{t('actions.enregistrer')}</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label={t('calendrier.titre_fr')}
          value={form.titre_fr}
          onChange={e => setForm(f => ({ ...f, titre_fr: e.target.value }))}
          placeholder={t('calendrier.titre_placeholder')}
        />
        <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label={t('calendrier.date_debut')}
            type="date"
            value={form.date_debut}
            onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))}
          />
          <Input
            label={t('calendrier.date_fin')}
            type="date"
            value={form.date_fin}
            onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
          />
        </div>
        <Select
          label={t('calendrier.type')}
          value={form.type}
          onChange={e => {
            const t = e.target.value;
            setForm(f => ({ ...f, type: t, couleur: TYPE_COLORS[t] ?? f.couleur }));
          }}
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label: t(label) }))}
          placeholder={t('calendrier.type_placeholder')}
        />
        <div className="field">
          <label className="field-label">{t('calendrier.couleur')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={form.couleur}
              onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
              style={{ width: 40, height: 36, border: '1px solid var(--rule)', borderRadius: 6, cursor: 'pointer', padding: 2 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_COLORS).map(([key, color]) => (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, couleur: color }))}
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: color,
                    border: form.couleur === color ? '2px solid var(--ink)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                  title={t(TYPE_LABELS[key])}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="field">
          <label className="field-label">{t('calendrier.description')}</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            className="input"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
            placeholder={t('calendrier.description_placeholder')}
          />
        </div>
      </div>
    </Modal>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function CalendrierPage() {
  const { t } = useTranslation();
  const api = useApi();
  const { user } = useAuthStore();
  const canManage = GESTION_ROLES.includes(user?.role ?? '');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [events, setEvents] = useState<Evenement[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal add/edit
  const emptyForm = {
    titre_fr: '',
    description: '',
    date_debut: '',
    date_fin: '',
    type: 'evenement',
    couleur: TYPE_COLORS.evenement,
  };
  const [showAdd, setShowAdd] = useState(false);
  const [editEvt, setEditEvt] = useState<Evenement | null>(null);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Selected day detail
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await api.get<Evenement[]>(`/api/v1/calendrier?annee=${year}&mois=${month + 1}`);
      setEvents(data ?? []);
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const handleAdd = async () => {
    if (!addForm.titre_fr || !addForm.date_debut || !addForm.date_fin || !addForm.type) {
      toast.error(t('calendrier.champs_obligatoires'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/calendrier', {
        titre_fr: addForm.titre_fr,
        description: addForm.description || undefined,
        date_debut: addForm.date_debut,
        date_fin: addForm.date_fin,
        type: addForm.type,
        couleur: addForm.couleur,
      });
      toast.success(t('calendrier.evenement_ajoute'));
      setShowAdd(false);
      setAddForm(emptyForm);
      loadEvents();
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editEvt) return;
    if (!editForm.titre_fr || !editForm.date_debut || !editForm.date_fin || !editForm.type) {
      toast.error(t('calendrier.champs_obligatoires'));
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/v1/calendrier/${editEvt.id}`, {
        titre_fr: editForm.titre_fr,
        description: editForm.description || undefined,
        date_debut: editForm.date_debut,
        date_fin: editForm.date_fin,
        type: editForm.type,
        couleur: editForm.couleur,
      });
      toast.success(t('calendrier.evenement_modifie'));
      setEditEvt(null);
      loadEvents();
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('calendrier.confirm_suppression'))) return;
    try {
      await api.delete(`/api/v1/calendrier/${id}`);
      toast.success(t('calendrier.evenement_supprime'));
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      toast.error((err as Error).message || t('common.erreur_generique'));
    }
  };

  const openEdit = (ev: Evenement) => {
    setEditForm({
      titre_fr: ev.titre_fr,
      description: ev.description ?? '',
      date_debut: ev.date_debut.split('T')[0],
      date_fin: ev.date_fin.split('T')[0],
      type: ev.type,
      couleur: ev.couleur,
    });
    setEditEvt(ev);
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  // Total cells = 6 rows * 7 cols
  const totalCells = 42;
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(Math.max(0, totalCells - firstDow - daysInMonth)).fill(null),
  ];

  const todayDate = new Date();
  const isToday = (d: number) =>
    d === todayDate.getDate() &&
    month === todayDate.getMonth() &&
    year === todayDate.getFullYear();

  // Events for a specific day
  const eventsForDay = (day: number) =>
    events.filter(e => eventSpansDay(e, year, month, day));

  // Events for selected day
  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : [];

  // Month events list
  const monthEvents = [...events].sort((a, b) =>
    new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
  );

  return (
    <>
      <PageHeader
        title={t('calendrier.titre', 'Calendrier scolaire')}
        action={
          canManage ? (
            <Button onClick={() => { setAddForm(emptyForm); setShowAdd(true); }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" style={{ marginInlineEnd: 6 }}>
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              Ajouter un événement
            </Button>
          ) : undefined
        }
      />

      {/* Month navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
          padding: '10px 16px',
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          borderRadius: 10,
        }}
      >
        <button
          onClick={prevMonth}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
          {monthName(month + 1, year)} {year}
        </div>
        <button
          onClick={nextMonth}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>
        <button
          onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
          style={{
            background: 'none', border: '1px solid var(--rule)',
            borderRadius: 6, cursor: 'pointer', color: 'var(--ink-3)',
            padding: '4px 10px', fontSize: 12,
          }}
        >
          Aujourd'hui
        </button>
      </div>

      {loading ? (
        <div className="card empty">{t('calendrier.chargement')}</div>
      ) : (
        <div className="cal-layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Calendar grid */}
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div
              className="cal-grid-scroll"
              style={{
                border: '1px solid var(--rule)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {/* Day headers */}
              <div
                className="cal-grid-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  background: 'var(--paper-2)',
                  borderBottom: '1px solid var(--rule)',
                }}
              >
                {weekdayShortNames().map(j => (
                  <div
                    key={j}
                    style={{
                      textAlign: 'center',
                      padding: '8px 4px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    {j}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div
                className="cal-grid-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                }}
              >
                {cells.map((day, idx) => {
                  const dayEvents = day ? eventsForDay(day) : [];
                  const isSelected = day === selectedDay;
                  const isTodayDay = day ? isToday(day) : false;

                  return (
                    <div
                      key={idx}
                      onClick={() => day && setSelectedDay(isSelected ? null : day)}
                      style={{
                        minHeight: 80,
                        padding: '6px 4px 4px',
                        borderBottom: idx < 35 ? '1px solid var(--rule)' : 'none',
                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--rule)' : 'none',
                        background: isSelected
                          ? 'var(--paper-2)'
                          : !day
                          ? 'var(--paper-3)'
                          : 'var(--paper)',
                        cursor: day ? 'pointer' : 'default',
                        transition: 'background 0.1s',
                      }}
                    >
                      {day && (
                        <>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: isTodayDay ? 700 : 400,
                              color: isTodayDay ? 'var(--terra)' : 'var(--ink)',
                              marginBottom: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: isTodayDay ? 'var(--terra-soft)' : 'transparent',
                            }}
                          >
                            {day}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dayEvents.slice(0, 3).map(ev => (
                              <div
                                key={ev.id}
                                style={{
                                  fontSize: 10,
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  background: ev.couleur + '22',
                                  color: 'var(--ink-2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontWeight: 500,
                                }}
                              >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: ev.couleur, flexShrink: 0 }} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.titre_fr}</span>
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <div style={{ fontSize: 10, color: 'var(--ink-4)', paddingInlineStart: 4 }}>
                                +{dayEvents.length - 3}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Day detail panel */}
          {selectedDay && selectedDayEvents.length > 0 && (
            <div
              className="cal-day-panel"
              style={{
                width: 240,
                flexShrink: 0,
                background: 'var(--paper)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: 'var(--ink)' }}>
                {selectedDay} {monthName(month + 1, year)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedDayEvents.map(ev => (
                  <div
                    key={ev.id}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: ev.couleur + '15',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: ev.couleur, flexShrink: 0 }} />
                      {ev.titre_fr}
                    </div>
                    {ev.description && (
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{ev.description}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                      {formatDate(ev.date_debut)} → {formatDate(ev.date_fin)}
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button
                          onClick={() => openEdit(ev)}
                          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--rule)', background: 'var(--paper)', cursor: 'pointer', color: 'var(--ink-2)' }}
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: 'none', background: 'var(--danger)', cursor: 'pointer', color: '#fff' }}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Events list for current month */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 10 }}>
          Événements de {monthName(month + 1, year)} {year}
        </div>
        {monthEvents.length === 0 ? (
          <div className="card empty">{t('calendrier.aucun_mois')}</div>
        ) : (
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    {[t('calendrier.col_titre'), t('calendrier.col_debut'), t('calendrier.col_fin', 'Fin'), t('calendrier.col_type'), canManage ? t('calendrier.col_actions') : ''].filter(Boolean).map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthEvents.map(ev => (
                    <tr key={ev.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 10, height: 10, borderRadius: '50%',
                              background: ev.couleur, flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 500 }}>{ev.titre_fr}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{formatDate(ev.date_debut)}</td>
                      <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{formatDate(ev.date_fin)}</td>
                      <td>
                        <Badge label={TYPE_LABELS[ev.type] ? t(TYPE_LABELS[ev.type]) : ev.type} variant={formatTypeBadge(ev.type)} />
                      </td>
                      {canManage && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => openEdit(ev)}
                              style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--rule)', background: 'var(--paper)', cursor: 'pointer', color: 'var(--ink-2)' }}
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(ev.id)}
                              style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, border: 'none', background: 'var(--danger)', cursor: 'pointer', color: '#fff' }}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <EventForm
          form={addForm}
          setForm={setAddForm}
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
          saving={saving}
          title={t('calendrier.ajouter_evenement', 'Ajouter un événement')}
        />
      )}

      {/* Edit modal */}
      {editEvt && (
        <EventForm
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleEdit}
          onCancel={() => setEditEvt(null)}
          saving={saving}
          title={t('calendrier.modifier_evenement', 'Modifier l\'événement')}
        />
      )}
    </>
  );
}
