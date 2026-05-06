import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';

interface DashboardStats {
  nb_eleves: number;
  nb_professeurs: number;
  nb_classes: number;
  paiements_mois: number;
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const api = useApi();
  const [stats, setStats] = useState<DashboardStats>({
    nb_eleves: 0, nb_professeurs: 0, nb_classes: 0, paiements_mois: 0,
  });

  useEffect(() => {
    Promise.allSettled([
      api.get<{ total: number }>('/api/v1/eleves?limit=1'),
      api.get<{ total: number }>('/api/v1/professeurs?limit=1'),
      api.get<unknown[]>('/api/v1/classes'),
      api.get<{ nb_paiements_eleves: number }>('/api/v1/finances/stats'),
    ]).then(([eleves, profs, classes, finances]) => {
      setStats({
        nb_eleves: eleves.status === 'fulfilled' ? (eleves.value as { total: number }).total : 0,
        nb_professeurs: profs.status === 'fulfilled' ? (profs.value as { total: number }).total : 0,
        nb_classes: classes.status === 'fulfilled' ? (classes.value as unknown[]).length : 0,
        paiements_mois: finances.status === 'fulfilled' ? (finances.value as { nb_paiements_eleves: number }).nb_paiements_eleves : 0,
      });
    });
  }, []);

  const displayName =
    i18n.language === 'ar'
      ? `${user?.prenom_ar ?? ''} ${user?.nom_ar ?? ''}`
      : `${user?.prenom_fr ?? ''} ${user?.nom_fr ?? ''}`;

  const cards = [
    { key: 'eleves_inscrits', value: stats.nb_eleves, icon: '🎓', color: 'bg-blue-500' },
    { key: 'professeurs_actifs', value: stats.nb_professeurs, icon: '👨‍🏫', color: 'bg-emerald-500' },
    { key: 'classes_ouvertes', value: stats.nb_classes, icon: '🏫', color: 'bg-amber-500' },
    { key: 'paiements_mois', value: stats.paiements_mois, icon: '💰', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('dashboard.welcome')}, {displayName}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('app.tagline')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-4 shadow-sm"
          >
            <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center text-2xl shadow-sm`}>
              {card.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t(`dashboard.${card.key}`)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
