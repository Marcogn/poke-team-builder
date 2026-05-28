import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSuggestions } from '../useSuggestions';
import { buildMember, mockPokemonList, mockTypeChart } from '../../utils/__tests__/testFixtures';
import { TeamMember } from '../../types';

describe('useSuggestions hook', () => {
  it('returns empty array when chart is null', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const { result } = renderHook(() =>
      useSuggestions(null, team, mockPokemonList, [], { includeCustoms: false }),
    );
    expect(result.current).toEqual([]);
  });

  it('returns suggestions when chart and team provided', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const { result } = renderHook(() =>
      useSuggestions(mockTypeChart, team, mockPokemonList, [], { includeCustoms: false }),
    );
    expect(Array.isArray(result.current)).toBe(true);
    expect(result.current.length).toBeGreaterThan(0);
  });

  it('memoises result across re-renders with same inputs', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const customs: TeamMember[] = [];
    const options = { includeCustoms: false };
    const { result, rerender } = renderHook(
      ({ members }) => useSuggestions(mockTypeChart, members, mockPokemonList, customs, options),
      { initialProps: { members: team } },
    );
    const first = result.current;
    rerender({ members: team });
    expect(result.current).toBe(first);
  });

  it('recomputes when includeCustoms option toggles', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const { result, rerender } = renderHook(
      ({ inc }) =>
        useSuggestions(mockTypeChart, team, mockPokemonList, [], { includeCustoms: inc }),
      { initialProps: { inc: false } },
    );
    const first = result.current;
    rerender({ inc: true });
    expect(result.current).not.toBe(first);
  });
});
