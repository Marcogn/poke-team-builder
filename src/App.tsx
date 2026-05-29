import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import { AppSettings, AppState, AppView, PokemonEntry, Team, TeamMember } from './types';
import { usePokemonData } from './hooks/usePokemonData';
import { Suggestion } from './hooks/suggestionEngine';
import { TeamsPage } from './components/TeamsPage/TeamsPage';
import { TeamDetailPage } from './components/TeamDetailPage/TeamDetailPage';
import { CustomPkmnPage } from './components/CustomRoster/CustomPkmnPage';
import { SettingsPage } from './components/Settings/SettingsPage';
import { SurpriseMeModal } from './components/SurpriseMe/SurpriseMeModal';
import { parseShowdownTeam } from './utils/showdownParser';
import { resolveSpriteUrl } from './utils/spriteUtils';
import './i18n';

const STATE_KEY = 'teamdex_userdata';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  includeMegaDynamax: false,
  excludeLegendaries: false,
};

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

function applyTheme(theme: AppSettings['theme']) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('dark');
  } else if (theme === 'light') {
    html.classList.remove('dark');
  } else {
    // system
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  const data = usePokemonData();
  const [state, setState] = useState<AppState>(loadAppState);
  const [view, setView] = useState<AppView>({ page: 'teams' });
  const [includeCustomsAnalysis, setIncludeCustomsAnalysis] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showMoves, setShowMoves] = useState(false);
  const [surpriseMeOpen, setSurpriseMeOpen] = useState(false);

  const settings: AppSettings = state.settings ?? DEFAULT_SETTINGS;

  const { t } = useTranslation();

  // Apply theme on boot and when settings change
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

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

  const updateSettings = useCallback((s: AppSettings) => {
    setState((prev) => ({ ...prev, settings: s }));
  }, []);

  const getTeam = useCallback(
    (id: string) => state.teams.find((t) => t.id === id),
    [state.teams],
  );

  const updateTeam = useCallback(
    (teamId: string, mut: (t: Team) => Team) => {
      setState((s) => ({
        ...s,
        teams: s.teams.map((t) => (t.id === teamId ? mut(t) : t)),
      }));
    },
    [],
  );

  const updateMember = useCallback(
    (teamId: string, idx: number, m: TeamMember | null) => {
      updateTeam(teamId, (t) => {
        const members = [...t.members];
        members[idx] = m;
        return { ...t, members };
      });
    },
    [updateTeam],
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

  const createEmptyTeam = useCallback(() => {
    const t = emptyTeam(`Team ${state.teams.length + 1}`);
    setState((s) => ({ ...s, teams: [...s.teams, t], activeTeamId: t.id }));
    setView({ page: 'team', teamId: t.id, tab: 'pokemon' });
  }, [state.teams.length]);

  const handleSurpriseCreate = useCallback((members: TeamMember[]) => {
    const teamMembers: (TeamMember | null)[] = members.slice(0, 6);
    while (teamMembers.length < 6) teamMembers.push(null);
    const t: Team = {
      id: uuid(),
      name: `Team ${state.teams.length + 1}`,
      members: teamMembers,
      createdAt: Date.now(),
    };
    setState((s) => ({ ...s, teams: [...s.teams, t], activeTeamId: t.id }));
    setView({ page: 'team', teamId: t.id, tab: 'pokemon' });
    toast('Team created');
  }, [state.teams.length, toast]);

  const handleImportTeam = useCallback((text: string) => {
    const resolveMove = (name: string) => {
      const found = data.moves.find((m) => m.displayName.toLowerCase() === name.toLowerCase());
      if (!found) return null;
      return {
        id: 'imp-' + found.id,
        name: found.displayName,
        type: found.type,
        power: found.power,
        damageClass: found.damageClass,
        isCustom: false,
      };
    };
    const resolveTypes = (name: string) => {
      const found = data.pokemon.find((p) => p.displayName.toLowerCase() === name.toLowerCase());
      if (!found) return null;
      return found.types;
    };
    const parsed = parseShowdownTeam(text, resolveMove, resolveTypes);
    const skipped: string[] = [];
    const accepted = parsed.filter((p) => {
      if (!p.speciesKnown) {
        skipped.push(p.speciesName);
        return false;
      }
      return true;
    });
    const members: (TeamMember | null)[] = accepted.slice(0, 6).map((p) => {
      const found = data.pokemon.find((pp) => pp.displayName.toLowerCase() === p.member.speciesName.toLowerCase());
      return { ...p.member, spriteUrl: resolveSpriteUrl(found, 'card') };
    });
    while (members.length < 6) members.push(null);

    const unknown = Array.from(new Set(accepted.flatMap((p) => p.unknownMoveNames)));
    const t: Team = {
      id: uuid(),
      name: `Imported Team ${state.teams.length + 1}`,
      members,
      createdAt: Date.now(),
    };
    setState((s) => ({ ...s, teams: [...s.teams, t], activeTeamId: t.id }));
    setView({ page: 'team', teamId: t.id, tab: 'pokemon' });

    for (const name of skipped) {
      toast(`Could not import ${name}: Pokémon not found in database. Skipping.`);
    }
    if (unknown.length > 0) {
      toast(`Imported team. ${unknown.length} move(s) need type/power: ${unknown.join(', ')}`);
    } else if (skipped.length === 0) {
      toast('Imported team');
    }
  }, [data.moves, data.pokemon, state.teams.length, toast]);

  const deleteTeam = useCallback((id: string) => {
    setState((s) => {
      const teams = s.teams.filter((t) => t.id !== id);
      const next = teams.length === 0 ? [emptyTeam()] : teams;
      return { ...s, teams: next, activeTeamId: next[0].id };
    });
    setView({ page: 'teams' });
  }, []);

  const duplicateTeam = useCallback((id: string) => {
    setState((s) => {
      const source = s.teams.find((t) => t.id === id);
      if (!source) return s;
      const copy: Team = {
        id: uuid(),
        name: `${source.name} (copy)`,
        createdAt: Date.now(),
        members: source.members.map((m) =>
          m === null
            ? null
            : {
                ...m,
                id: uuid(),
                moves: m.moves.map((mv) =>
                  mv === null ? null : { ...mv, id: uuid() },
                ) as typeof m.moves,
              },
        ),
      };
      return { ...s, teams: [...s.teams, copy], activeTeamId: copy.id };
    });
    toast('Team duplicated');
  }, [toast]);

  const applySuggestion = useCallback(
    (teamId: string, s: Suggestion) => {
      const entry = 'id' in s.candidate && typeof (s.candidate as PokemonEntry).name === 'string'
        ? s.candidate as PokemonEntry
        : null;
      const newMember: TeamMember = {
        id: uuid(),
        speciesName: s.candidateLabel,
        spriteUrl: entry ? resolveSpriteUrl(entry, 'card') : s.spriteUrl,
        types: s.types,
        moves: [null, null, null, null],
        isCustomSaved: false,
      };

      if (s.kind === 'add') {
        updateTeam(teamId, (t) => {
          const membersCopy = [...t.members];
          const emptyIdx = membersCopy.findIndex((m) => m === null);
          const slotIdx = emptyIdx >= 0 ? emptyIdx : membersCopy.length;
          if (slotIdx < 6) {
            membersCopy[slotIdx] = newMember;
          }
          toast(`${s.candidateLabel} added to slot ${slotIdx + 1}`);
          return { ...t, members: membersCopy };
        });
      } else {
        updateTeam(teamId, (t) => {
          const membersCopy = [...t.members];
          const replaceIdx = membersCopy.findIndex(
            (m) => m !== null && m.id === s.replacesMemberId,
          );
          if (replaceIdx >= 0) {
            membersCopy[replaceIdx] = newMember;
            toast(`${s.candidateLabel} replaced ${s.replacesName} in slot ${replaceIdx + 1}`);
          }
          return { ...t, members: membersCopy };
        });
      }
      setView({ page: 'team', teamId, tab: 'pokemon' });
    },
    [updateTeam, toast],
  );

  // Current team for detail page
  const currentTeam = view.page === 'team' ? getTeam(view.teamId) : undefined;

  return (
    <div className="min-h-screen bg-white dark:bg-bg text-gray-900 dark:text-slate-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-[#1a1a2e] border-b border-gray-200 dark:border-white/10 sticky top-0 z-50">
        <span className="bg-accent text-white px-2 py-0.5 rounded text-sm font-bold">TD</span>
        <span className="text-base font-semibold whitespace-nowrap text-gray-900 dark:text-white">Pokémon Team Analyzer</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            data.version === 0 ? 'bg-red-700 text-red-100' : 'bg-panel2 text-slate-400'
          }`}
          title={data.generatedAt ? `Generated: ${new Date(data.generatedAt).toLocaleString()}` : undefined}
        >
          {data.version === 0 ? 'data: not generated' : `data v${data.version}`}
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

      {/* Nav */}
      <nav className="flex gap-1 px-4 py-1 bg-white dark:bg-[#1a1a2e] border-b border-gray-200 dark:border-white/10 sticky top-[40px] z-50">
        <button
          className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${
            view.page === 'teams' || view.page === 'team' ? 'bg-accent text-white' : 'hover:bg-gray-100 dark:hover:bg-panel2 text-gray-700 dark:text-slate-100'
          }`}
          onClick={() => setView({ page: 'teams' })}
        >
          {t('nav.teams')}
        </button>
        <button
          className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${
            view.page === 'custompkmn' ? 'bg-accent text-white' : 'hover:bg-gray-100 dark:hover:bg-panel2 text-gray-700 dark:text-slate-100'
          }`}
          onClick={() => setView({ page: 'custompkmn' })}
        >
          {t('nav.customPkmn')}
        </button>
        <button
          className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${
            view.page === 'settings' ? 'bg-accent text-white' : 'hover:bg-gray-100 dark:hover:bg-panel2 text-gray-700 dark:text-slate-100'
          }`}
          onClick={() => setView({ page: 'settings' })}
        >
          {t('nav.settings')}
        </button>
      </nav>

      {/* Breadcrumb */}
      {view.page === 'team' && currentTeam && (
        <div className="max-w-6xl mx-auto px-4 pt-2 text-sm text-slate-400">
          <button className="hover:text-slate-200 underline" onClick={() => setView({ page: 'teams' })}>
            Teams
          </button>
          <span className="mx-1">&gt;</span>
          <span className="text-slate-200">{currentTeam.name}</span>
        </div>
      )}

      {data.error && (
        <div className="max-w-6xl mx-auto px-4 mt-4 bg-red-900/40 text-red-200 p-3 rounded text-sm">
          {data.error}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-6">
        {view.page === 'teams' && (
          <TeamsPage
            teams={state.teams}
            onSelectTeam={(id) => setView({ page: 'team', teamId: id, tab: 'pokemon' })}
            onCreateEmpty={createEmptyTeam}
            onImport={handleImportTeam}
            onRenameTeam={(id, name) => updateTeam(id, (t) => ({ ...t, name }))}
            onDuplicateTeam={duplicateTeam}
            onSurpriseMe={() => setSurpriseMeOpen(true)}
          />
        )}

        {view.page === 'team' && currentTeam && (
          <TeamDetailPage
            team={currentTeam}
            tab={view.tab}
            onTabChange={(tab) => setView({ page: 'team', teamId: view.teamId, tab })}
            pokemon={data.pokemon}
            moves={data.moves}
            customs={state.customPokemon}
            typeChart={data.typeChart}
            showMoves={showMoves}
            onShowMovesChange={setShowMoves}
            onUpdateMember={(idx, m) => updateMember(view.teamId, idx, m)}
            onSaveCustom={saveCustom}
            onRenameTeam={(name) => updateTeam(view.teamId, (t) => ({ ...t, name }))}
            onDeleteTeam={() => deleteTeam(view.teamId)}
            onApplySuggestion={(s) => applySuggestion(view.teamId, s)}
            includeCustomsAnalysis={includeCustomsAnalysis}
            onIncludeCustomsChange={setIncludeCustomsAnalysis}
            includeMegaDynamax={settings.includeMegaDynamax}
            excludeLegendaries={settings.excludeLegendaries}
          />
        )}

        {view.page === 'custompkmn' && (
          <CustomPkmnPage
            customs={state.customPokemon}
            onAdd={(m) => {
              setState((s) => ({ ...s, customPokemon: [...s.customPokemon, m] }));
              toast('Custom Pokémon saved');
            }}
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

        {view.page === 'settings' && (
          <SettingsPage
            settings={settings}
            onSettingsChange={updateSettings}
            installAvailable={!!installEvent}
            onInstall={async () => {
              if (!installEvent) return;
              await installEvent.prompt();
              await installEvent.userChoice;
              setInstallEvent(null);
            }}
            dataVersion={data.version}
            dataGeneratedAt={data.generatedAt}
          />
        )}
      </main>

      <SurpriseMeModal
        open={surpriseMeOpen}
        onClose={() => setSurpriseMeOpen(false)}
        onCreate={handleSurpriseCreate}
        pokemon={data.pokemon}
        customs={state.customPokemon}
        typeChart={data.typeChart}
      />

      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-panel border border-gray-200 dark:border-panel2 px-3 py-2 rounded shadow-xl text-sm text-gray-900 dark:text-slate-100">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
