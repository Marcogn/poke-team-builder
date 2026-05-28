import { useTranslation } from 'react-i18next';
import { AppSettings } from '../../types';

interface Props {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  installAvailable: boolean;
  onInstall: () => void;
  dataVersion: number;
  dataGeneratedAt: string | null;
}

export function SettingsPage({
  settings,
  onSettingsChange,
  installAvailable,
  onInstall,
  dataVersion,
  dataGeneratedAt,
}: Props) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.title')}</h2>

      {/* Team suggestions */}
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-gray-500 dark:text-slate-300 uppercase tracking-wide">{t('settings.teamSuggestions')}</h3>
        <label className="flex items-center gap-3 text-sm cursor-pointer text-gray-700 dark:text-slate-100">
          <input
            type="checkbox"
            checked={settings.includeMegaDynamax}
            onChange={(e) => onSettingsChange({ ...settings, includeMegaDynamax: e.target.checked })}
            className="w-4 h-4 accent-purple-500"
          />
          {t('settings.includeMega')}
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer text-gray-700 dark:text-slate-100">
          <input
            type="checkbox"
            checked={!settings.excludeLegendaries}
            onChange={(e) => onSettingsChange({ ...settings, excludeLegendaries: !e.target.checked })}
            className="w-4 h-4 accent-purple-500"
          />
          {t('settings.includeLegendary')}
        </label>
      </section>

      {/* Appearance */}
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-gray-500 dark:text-slate-300 uppercase tracking-wide">{t('settings.appearance')}</h3>
        <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-slate-100">
          <span>{t('settings.theme')}:</span>
          <select
            value={settings.theme}
            onChange={(e) => onSettingsChange({ ...settings, theme: e.target.value as AppSettings['theme'] })}
            className="bg-gray-100 dark:bg-panel2 rounded px-2 py-1 text-sm outline-none text-gray-900 dark:text-slate-100"
          >
            <option value="system">{t('settings.systemDefault')}</option>
            <option value="light">{t('settings.light')}</option>
            <option value="dark">{t('settings.dark')}</option>
          </select>
        </label>
      </section>

      {/* Language */}
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-gray-500 dark:text-slate-300 uppercase tracking-wide">{t('settings.language')}</h3>
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded text-sm font-semibold ${
              i18n.language === 'en' ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-panel2 text-gray-700 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-panel'
            }`}
            onClick={() => i18n.changeLanguage('en')}
          >
            EN
          </button>
          <button
            className={`px-3 py-1.5 rounded text-sm font-semibold ${
              i18n.language === 'it' ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-panel2 text-gray-700 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-panel'
            }`}
            onClick={() => i18n.changeLanguage('it')}
          >
            IT
          </button>
        </div>
      </section>

      {/* Data */}
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-gray-500 dark:text-slate-300 uppercase tracking-wide">{t('settings.data')}</h3>
        <div className="text-sm text-gray-500 dark:text-slate-400">
          <span className="bg-gray-100 dark:bg-panel2 px-2 py-0.5 rounded text-xs text-gray-700 dark:text-slate-300">
            {t('settings.currentData', { version: dataVersion })}{dataGeneratedAt ? `, ${t('settings.generated', { date: new Date(dataGeneratedAt).toLocaleDateString() })}` : ''}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-slate-500 bg-gray-50 dark:bg-panel2 p-3 rounded">
          {t('settings.regenerateHint')} <code className="text-gray-700 dark:text-slate-300">npm run generate-data</code>
        </div>
      </section>

      {/* Install */}
      {installAvailable && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold text-sm text-gray-500 dark:text-slate-300 uppercase tracking-wide">{t('settings.app')}</h3>
          <button
            className="text-xs px-3 py-2 bg-accent rounded hover:bg-violet-500 self-start text-white"
            onClick={onInstall}
          >
            {t('settings.installApp')}
          </button>
        </section>
      )}
    </div>
  );
}
