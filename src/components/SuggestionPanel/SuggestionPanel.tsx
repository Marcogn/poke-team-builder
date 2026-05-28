import { useMemo, useState, useCallback } from 'react';
import { Suggestion } from '../../hooks/suggestionEngine';
import { PokemonEntry, PokemonType } from '../../types';
import { TypeBadge } from '../TypeBadge/TypeBadge';
import {
  SuggestionFilters,
  SuggestionFilterState,
  getGenRange,
} from './SuggestionFilters';

interface Props {
  suggestions: Suggestion[];
  mixedMovesNote: boolean;
  onApply?: (s: Suggestion) => void;
}

function filterSuggestions(
  suggestions: Suggestion[],
  filters: SuggestionFilterState,
): Suggestion[] {
  let result = suggestions;

  // Generation filter
  if (filters.generation !== 'all') {
    const [min, max] = getGenRange(filters.generation);
    result = result.filter((s) => {
      const entry = s.candidate as PokemonEntry;
      if (typeof entry.id === 'number') {
        return entry.id >= min && entry.id <= max;
      }
      return true; // custom Pokémon pass through
    });
  }

  // Type filter
  if (filters.types.length > 0) {
    result = result.filter((s) => {
      return s.types.some((t) => t !== null && filters.types.includes(t));
    });
  }

  return result;
}

function pickRandom(pool: Suggestion[], count: number): Suggestion[] {
  // Prefer gain > 0, fill remainder from gain = 0
  const withGain = pool.filter((s) => s.gain > 0);
  const noGain = pool.filter((s) => s.gain <= 0);
  const picks: Suggestion[] = [];

  // First pick from gain > 0
  const source1 = [...withGain];
  while (picks.length < count && source1.length > 0) {
    const idx = Math.floor(Math.random() * source1.length);
    picks.push(source1[idx]);
    source1.splice(idx, 1);
  }

  // Fill from gain = 0 if needed
  const source2 = [...noGain];
  while (picks.length < count && source2.length > 0) {
    const idx = Math.floor(Math.random() * source2.length);
    picks.push(source2[idx]);
    source2.splice(idx, 1);
  }

  return picks;
}

export function SuggestionPanel({ suggestions, mixedMovesNote, onApply }: Props) {
  const [filters, setFilters] = useState<SuggestionFilterState>({
    generation: 'all',
    types: [],
    mode: 'best',
  });
  const [randomSeed, setRandomSeed] = useState(0);

  const filtered = useMemo(() => filterSuggestions(suggestions, filters), [suggestions, filters]);

  const displayed = useMemo(() => {
    if (filters.mode === 'random') {
      return pickRandom(filtered, 5);
    }
    return filtered.slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, filters.mode, randomSeed]);

  const handleRandomize = useCallback(() => setRandomSeed((s) => s + 1), []);

  if (suggestions.length === 0) {
    return <div className="text-sm text-slate-400">No suggestions available.</div>;
  }
  const allZero = displayed.every((s) => s.gain === 0);
  return (
    <div className="flex flex-col gap-3">
      {mixedMovesNote && (
        <div className="text-xs text-amber-300 bg-amber-900/30 rounded p-2">
          Some Pokémon have no moves entered — using type-based coverage for those slots.
        </div>
      )}

      <SuggestionFilters filters={filters} onChange={setFilters} onRandomize={handleRandomize} />

      {displayed.length === 0 && (
        <div className="text-sm text-slate-400">No suggestions match current filters.</div>
      )}

      {allZero && displayed.length > 0 && (
        <div className="text-sm text-slate-300">
          Your team coverage is solid. These are alternatives with similar coverage or less overlap:
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {displayed.map((s, i) => (
          <div key={i} className="bg-panel rounded p-3 flex flex-col gap-2 border border-panel2">
            <div className="flex items-center gap-2">
              {s.spriteUrl && <img src={s.spriteUrl} alt="" className="w-12 h-12 object-contain" />}
              <div className="flex flex-col">
                <div className="font-semibold">{s.candidateLabel}</div>
                <div className="flex gap-1 mt-1">
                  {s.types[0] && <TypeBadge type={s.types[0]} />}
                  {s.types[1] && <TypeBadge type={s.types[1]} />}
                </div>
              </div>
            </div>
            <div className="text-xs">
              {s.kind === 'add' ? (
                <span className="text-slate-300">Add to team</span>
              ) : (
                <span className="text-slate-300">
                  Replaces: <strong>{s.replacesName}</strong>
                </span>
              )}
            </div>
            <div className="text-xs">
              {s.newlyCovered.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-slate-400">New types covered:</span>
                  {s.newlyCovered.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
              ) : (
                <span className="text-slate-400">No new types — reduces overlap.</span>
              )}
            </div>
            {onApply && (
              <button
                className="text-xs px-2 py-1 bg-accent rounded self-end hover:bg-violet-500"
                onClick={() => onApply(s)}
              >
                {s.kind === 'add' ? 'Add to team' : `Replaces ${s.replacesName}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

