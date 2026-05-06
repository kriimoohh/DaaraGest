import { useTranslation } from 'react-i18next';

interface Props {
  pageKey: keyof ReturnType<typeof useTranslation>['t'] extends never ? string : string;
}

export function ComingSoon({ pageKey }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <div className="text-5xl">🚧</div>
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
        {t(`nav.${pageKey}`)}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm">Module en cours de développement</p>
    </div>
  );
}
