import {
  MoveEntry,
  PokemonDataFile,
  PokemonEntry,
  TypeChart,
} from '../types';
import pokemonData from '../data/pokemon-data.json';

export interface PokeDataState {
  pokemon: PokemonEntry[];
  moves: MoveEntry[];
  typeChart: TypeChart | null;
  loading: boolean;
  error: string | null;
  version: number;
  generatedAt: string | null;
}

const MIN_VERSION = 2;

/**
 * Hook: provides statically-imported Pokémon data from pokemon-data.json.
 * No fetching, no localStorage, no loading bar.
 */
export function usePokemonData(): PokeDataState {
  const data = pokemonData as unknown as PokemonDataFile;
  const version = data.version ?? 0;

  if (version < MIN_VERSION) {
    return {
      pokemon: [],
      moves: [],
      typeChart: null,
      loading: false,
      error: 'Pokémon data not available. Run: npm run generate-data',
      version,
      generatedAt: data.generatedAt ?? null,
    };
  }

  return {
    pokemon: data.pokemon as PokemonEntry[],
    moves: (data.moves ?? []) as MoveEntry[],
    typeChart: data.typeChart as unknown as TypeChart,
    loading: false,
    error: null,
    version,
    generatedAt: data.generatedAt ?? null,
  };
}

