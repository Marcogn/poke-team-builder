import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoveEntry, PokemonEntry, Team, TeamMember, TypeChart } from '../../types';
import { TeamBuilder } from '../TeamBuilder/TeamBuilder';
import { CoverageGrid } from '../CoverageGrid/CoverageGrid';
import { SuggestionPanel } from '../SuggestionPanel/SuggestionPanel';
import { ExportModal } from '../Modal/ExportModal';
import { DeleteTeamModal } from '../Modal/DeleteTeamModal';
import { useCoverageAnalysis } from '../../hooks/useCoverageAnalysis';
import { useSuggestions, Suggestion } from '../../hooks/useSuggestions';

interface Props {
  team: Team;
  tab: 'pokemon' | 'analysis';
  onTabChange: (tab: 'pokemon' | 'analysis') => void;
  pokemon: PokemonEntry[];
  moves: MoveEntry[];
  customs: TeamMember[];
  typeChart: TypeChart | null;
  showMoves: boolean;
  onShowMovesChange: (v: boolean) => void;
  onUpdateMember: (idx: number, m: TeamMember | null) => void;
  onSaveCustom: (m: TeamMember) => void;
  onRenameTeam: (name: string) => void;
  onDeleteTeam: () => void;
  onApplySuggestion: (s: Suggestion) => void;
  includeCustomsAnalysis: boolean;
  onIncludeCustomsChange: (v: boolean) => void;
  includeMegaDynamax: boolean;
  excludeLegendaries: boolean;
}

export function TeamDetailPage({
  team,
  tab,
  onTabChange,
  pokemon,
  moves,
  customs,
  typeChart,
  showMoves,
  onShowMovesChange,
  onUpdateMember,
  onSaveCustom,
  onRenameTeam,
  onDeleteTeam,
  onApplySuggestion,
  includeCustomsAnalysis,
  onIncludeCustomsChange,
  includeMegaDynamax,
  excludeLegendaries,
}: Props) {
  const { t } = useTranslation();
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [generation, setGeneration] = useState<string>('all');

  const members = team.members.filter((m): m is TeamMember => m !== null);

  // When the "Enable move slots" toggle is off, the analysis must ignore any
  // moves that are still stored on the team members. We strip them here so the
  // coverage/suggestion engines uniformly fall back to type-based coverage.
  const analysisMembers = useMemo<TeamMember[]>(
    () =>
      showMoves
        ? members
        : members.map((m) => ({ ...m, moves: [null, null, null, null] })),
    [members, showMoves],
  );

  const filteredPool = includeMegaDynamax
    ? pokemon
    : pokemon.filter((p) => !/-mega|-gmax|-dynamax|-mega-x|-mega-y/.test(p.name));

  const analysis = useCoverageAnalysis(typeChart, analysisMembers);
  const suggestions = useSuggestions(
    typeChart,
    analysisMembers,
    filteredPool,
    customs,
    { includeCustoms: includeCustomsAnalysis, excludeLegendaries, generation },
  );

  const canAnalyse = members.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs and actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className={`px-3 py-1.5 rounded text-sm font-semibold ${tab === 'pokemon' ? 'bg-accent text-white' : 'bg-panel2 hover:bg-panel text-gray-900 dark:text-slate-100'}`}
          onClick={() => onTabChange('pokemon')}
        >
          {t('teamDetail.pokemonTab')}
        </button>
        <button
          className={`px-3 py-1.5 rounded text-sm font-semibold ${tab === 'analysis' ? 'bg-accent text-white' : 'bg-panel2 hover:bg-panel text-gray-900 dark:text-slate-100'}`}
          onClick={() => onTabChange('analysis')}
        >
          {t('teamDetail.analysisTab')}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {tab === 'pokemon' && (
            <button
              className="text-xs px-2 py-1 rounded bg-panel2 hover:bg-panel text-gray-900 dark:text-slate-100"
              onClick={() => setExportOpen(true)}
            >
              {t('teamDetail.export')}
            </button>
          )}
          <button
            className="text-xs px-2 py-1 rounded text-red-600 dark:text-red-300 hover:text-red-500 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/30"
            onClick={() => setDeleteOpen(true)}
          >
            {t('teamDetail.deleteTeam')}
          </button>
        </div>
      </div>

      {/* Pokémon tab */}
      {tab === 'pokemon' && (
        <>
          <TeamBuilder
            team={team}
            pokemon={pokemon}
            moves={moves}
            customs={customs}
            showMoves={showMoves}
            onShowMovesChange={onShowMovesChange}
            onUpdateMember={onUpdateMember}
            onSaveCustom={onSaveCustom}
            onRenameTeam={onRenameTeam}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              disabled={!canAnalyse}
              onClick={() => onTabChange('analysis')}
              className="px-4 py-2 rounded bg-accent disabled:bg-panel2 disabled:text-slate-500 hover:bg-violet-500 font-semibold w-full sm:w-auto text-white"
            >
              {t('teamDetail.analyzeTeam')}
            </button>
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeCustomsAnalysis}
                onChange={(e) => onIncludeCustomsChange(e.target.checked)}
              />
              {t('teamDetail.includeCustom')}
            </label>
          </div>
        </>
      )}

      {/* Analysis tab */}
      {tab === 'analysis' && (
        <div className="flex flex-col gap-6">
          {!canAnalyse && (
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t('analysis.empty')}
            </div>
          )}
          {canAnalyse && typeChart && analysis && (
            <>
              <CoverageGrid chart={typeChart} members={analysisMembers} />
              <section>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t('analysis.uncoveredTypes')}</h3>
                {analysis.team.uncovered.length === 0 ? (
                  <div className="text-sm text-emerald-600 dark:text-emerald-300">
                    {t('analysis.fullCoverage')}
                  </div>
                ) : (
                  <div className="text-sm text-amber-600 dark:text-amber-200">
                    {t('analysis.missingCoverage')}{' '}
                    <span className="font-semibold">{analysis.team.uncovered.join(', ')}</span>
                  </div>
                )}
              </section>
              <section>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t('analysis.suggestions')}</h3>
                <SuggestionPanel
                  suggestions={suggestions}
                  mixedMovesNote={analysis.team.mixed}
                  onApply={onApplySuggestion}
                  generation={generation}
                  onGenerationChange={setGeneration}
                />
              </section>
            </>
          )}
        </div>
      )}

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} team={team} />
      <DeleteTeamModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDeleteTeam}
        teamName={team.name}
      />
    </div>
  );
}
