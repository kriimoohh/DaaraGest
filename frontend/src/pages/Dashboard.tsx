import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

interface StatCard {
  key: string;
  value: number;
  icon: string;
  color: string;
}

const stats: StatCard[] = [
  { key: 'eleves_inscrits', value: 0, icon: '🎓', color: 'bg-blue-500' },
  { key: 'professeurs_actifs', value: 0, icon: '👨‍🏫', color: 'bg-emerald-500' },
  { key: 'classes_ouvertes', value: 0, icon: '🏫', color: 'bg-amber-500' },
  { key: 'paiements_mois', value: 0, icon: '💰', color: 'bg-purple-500' },
];

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const displayName =
    i18n.language === 'ar'
      ? `${user?.prenom_ar ?? ''} ${user?.nom_ar ?? ''}`
      : `${user?.prenom_fr ?? ''} ${user?.nom_fr ?? ''}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('dashboard.welcome')}, {displayName}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('app.tagline')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-4 shadow-sm"
          >
            <div
              className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-2xl shadow-sm`}
            >
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(`dashboard.${stat.key}`)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
