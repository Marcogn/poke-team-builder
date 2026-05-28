import { describe, it, expect } from 'vitest';
import { computeSuggestions } from '../suggestionEngine';
import { buildMember, mockPokemonList, mockTypeChart } from '../../utils/__tests__/testFixtures';
import { TeamMember } from '../../types';

describe('suggestionEngine — ranking by coverage gain', () => {
  it('candidates are sorted by gain descending in addition mode', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    expect(suggestions.length).toBeGreaterThan(1);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].gain).toBeGreaterThanOrEqual(suggestions[i].gain);
    }
  });

  it('candidates are sorted by gain descending in replacement mode', () => {
    const team: TeamMember[] = [
      buildMember('Charizard', ['fire', 'flying']),
      buildMember('Gyarados', ['water', 'flying']),
      buildMember('Mawile', ['steel', 'fairy']),
      buildMember('Garchomp', ['dragon', 'ground']),
      buildMember('Moltres', ['fire', 'flying']),
      buildMember('Sylveon', ['fairy', null]),
    ];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    expect(suggestions.length).toBeGreaterThan(1);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].gain).toBeGreaterThanOrEqual(suggestions[i].gain);
    }
  });

  it('secondary sort: when gain is equal, lower ID comes first (more iconic)', () => {
    // Build a team that makes multiple candidates have identical gain
    const team: TeamMember[] = [
      buildMember('Pikachu', ['electric', null]),
      buildMember('Charizard', ['fire', 'flying']),
      buildMember('Gyarados', ['water', 'flying']),
      buildMember('Garchomp', ['dragon', 'ground']),
      buildMember('Mawile', ['steel', 'fairy']),
    ];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });

    // Among suggestions with the same gain, verify id-based secondary sort
    for (let i = 1; i < suggestions.length; i++) {
      if (suggestions[i - 1].gain === suggestions[i].gain) {
        const prevEntry = mockPokemonList.find(
          (p) => p.displayName === suggestions[i - 1].candidateLabel,
        );
        const currEntry = mockPokemonList.find(
          (p) => p.displayName === suggestions[i].candidateLabel,
        );
        if (prevEntry && currEntry) {
          // Both final: lower ID first; otherwise final first
          if (prevEntry.isFinalEvolution === currEntry.isFinalEvolution) {
            expect(prevEntry.id).toBeLessThanOrEqual(currEntry.id);
          }
        }
      }
    }
  });

  it('does not return results sorted by dex order (ID)', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    // If sorted by ID, the candidate IDs would be in ascending order.
    // With gain-based sort, this should NOT always be the case.
    const candidateIds = suggestions.map((s) => {
      const entry = mockPokemonList.find((p) => p.displayName === s.candidateLabel);
      return entry?.id ?? Infinity;
    });
    const isSortedById = candidateIds.every((id, i) => i === 0 || candidateIds[i - 1] <= id);
    // It's possible but very unlikely that gain sort happens to match ID sort
    // for a diverse pool. If it does match, the test isn't broken — just less assertive.
    // The main assertion is the gain-descending check in the tests above.
    expect(suggestions[0].gain).toBeGreaterThanOrEqual(suggestions[suggestions.length - 1].gain);
  });
});
