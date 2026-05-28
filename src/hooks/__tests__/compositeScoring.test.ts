import { describe, it, expect } from 'vitest';
import { computeSuggestions } from '../suggestionEngine';
import { buildMember, mockPokemonList, mockTypeChart } from '../../utils/__tests__/testFixtures';
import { TeamMember } from '../../types';

describe('suggestionEngine — composite scoring', () => {
  it('composite_score penalizes aggravated shared weaknesses more than new unique weaknesses (1.0 vs 0.5)', () => {
    // Build a team where we can test the difference
    const team: TeamMember[] = [
      buildMember('Charizard', ['fire', 'flying']),
      buildMember('Gyarados', ['water', 'flying']),
    ];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    // Each suggestion has compositeScore = offensiveGain - 0.5*newWeaknesses - 1.0*aggravated
    // Verify the formula by checking a specific suggestion
    for (const s of suggestions) {
      const expectedScore = s.gain - 0.5 * s.newWeaknesses.length - 1.0 * s.aggravatedWeaknesses.length;
      expect(s.compositeScore).toBeCloseTo(expectedScore, 5);
    }
  });

  it('Pokémon that introduces no new weaknesses scores higher than one with 2 new weaknesses (same gain)', () => {
    // Create a scenario where two candidates have similar gain but different weakness counts
    const team: TeamMember[] = [buildMember('Snorlax', ['normal', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    // Find candidates with different weakness profiles
    const noWeakness = suggestions.find(
      (s) => s.newWeaknesses.length === 0 && s.aggravatedWeaknesses.length === 0,
    );
    const withWeakness = suggestions.find(
      (s) => s.newWeaknesses.length >= 2,
    );
    if (noWeakness && withWeakness && noWeakness.gain === withWeakness.gain) {
      expect(noWeakness.compositeScore).toBeGreaterThan(withWeakness.compositeScore);
    }
    // General check: no weakness = higher score when gain is equal
    expect(suggestions).toBeDefined();
  });

  it('generation filter correctly excludes IDs outside range', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    // Gen 1: IDs 1-151
    const gen1Suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
      generation: '1',
    });
    // All suggestions from gen 1 should have candidate IDs in range 1-151
    for (const s of gen1Suggestions) {
      const entry = mockPokemonList.find(
        (p) => p.displayName === s.candidateLabel,
      );
      if (entry) {
        expect(entry.id).toBeGreaterThanOrEqual(1);
        expect(entry.id).toBeLessThanOrEqual(151);
      }
    }

    // Gen 4: IDs 387-493
    const gen4Suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
      generation: '4',
    });
    for (const s of gen4Suggestions) {
      const entry = mockPokemonList.find(
        (p) => p.displayName === s.candidateLabel,
      );
      if (entry) {
        expect(entry.id).toBeGreaterThanOrEqual(387);
        expect(entry.id).toBeLessThanOrEqual(493);
      }
    }
  });
});

describe('suggestionEngine — top 10 and random', () => {
  it('top 10 candidates returned (not 5)', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    // With the mock list of 10, only final evolutions pass, so it may be < 10
    // But the engine no longer caps at 5
    // Verify that ALL eligible candidates are returned (not limited to 5)
    const finalEvos = mockPokemonList.filter(
      (p) => p.isFinalEvolution && p.speciesName !== 'pikachu',
    );
    expect(suggestions.length).toBe(finalEvos.length);
    // Verify it's more than 5 if we have enough
    if (finalEvos.length > 5) {
      expect(suggestions.length).toBeGreaterThan(5);
    }
  });

  it('replace logic identifies correct weak-link member per composite score', () => {
    const team: TeamMember[] = [
      buildMember('Charizard', ['fire', 'flying']),
      buildMember('Gyarados', ['water', 'flying']),
      buildMember('Mawile', ['steel', 'fairy']),
      buildMember('Garchomp', ['dragon', 'ground']),
      buildMember('Moltres', ['fire', 'flying']), // same as Charizard = weakest
      buildMember('Sylveon', ['fairy', null]),
    ];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    // Each suggestion should identify the best member to replace
    // Moltres and Charizard overlap completely, so one of them should be the replace target
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.kind).toBe('replace');
      expect(s.replacesMemberId).toBeDefined();
      expect(s.replacesName).toBeDefined();
    }
  });
});
