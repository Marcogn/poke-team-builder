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
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h2 className="text-lg font-semibold">Settings</h2>

      {/* Team suggestions */}
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-slate-300 uppercase tracking-wide">Team Suggestions</h3>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={settings.includeMegaDynamax}
            onChange={(e) => onSettingsChange({ ...settings, includeMegaDynamax: e.target.checked })}
            className="w-4 h-4 accent-purple-500"
          />
          Include Mega/Dynamax/Gigantamax forms in suggestions
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!settings.excludeLegendaries}
            onChange={(e) => onSettingsChange({ ...settings, excludeLegendaries: !e.target.checked })}
            className="w-4 h-4 accent-purple-500"
          />
          Include Legendary &amp; Mythical Pokémon in suggestions
        </label>
      </section>

      {/* Appearance */}
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-slate-300 uppercase tracking-wide">Appearance</h3>
        <label className="flex items-center gap-3 text-sm">
          <span>Theme:</span>
          <select
            value={settings.theme}
            onChange={(e) => onSettingsChange({ ...settings, theme: e.target.value as AppSettings['theme'] })}
            className="bg-panel2 rounded px-2 py-1 text-sm outline-none"
          >
            <option value="system">System default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>

      {/* Data */}
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-slate-300 uppercase tracking-wide">Data</h3>
        <div className="text-sm text-slate-400">
          <span className="bg-panel2 px-2 py-0.5 rounded text-xs">
            Current data: v{dataVersion}{dataGeneratedAt ? `, generated ${new Date(dataGeneratedAt).toLocaleDateString()}` : ''}
          </span>
        </div>
        <div className="text-xs text-slate-500 bg-panel2 p-3 rounded">
          To regenerate Pokémon data, run: <code className="text-slate-300">npm run generate-data</code>
          <br />then commit <code className="text-slate-300">src/data/pokemon-data.json</code>
        </div>
      </section>

      {/* Install */}
      {installAvailable && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold text-sm text-slate-300 uppercase tracking-wide">App</h3>
          <button
            className="text-xs px-3 py-2 bg-accent rounded hover:bg-violet-500 self-start"
            onClick={onInstall}
          >
            Install App
          </button>
        </section>
      )}
    </div>
  );
}
