import { useMemo } from 'react';
import {
  PokemonEntry,
  TeamMember,
  TypeChart,
} from '../types';
import { computeSuggestions, Suggestion } from './suggestionEngine';

export type { Suggestion } from './suggestionEngine';

export function useSuggestions(
  chart: TypeChart | null,
  members: TeamMember[],
  pool: PokemonEntry[],
  customs: TeamMember[],
  options: { includeCustoms: boolean },
) {
  return useMemo<Suggestion[]>(() => {
    if (!chart) return [];
    return computeSuggestions(chart, members, pool, customs, {
      includeCustoms: options.includeCustoms,
    });
  }, [chart, members, pool, customs, options.includeCustoms]);
}
