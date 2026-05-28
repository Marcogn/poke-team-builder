import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { AppState, Team, TeamMember } from './types';
import { usePokemonData } from './hooks/usePokemonData';
import { useCoverageAnalysis } from './hooks/useCoverageAnalysis';
import { useSuggestions } from './hooks/useSuggestions';
import { TeamBuilder } from './components/TeamBuilder/TeamBuilder';
import { CoverageGrid } from './components/CoverageGrid/CoverageGrid';
import { SuggestionPanel } from './components/SuggestionPanel/SuggestionPanel';
import { ImportExport } from './components/ImportExport/ImportExport';
import { CustomRoster } from './components/CustomRoster/CustomRoster';
import { Settings } from './components/Settings/Settings';

const STATE_KEY = 'teamdex_userdata';

function emptyTeam(name = 'New Team'): Team {
  return {
    id: uuid(),
    name,
    members: [null, null, null, null, null, null],
    createdAt: Date.now(),
  };
}

function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    // ignore
  }
  const t = emptyTeam('My First Team');
  return { teams: [t], customPokemon: [], activeTeamId: t.id };
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  const data = usePokemonData();
  const [state, setState] = useState<AppState>(loadAppState);
  const [includeCustomsAnalysis, setIncludeCustomsAnalysis] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [tab, setTab] = useState<'team' | 'analysis' | 'roster' | 'io' | 'settings'>('team');

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2500);
  }, []);

  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId) ?? state.teams[0];

  const updateActiveTeam = useCallback(
    (mut: (t: Team) => Team) => {
      setState((s) => ({
        ...s,
        teams: s.teams.map((t) => (t.id === s.activeTeamId ? mut(t) : t)),
      }));
    },
    [],
  );

  const updateMember = useCallback(
    (idx: number, m: TeamMember | null) => {
      updateActiveTeam((t) => {
        const members = [...t.members];
        members[idx] = m;
        return { ...t, members };
      });
    },
    [updateActiveTeam],
  );

  const saveCustom = useCallback(
    (m: TeamMember) => {
      setState((s) => ({
        ...s,
        customPokemon: [...s.customPokemon, { ...m, id: uuid(), isCustomSaved: true }],
      }));
      toast('Custom Pokémon saved');
    },
    [toast],
  );

  const members = activeTeam.members.filter((m): m is TeamMember => m !== null);
  const analysis = useCoverageAnalysis(data.typeChart, members);
  const suggestions = useSuggestions(
    data.typeChart,
    members,
    data.pokemon,
    state.customPokemon,
    { includeCustoms: includeCustomsAnalysis },
  );

  const canAnalyse = members.length > 0;

  const newTeam = () => {
    const t = emptyTeam(`Team ${state.teams.length + 1}`);
    setState((s) => ({ ...s, teams: [...s.teams, t], activeTeamId: t.id }));
  };
  const deleteTeam = (id: string) => {
    setState((s) => {
      const teams = s.teams.filter((t) => t.id !== id);
      const next = teams.length === 0 ? [emptyTeam()] : teams;
      return { ...s, teams: next, activeTeamId: next[0].id };
    });
  };

  const progress = data.loading ? Math.round(data.progress) : 100;

  return (
    <div className="min-h-screen bg-bg text-slate-100">
      {/* Compact, single-row header. */}
      <header className="flex items-center gap-3 px-4 py-2 bg-[#1a1a2e] border-b border-white/10 sticky top-0 z-20">
        <span className="bg-accent text-white px-2 py-0.5 rounded text-sm font-bold">
          TD
        </span>
        <span className="text-base font-semibold whitespace-nowrap">
          Pokémon Team Analyzer
        </span>
        {installEvent && (
          <button
            onClick={async () => {
              if (!installEvent) return;
              await installEvent.prompt();
              await installEvent.userChoice;
              setInstallEvent(null);
            }}
            className="ml-auto text-xs px-2 py-1 rounded bg-accent hover:bg-violet-500"
          >
            Install
          </button>
        )}
      </header>
      {/* Nav bar — horizontally scrollable on narrow screens. */}
      <nav className="flex gap-1 px-4 py-1 bg-[#1a1a2e] border-b border-white/10 overflow-x-auto sticky top-12 z-10">
        {(['team', 'analysis', 'roster', 'io', 'settings'] as const).map((t) => (
          <button
            key={t}
            className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${
              tab === t ? 'bg-accent' : 'hover:bg-panel2'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'io' ? 'Import/Export' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {/* Team switcher — moved out of the header for the compact layout. */}
      <div className="max-w-6xl mx-auto px-4 pt-3 flex items-center gap-2 flex-wrap">
        {state.teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setState((s) => ({ ...s, activeTeamId: t.id }))}
            className={`text-xs px-2 py-1 rounded border ${
              t.id === state.activeTeamId ? 'bg-accent border-accent' : 'border-panel2 hover:bg-panel2'
            }`}
          >
            {t.name}
          </button>
        ))}
        <button
          onClick={newTeam}
          className="text-xs px-2 py-1 rounded bg-panel2 hover:bg-panel"
        >
          + New team
        </button>
        {state.teams.length > 1 && (
          <button
            onClick={() => deleteTeam(activeTeam.id)}
            className="text-xs px-2 py-1 rounded text-red-300 hover:text-red-200"
          >
            Delete current
          </button>
        )}
      </div>

      {data.loading && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="bg-panel rounded p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span>Loading PokéAPI data — {data.stage}…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-panel2 rounded">
              <div className="h-2 bg-accent rounded" style={{ width: `${progress}%` }} />
            </div>
            {/* Skeleton placeholders are only rendered while loading; once
                loading completes the real 6 team slots take over below. */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-24" />
              ))}
            </div>
          </div>
        </div>
      )}
      {data.error && (
        <div className="max-w-6xl mx-auto px-4 mt-4 bg-red-900/40 text-red-200 p-3 rounded text-sm">
          Failed to load PokéAPI data: {data.error}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-6">
        {tab === 'team' && (
          <>
            {/* The 6 team slots always render once loading is done, regardless
                of whether any slot is filled. Skeleton cards above are scoped
                to the loading block only. */}
            <TeamBuilder
              team={activeTeam}
              pokemon={data.pokemon}
              moves={data.moves}
              customs={state.customPokemon}
              onUpdateMember={updateMember}
              onSaveCustom={saveCustom}
              onRenameTeam={(name) => updateActiveTeam((t) => ({ ...t, name }))}
            />
            <div className="flex items-center gap-3">
              <button
                disabled={!canAnalyse}
                onClick={() => {
                  setTab('analysis');
                }}
                className="px-4 py-2 rounded bg-accent disabled:bg-panel2 disabled:text-slate-500 hover:bg-violet-500 font-semibold"
              >
                Analyze
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeCustomsAnalysis}
                  onChange={(e) => setIncludeCustomsAnalysis(e.target.checked)}
                />
                Include custom Pokémon in suggestions
              </label>
            </div>
          </>
        )}

        {tab === 'analysis' && (
          <div className="flex flex-col gap-6">
            {!canAnalyse && (
              <div className="text-sm text-slate-400">
                Add at least one Pokémon to your team to enable analysis.
              </div>
            )}
            {canAnalyse && data.typeChart && analysis && (
              <>
                <CoverageGrid chart={data.typeChart} members={members} />
                <section>
                  <h3 className="font-semibold mb-2">Uncovered Types</h3>
                  {analysis.team.uncovered.length === 0 ? (
                    <div className="text-sm text-emerald-300">
                      Your team can hit every type super-effectively. 🎉
                    </div>
                  ) : (
                    <div className="text-sm text-amber-200">
                      Missing super-effective coverage on:{' '}
                      <span className="font-semibold">{analysis.team.uncovered.join(', ')}</span>
                    </div>
                  )}
                </section>
                <section>
                  <h3 className="font-semibold mb-2">Suggestions</h3>
                  <SuggestionPanel
                    suggestions={suggestions}
                    mixedMovesNote={analysis.team.mixed}
                  />
                </section>
              </>
            )}
          </div>
        )}

        {tab === 'roster' && (
          <CustomRoster
            customs={state.customPokemon}
            onRename={(id, name) =>
              setState((s) => ({
                ...s,
                customPokemon: s.customPokemon.map((c) => (c.id === id ? { ...c, speciesName: name } : c)),
              }))
            }
            onDelete={(id) => {
              setState((s) => ({ ...s, customPokemon: s.customPokemon.filter((c) => c.id !== id) }));
              toast('Custom Pokémon deleted');
            }}
          />
        )}

        {tab === 'io' && (
          <ImportExport
            team={activeTeam}
            pokemon={data.pokemon}
            moves={data.moves}
            onImport={(imported, unknown, skipped) => {
              updateActiveTeam((t) => {
                const members = [...t.members];
                for (let i = 0; i < imported.length && i < 6; i++) members[i] = imported[i];
                return { ...t, members };
              });
              for (const name of skipped) {
                toast(`Could not import ${name}: Pokémon not found in database. Skipping.`);
              }
              if (unknown.length > 0) {
                toast(`Imported team. ${unknown.length} move(s) need type/power: ${unknown.join(', ')}`);
              } else if (skipped.length === 0) {
                toast('Imported team');
              }
            }}
            toast={toast}
          />
        )}

        {tab === 'settings' && (
          <Settings
            onResetCache={data.resetCache}
            installAvailable={!!installEvent}
            onInstall={async () => {
              if (!installEvent) return;
              await installEvent.prompt();
              await installEvent.userChoice;
              setInstallEvent(null);
            }}
          />
        )}
      </main>

      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-panel border border-panel2 px-3 py-2 rounded shadow-xl text-sm">
          {toastMsg}
        </div>
      )}

    </div>
  );
}
