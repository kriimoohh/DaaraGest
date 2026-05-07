import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';

interface Stats { nb_eleves: number; nb_professeurs: number; nb_classes: number; paiements_mois: number; }
interface MoisStat { label: string; mois: number; annee: number; total: number; }
interface StatsMois { total_encaisse_eleves: number; nb_paiements_eleves: number; total_paye_professeurs: number; }

const quickLinks = [
  { key: 'eleves',      path: '/eleves',      icon: '🎓', bg: 'bg-blue-50 dark:bg-blue-900/20',    color: 'text-blue-600 dark:text-blue-400' },
  { key: 'classes',     path: '/classes',     icon: '🏫', bg: 'bg-amber-50 dark:bg-amber-900/20',  color: 'text-amber-600 dark:text-amber-400' },
  { key: 'notes',       path: '/notes',       icon: '📝', bg: 'bg-purple-50 dark:bg-purple-900/20',color: 'text-purple-600 dark:text-purple-400' },
  { key: 'bulletins',   path: '/bulletins',   icon: '📋', bg: 'bg-emerald-50 dark:bg-emerald-900/20', color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'finances',    path: '/finances',    icon: '💰', bg: 'bg-rose-50 dark:bg-rose-900/20',    color: 'text-rose-600 dark:text-rose-400' },
  { key: 'pointage',    path: '/pointage',    icon: '📌', bg: 'bg-teal-50 dark:bg-teal-900/20',    color: 'text-teal-600 dark:text-teal-400' },
  { key: 'professeurs', path: '/professeurs', icon: '👨‍🏫', bg: 'bg-indigo-50 dark:bg-indigo-900/20', color: 'text-indigo-600 dark:text-indigo-400' },
];

function formatMontant(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const api = useApi();
  const { user: storedUser } = useAuthStore();

  const [stats, setStats] = useState<Stats>({ nb_eleves: 0, nb_professeurs: 0, nb_classes: 0, paiements_mois: 0 });
  const [statsMois, setStatsMois] = useState<StatsMois | null>(null);
  const [statsMensuels, setStatsMensuels] = useState<MoisStat[]>([]);
  const [etablissement, setEtablissement] = useState<{ nom_fr: string; nom_ar: string } | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.get<{ total: number }>('/api/v1/eleves?limit=1'),
      api.get<{ total: number }>('/api/v1/professeurs?limit=1'),
      api.get<unknown[]>('/api/v1/classes'),
      api.get<StatsMois>('/api/v1/finances/stats'),
      api.get<{ nom_fr: string; nom_ar: string }>('/api/v1/parametres'),
      api.get<MoisStat[]>('/api/v1/finances/stats-mensuels'),
    ]).then(([eleves, profs, classes, finances, etab, mensuels]) => {
      setStats({
        nb_eleves:      eleves.status    === 'fulfilled' ? (eleves.value as { total: number }).total : 0,
        nb_professeurs: profs.status     === 'fulfilled' ? (profs.value as { total: number }).total : 0,
        nb_classes:     classes.status   === 'fulfilled' ? (classes.value as unknown[]).length : 0,
        paiements_mois: finances.status  === 'fulfilled' ? (finances.value as StatsMois).nb_paiements_eleves : 0,
      });
      if (finances.status === 'fulfilled') setStatsMois(finances.value as StatsMois);
      if (etab.status === 'fulfilled') setEtablissement(etab.value as { nom_fr: string; nom_ar: string });
      if (mensuels.status === 'fulfilled') setStatsMensuels(mensuels.value as MoisStat[]);
    });
  }, []);

  const isAr = i18n.language === 'ar';
  const displayName = isAr
    ? `${user?.prenom_ar ?? ''} ${user?.nom_ar ?? ''}`
    : `${user?.prenom_fr ?? ''} ${user?.nom_fr ?? ''}`;
  const schoolName = isAr ? etablissement?.nom_ar : etablissement?.nom_fr;
  const hour = new Date().getHours();
  const greeting = isAr
    ? (hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء الخير')
    : (hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir');

  const statCards = [
    { key: 'eleves_inscrits',   value: stats.nb_eleves,      icon: '🎓', from: 'from-blue-500',    to: 'to-blue-600' },
    { key: 'professeurs_actifs',value: stats.nb_professeurs, icon: '👨‍🏫', from: 'from-emerald-500', to: 'to-emerald-600' },
    { key: 'classes_ouvertes',  value: stats.nb_classes,     icon: '🏫', from: 'from-amber-500',   to: 'to-amber-600' },
    { key: 'paiements_mois',    value: stats.paiements_mois, icon: '💰', from: 'from-purple-500',  to: 'to-purple-600' },
  ];

  const moisActuel = new Date().getMonth();
  const BAR_COLORS = statsMensuels.map((_, i) =>
    i === statsMensuels.length - 1 ? '#10B981' : i === moisActuel ? '#10B981' : '#94A3B8'
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl p-8 text-white shadow-lg"
        style={{ background: 'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)', boxShadow: '0 8px 24px rgba(16,185,129,0.25)' }}>
        <div className="relative z-10">
          <p className="text-emerald-100 text-sm font-medium">{greeting} 👋</p>
          <h1 className="text-3xl mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '-0.03em' }}>
            {displayName}
          </h1>
          {schoolName && (
            <p className="text-emerald-100 mt-1 text-sm flex items-center gap-1.5">
              <span>🏫</span> {schoolName}
            </p>
          )}
          <p className="text-emerald-200/70 text-xs mt-3">
            {new Date().toLocaleDateString(isAr ? 'ar-SN' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full" />
        <div className="absolute -right-4 bottom-0 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute right-20 top-4 w-6 h-6 bg-white/20 rounded-full" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.key} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.from} ${card.to} flex items-center justify-center text-xl mb-4 shadow-sm`}>
              {card.icon}
            </div>
            <p className="text-3xl tabular-nums text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>
              {card.value}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t(`dashboard.${card.key}`)}</p>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Encaissements 6 derniers mois */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Encaissements — 6 derniers mois</h3>
          {statsMensuels.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statsMensuels} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatMontant(v)} />
                <Tooltip
                  formatter={(value) => [`${new Intl.NumberFormat('fr-FR').format(Number(value))} FCFA`, 'Encaissé']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: 12 }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {statsMensuels.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Aucune donnée financière</div>
          )}
        </div>

        {/* Résumé financier mois courant */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ce mois</h3>
          {statsMois ? (
            <div className="space-y-3">
              {[
                { label: 'Encaissé élèves', value: statsMois.total_encaisse_eleves, color: 'text-emerald-600 dark:text-emerald-400', icon: '💰' },
                { label: 'Nb paiements', value: statsMois.nb_paiements_eleves, color: 'text-blue-600 dark:text-blue-400', icon: '📄', raw: true },
                { label: 'Versé profs', value: statsMois.total_paye_professeurs, color: 'text-purple-600 dark:text-purple-400', icon: '👨‍🏫' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{s.icon}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{s.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${s.color}`}>
                    {s.raw ? Number(s.value) : `${new Intl.NumberFormat('fr-FR').format(Number(s.value))} FCFA`}
                  </span>
                </div>
              ))}
              <Link to="/finances" className="block text-center text-xs text-emerald-600 dark:text-emerald-400 hover:underline pt-1">
                Voir les finances →
              </Link>
            </div>
          ) : (
            <div className="text-slate-400 text-sm text-center py-8">Chargement…</div>
          )}
        </div>
      </div>

      {/* Quick access */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
          {t('dashboard.acces_rapide')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {quickLinks
            .filter((l) => {
              const role = storedUser?.role ?? '';
              const allowed: Record<string, string[]> = {
                eleves:      ['admin','directeur','caissier'],
                classes:     ['admin','directeur','professeur'],
                notes:       ['admin','directeur','professeur'],
                bulletins:   ['admin','directeur','professeur'],
                finances:    ['admin','directeur','caissier'],
                pointage:    ['admin','directeur'],
                professeurs: ['admin','directeur'],
              };
              return (allowed[l.key] ?? []).includes(role);
            })
            .map((link) => (
              <Link key={link.key} to={link.path}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all duration-150">
                <div className={`w-10 h-10 rounded-xl ${link.bg} ${link.color} flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-150`}>
                  {link.icon}
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 text-center group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {t(`nav.${link.key}`)}
                </span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
