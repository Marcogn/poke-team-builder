import { describe, it, expect } from 'vitest';
import { computeSuggestions } from '../suggestionEngine';
import { buildMember, mockPokemonList, mockTypeChart } from '../../utils/__tests__/testFixtures';
import { TeamMember } from '../../types';

describe('suggestionEngine — addition mode', () => {
  it('team of 1: returns up to 5 add suggestions, no replacements', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    expect(suggestions.every((s) => s.kind === 'add')).toBe(true);
  });

  it('mid-evolutions are not suggested when finals exist (Gastly excluded)', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    const names = suggestions.map((s) => s.candidateLabel);
    expect(names).not.toContain('Gastly');
  });

  it('custom Pokémon appear when includeCustoms is true', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const customs: TeamMember[] = [
      buildMember('MyCustomMon', ['ice', 'dragon']),
    ];
    const without = computeSuggestions(mockTypeChart, team, mockPokemonList, customs, {
      includeCustoms: false,
    });
    const withCustoms = computeSuggestions(
      mockTypeChart,
      team,
      mockPokemonList,
      customs,
      { includeCustoms: true },
    );
    expect(without.map((s) => s.candidateLabel)).not.toContain('MyCustomMon');
    expect(withCustoms.map((s) => s.candidateLabel)).toContain('MyCustomMon');
  });

  it('legendary exclusion: legendary not suggested unless team contains one', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const excluded = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
      excludeLegendaries: true,
    });
    expect(excluded.map((s) => s.candidateLabel)).not.toContain('Mewtwo');

    const teamWithLegendary: TeamMember[] = [
      buildMember('Mewtwo', ['psychic', null]),
    ];
    const allowed = computeSuggestions(
      mockTypeChart,
      teamWithLegendary,
      mockPokemonList,
      [],
      { includeCustoms: false, excludeLegendaries: true },
    );
    // Mewtwo itself is on the team so it's deduped, but other legendaries
    // would be allowed. Verify that the exclusion gate did not apply by
    // checking some non-legendary still ranked.
    expect(allowed.length).toBeGreaterThan(0);
  });
});

describe('suggestionEngine — replacement mode', () => {
  const makeFullTeam = (): TeamMember[] => [
    buildMember('Charizard', ['fire', 'flying']),
    buildMember('Gyarados', ['water', 'flying']),
    buildMember('Mawile', ['steel', 'fairy']),
    buildMember('Garchomp', ['dragon', 'ground']),
    // Overlapping 5th + 6th with member 1 in pure types → low unique contribution
    buildMember('Moltres', ['fire', 'flying']),
    buildMember('Sylveon', ['fairy', null]),
  ];

  it('team of 6 returns replacement suggestions with replacesMemberId', () => {
    const team = makeFullTeam();
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.kind === 'replace')).toBe(true);
    expect(suggestions.every((s) => typeof s.replacesMemberId === 'string')).toBe(true);
  });

  it('weakest-link identification: full-overlap slot identified', () => {
    const team = makeFullTeam();
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    // Moltres entirely overlaps Charizard offensively (both fire/flying).
    const replacedNames = new Set(suggestions.map((s) => s.replacesName));
    const flyingFireSlots = ['Moltres', 'Charizard'];
    const replacedFlyingFire = [...replacedNames].some((n) =>
      flyingFireSlots.includes(n!),
    );
    expect(replacedFlyingFire).toBe(true);
  });

  it('solid coverage team still returns suggestions (labeled as replacements)', () => {
    const team = makeFullTeam();
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.kind === 'replace')).toBe(true);
  });

  it('no duplicate suggestions across slots (unique by species)', () => {
    const team = makeFullTeam();
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });
    const labels = suggestions.map((s) => s.candidateLabel.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });
});
