import { useState } from 'react';
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
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const members = team.members.filter((m): m is TeamMember => m !== null);

  const filteredPool = includeMegaDynamax
    ? pokemon
    : pokemon.filter((p) => !/-mega|-gmax|-dynamax|-mega-x|-mega-y/.test(p.name));

  const analysis = useCoverageAnalysis(typeChart, members);
  const suggestions = useSuggestions(
    typeChart,
    members,
    filteredPool,
    customs,
    { includeCustoms: includeCustomsAnalysis, excludeLegendaries },
  );

  const canAnalyse = members.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs and actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className={`px-3 py-1.5 rounded text-sm font-semibold ${tab === 'pokemon' ? 'bg-accent' : 'bg-panel2 hover:bg-panel'}`}
          onClick={() => onTabChange('pokemon')}
        >
          Pokémon
        </button>
        <button
          className={`px-3 py-1.5 rounded text-sm font-semibold ${tab === 'analysis' ? 'bg-accent' : 'bg-panel2 hover:bg-panel'}`}
          onClick={() => onTabChange('analysis')}
        >
          Analysis
        </button>
        <div className="ml-auto flex items-center gap-2">
          {tab === 'pokemon' && (
            <button
              className="text-xs px-2 py-1 rounded bg-panel2 hover:bg-panel"
              onClick={() => setExportOpen(true)}
            >
              Export
            </button>
          )}
          <button
            className="text-xs px-2 py-1 rounded text-red-300 hover:text-red-200 hover:bg-red-900/30"
            onClick={() => setDeleteOpen(true)}
          >
            Delete team
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
              className="px-4 py-2 rounded bg-accent disabled:bg-panel2 disabled:text-slate-500 hover:bg-violet-500 font-semibold w-full sm:w-auto"
            >
              Analyze team
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includeCustomsAnalysis}
                onChange={(e) => onIncludeCustomsChange(e.target.checked)}
              />
              Include custom Pokémon in suggestions
            </label>
          </div>
        </>
      )}

      {/* Analysis tab */}
      {tab === 'analysis' && (
        <div className="flex flex-col gap-6">
          {!canAnalyse && (
            <div className="text-sm text-slate-400">
              Add Pokémon in the Pokémon tab to analyze your team.
            </div>
          )}
          {canAnalyse && typeChart && analysis && (
            <>
              <CoverageGrid chart={typeChart} members={members} />
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
                  onApply={onApplySuggestion}
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
