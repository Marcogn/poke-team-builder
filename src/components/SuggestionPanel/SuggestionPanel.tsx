import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Suggestion } from '../../hooks/suggestionEngine';
import { PokemonEntry, PokemonType } from '../../types';
import { TypeBadge } from '../TypeBadge/TypeBadge';
import {
  SuggestionFilters,
  SuggestionFilterState,
} from './SuggestionFilters';

interface Props {
  suggestions: Suggestion[];
  mixedMovesNote: boolean;
  onApply?: (s: Suggestion) => void;
  generation: string;
  onGenerationChange: (g: string) => void;
}

function filterByType(
  suggestions: Suggestion[],
  types: PokemonType[],
): Suggestion[] {
  if (types.length === 0) return suggestions;
  return suggestions.filter((s) => {
    return s.types.some((t) => t !== null && types.includes(t));
  });
}

function pickRandom(pool: Suggestion[], count: number): Suggestion[] {
  const withGain = pool.filter((s) => s.compositeScore > 0);
  const noGain = pool.filter((s) => s.compositeScore <= 0);
  const picks: Suggestion[] = [];

  const source1 = [...withGain];
  while (picks.length < count && source1.length > 0) {
    const idx = Math.floor(Math.random() * source1.length);
    picks.push(source1[idx]);
    source1.splice(idx, 1);
  }

  const source2 = [...noGain];
  while (picks.length < count && source2.length > 0) {
    const idx = Math.floor(Math.random() * source2.length);
    picks.push(source2[idx]);
    source2.splice(idx, 1);
  }

  return picks;
}

export function SuggestionPanel({ suggestions, mixedMovesNote, onApply, generation, onGenerationChange }: Props) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<SuggestionFilterState>({
    generation: generation as SuggestionFilterState['generation'],
    types: [],
    mode: 'best',
  });
  const [randomSeed, setRandomSeed] = useState(0);

  const handleFilterChange = useCallback((f: SuggestionFilterState) => {
    setFilters(f);
    if (f.generation !== filters.generation) {
      onGenerationChange(f.generation);
    }
  }, [filters.generation, onGenerationChange]);

  const filtered = useMemo(() => filterByType(suggestions, filters.types), [suggestions, filters.types]);

  const displayed = useMemo(() => {
    if (filters.mode === 'random') {
      return pickRandom(filtered, 10);
    }
    return filtered.slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, filters.mode, randomSeed]);

  const handleRandomize = useCallback(() => setRandomSeed((s) => s + 1), []);

  if (suggestions.length === 0) {
    return <div className="text-sm text-slate-400 dark:text-slate-400">{t('suggestions.noSuggestions')}</div>;
  }
  const allZero = displayed.every((s) => s.gain === 0);
  return (
    <div className="flex flex-col gap-3">
      {mixedMovesNote && (
        <div className="text-xs text-amber-300 bg-amber-900/30 rounded p-2">
          Some Pokémon have no moves entered — using type-based coverage for those slots.
        </div>
      )}

      <SuggestionFilters filters={filters} onChange={handleFilterChange} onRandomize={handleRandomize} />

      {displayed.length === 0 && (
        <div className="text-sm text-slate-400">{t('suggestions.noMatch')}</div>
      )}

      {allZero && displayed.length > 0 && (
        <div className="text-sm text-slate-300 dark:text-slate-300">
          {t('suggestions.solidCoverage')}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {displayed.map((s, i) => (
          <SuggestionCard key={i} suggestion={s} onApply={onApply} />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion: s, onApply }: { suggestion: Suggestion; onApply?: (s: Suggestion) => void }) {
  const { t } = useTranslation();
  return (
    <div className="bg-panel dark:bg-panel rounded p-3 flex flex-col gap-2 border border-panel2 dark:border-panel2 bg-white dark:bg-panel">
      <div className="flex items-center gap-2">
        {s.spriteUrl && <img src={s.spriteUrl} alt="" className="w-12 h-12 object-contain" />}
        <div className="flex flex-col">
          <div className="font-semibold text-gray-900 dark:text-white">{s.candidateLabel}</div>
          <div className="flex gap-1 mt-1">
            {s.types[0] && <TypeBadge type={s.types[0]} />}
            {s.types[1] && <TypeBadge type={s.types[1]} />}
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-700 dark:text-slate-300">
        {s.kind === 'add' ? (
          <span>{t('suggestions.addToTeam')}</span>
        ) : (
          <span>
            {t('suggestions.replaces', { name: s.replacesName })}
          </span>
        )}
      </div>
      {/* Breakdown */}
      <div className="text-xs flex flex-col gap-1">
        {s.newlyCovered.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-300">✅ {t('suggestions.covers')}</span>
            {s.newlyCovered.map((tp) => (
              <TypeBadge key={tp} type={tp} />
            ))}
          </div>
        )}
        {s.newWeaknesses.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-amber-600 dark:text-amber-300">⚠️ {t('suggestions.newWeaknesses')}</span>
            {s.newWeaknesses.map((tp) => (
              <TypeBadge key={tp} type={tp} />
            ))}
          </div>
        )}
        {s.aggravatedWeaknesses.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-amber-600 dark:text-amber-300">⚠️ {t('suggestions.aggravates')}</span>
            {s.aggravatedWeaknesses.map((tp) => {
              const memberNames = s.aggravatedMembers.get(tp) ?? [];
              return (
                <span key={tp} className="inline-flex items-center gap-0.5">
                  <TypeBadge type={tp} />
                  {memberNames.length > 0 && (
                    <span className="text-gray-500 dark:text-slate-500">
                      ({t('suggestions.alreadyWeak', { names: memberNames.join(', ') })})
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {s.newWeaknesses.length === 0 && s.aggravatedWeaknesses.length === 0 && (
          <div className="text-emerald-600 dark:text-emerald-300">✅ {t('suggestions.noNewWeaknesses')}</div>
        )}
      </div>
      {onApply && (
        <button
          className="text-xs px-2 py-1 bg-accent rounded self-end hover:bg-violet-500 text-white"
          onClick={() => onApply(s)}
        >
          {s.kind === 'add' ? t('suggestions.addToTeam') : t('suggestions.replaces', { name: s.replacesName })}
        </button>
      )}
    </div>
  );
}
