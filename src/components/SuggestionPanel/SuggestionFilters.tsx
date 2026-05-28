import { POKEMON_TYPES, PokemonType } from '../../types';

const TYPE_CLASS: Record<PokemonType, string> = {
  normal: 'bg-type-normal',
  fire: 'bg-type-fire',
  water: 'bg-type-water',
  electric: 'bg-type-electric text-black',
  grass: 'bg-type-grass',
  ice: 'bg-type-ice text-black',
  fighting: 'bg-type-fighting',
  poison: 'bg-type-poison',
  ground: 'bg-type-ground text-black',
  flying: 'bg-type-flying',
  psychic: 'bg-type-psychic',
  bug: 'bg-type-bug',
  rock: 'bg-type-rock',
  ghost: 'bg-type-ghost',
  dragon: 'bg-type-dragon',
  dark: 'bg-type-dark',
  steel: 'bg-type-steel text-black',
  fairy: 'bg-type-fairy',
};

export type GenerationFilter = 'all' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type SuggestionMode = 'best' | 'random';

export interface SuggestionFilterState {
  generation: GenerationFilter;
  types: PokemonType[];
  mode: SuggestionMode;
}

interface Props {
  filters: SuggestionFilterState;
  onChange: (f: SuggestionFilterState) => void;
  onRandomize: () => void;
}

const GEN_RANGES: Record<GenerationFilter, [number, number]> = {
  all: [0, Infinity],
  '1': [1, 151],
  '2': [152, 251],
  '3': [252, 386],
  '4': [387, 493],
  '5': [494, 649],
  '6': [650, 721],
  '7': [722, 809],
  '8': [810, 905],
  '9': [906, Infinity],
};

export function getGenRange(gen: GenerationFilter): [number, number] {
  return GEN_RANGES[gen];
}

const GEN_LABELS: Record<GenerationFilter, string> = {
  all: 'All generations',
  '1': 'Gen 1 (1-151)',
  '2': 'Gen 2 (152-251)',
  '3': 'Gen 3 (252-386)',
  '4': 'Gen 4 (387-493)',
  '5': 'Gen 5 (494-649)',
  '6': 'Gen 6 (650-721)',
  '7': 'Gen 7 (722-809)',
  '8': 'Gen 8 (810-905)',
  '9': 'Gen 9 (906+)',
};

export function SuggestionFilters({ filters, onChange, onRandomize }: Props) {
  const toggleType = (t: PokemonType) => {
    const next = filters.types.includes(t)
      ? filters.types.filter((x) => x !== t)
      : [...filters.types, t];
    onChange({ ...filters, types: next });
  };

  return (
    <div className="flex flex-col gap-3 bg-panel rounded p-3 border border-panel2">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.generation}
          onChange={(e) => onChange({ ...filters, generation: e.target.value as GenerationFilter })}
          className="bg-panel2 rounded px-2 py-1 text-xs"
        >
          {(Object.keys(GEN_LABELS) as GenerationFilter[]).map((g) => (
            <option key={g} value={g}>{GEN_LABELS[g]}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            className={`text-xs px-2 py-1 rounded ${filters.mode === 'best' ? 'bg-accent' : 'bg-panel2 hover:bg-panel'}`}
            onClick={() => onChange({ ...filters, mode: 'best' })}
          >
            Best coverage
          </button>
          <button
            className={`text-xs px-2 py-1 rounded ${filters.mode === 'random' ? 'bg-accent' : 'bg-panel2 hover:bg-panel'}`}
            onClick={() => onChange({ ...filters, mode: 'random' })}
          >
            Random
          </button>
        </div>

        {filters.mode === 'random' && (
          <button
            className="text-xs px-2 py-1 rounded bg-panel2 hover:bg-panel"
            onClick={onRandomize}
          >
            🔀 Randomize again
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {POKEMON_TYPES.map((t) => {
          const selected = filters.types.includes(t);
          const cls = TYPE_CLASS[t] ?? 'bg-slate-600';
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`px-2 py-0.5 text-xs rounded-full font-semibold uppercase tracking-wide transition-opacity ${
                selected ? `${cls} text-white opacity-100` : `${cls} text-white opacity-30 hover:opacity-60`
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
