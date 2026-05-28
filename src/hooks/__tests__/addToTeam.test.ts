import { describe, it, expect } from 'vitest';
import { computeSuggestions, Suggestion } from '../suggestionEngine';
import { buildMember, mockPokemonList, mockTypeChart } from '../../utils/__tests__/testFixtures';
import { PokemonEntry, TeamMember } from '../../types';

describe('Add to team handler logic', () => {
  it('add mode: suggestion produces a valid TeamMember-like object for slot insertion', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });

    const addSuggestion = suggestions.find((s) => s.kind === 'add')!;
    expect(addSuggestion).toBeDefined();
    expect(addSuggestion.candidateLabel).toBeTruthy();
    expect(addSuggestion.types[0]).toBeTruthy();

    // Simulate what the handler does
    const teamMembers: (TeamMember | null)[] = [team[0], null, null, null, null, null];
    const emptyIdx = teamMembers.findIndex((m) => m === null);
    expect(emptyIdx).toBe(1);

    const newMember: TeamMember = {
      id: 'test-id',
      speciesName: addSuggestion.candidateLabel,
      spriteUrl: addSuggestion.spriteUrl,
      types: addSuggestion.types,
      moves: [null, null, null, null],
      isCustomSaved: false,
    };
    teamMembers[emptyIdx] = newMember;

    expect(teamMembers[1]).not.toBeNull();
    expect(teamMembers[1]!.speciesName).toBe(addSuggestion.candidateLabel);
    expect(teamMembers[1]!.types).toEqual(addSuggestion.types);
    expect(teamMembers[1]!.moves).toEqual([null, null, null, null]);
    expect(teamMembers[1]!.isCustomSaved).toBe(false);
  });

  it('replace mode: suggestion identifies correct weakest-link slot for replacement', () => {
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

    const replaceSuggestion = suggestions.find((s) => s.kind === 'replace')!;
    expect(replaceSuggestion).toBeDefined();
    expect(replaceSuggestion.replacesMemberId).toBeTruthy();
    expect(replaceSuggestion.replacesName).toBeTruthy();

    // Simulate replacement
    const teamMembers = [...team];
    const replaceIdx = teamMembers.findIndex(
      (m) => m.id === replaceSuggestion.replacesMemberId,
    );
    expect(replaceIdx).toBeGreaterThanOrEqual(0);

    const newMember: TeamMember = {
      id: 'test-replace-id',
      speciesName: replaceSuggestion.candidateLabel,
      spriteUrl: replaceSuggestion.spriteUrl,
      types: replaceSuggestion.types,
      moves: [null, null, null, null],
      isCustomSaved: false,
    };
    teamMembers[replaceIdx] = newMember;

    expect(teamMembers[replaceIdx].speciesName).toBe(replaceSuggestion.candidateLabel);
    expect(teamMembers[replaceIdx].id).toBe('test-replace-id');
  });
});

describe('Random mode filtering', () => {
  it('filtered pool returns correct number of suggestions (up to 5)', () => {
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const allSuggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });

    // Simulate random pick from filtered pool
    const filtered = allSuggestions.filter((s) => s.gain > 0);
    const picks: Suggestion[] = [];
    const source = [...filtered];
    const count = Math.min(5, source.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * source.length);
      picks.push(source[idx]);
      source.splice(idx, 1);
    }

    expect(picks.length).toBeLessThanOrEqual(5);
    expect(picks.length).toBeGreaterThan(0);
    // All picks should be from the filtered pool
    picks.forEach((p) => {
      expect(allSuggestions.map((s) => s.candidateLabel)).toContain(p.candidateLabel);
    });
  });

  it('random mode fills with gain=0 candidates when fewer than 5 have gain > 0', () => {
    // Build a team that covers almost everything so few candidates have gain > 0
    const team: TeamMember[] = [
      buildMember('A', ['fire', 'flying']),
      buildMember('B', ['water', 'ground']),
      buildMember('C', ['electric', 'ice']),
      buildMember('D', ['fighting', 'dark']),
      buildMember('E', ['psychic', 'ghost']),
    ];
    const allSuggestions = computeSuggestions(mockTypeChart, team, mockPokemonList, [], {
      includeCustoms: false,
    });

    const withGain = allSuggestions.filter((s) => s.gain > 0);
    const noGain = allSuggestions.filter((s) => s.gain <= 0);

    // Simulate picking: first from gain > 0, then from gain = 0
    const picks: Suggestion[] = [];
    const src1 = [...withGain];
    while (picks.length < 5 && src1.length > 0) {
      picks.push(src1.splice(0, 1)[0]);
    }
    const src2 = [...noGain];
    while (picks.length < 5 && src2.length > 0) {
      picks.push(src2.splice(0, 1)[0]);
    }

    expect(picks.length).toBeLessThanOrEqual(5);
    // The picks should be a mix if withGain < 5
    if (withGain.length < 5 && noGain.length > 0) {
      expect(picks.some((p) => p.gain <= 0)).toBe(true);
    }
  });
});
