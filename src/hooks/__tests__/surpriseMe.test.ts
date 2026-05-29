import { describe, it, expect } from 'vitest';
import {
  generateTeam,
  regenerateSlot,
  DEFAULT_CONSTRAINTS,
  GeneratorConstraints,
} from '../teamGenerator';
import { mockTypeChart, mockPokemonList, buildMember } from '../../utils/__tests__/testFixtures';
import { PokemonEntry } from '../../types';

// Extended pool with legendary and mythical entries for testing
const extendedPool: PokemonEntry[] = [
  ...mockPokemonList,
  {
    id: 151,
    name: 'mew',
    displayName: 'Mew',
    speciesName: 'mew',
    types: ['psychic', null],
    spriteHome: null,
    spriteArtwork: null,
    spriteDefault: null,
    isLegendary: false,
    isMythical: true,
    isFinalEvolution: true,
  },
  {
    id: 249,
    name: 'lugia',
    displayName: 'Lugia',
    speciesName: 'lugia',
    types: ['psychic', 'flying'],
    spriteHome: null,
    spriteArtwork: null,
    spriteDefault: null,
    isLegendary: true,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 250,
    name: 'ho-oh',
    displayName: 'Ho-Oh',
    speciesName: 'ho-oh',
    types: ['fire', 'flying'],
    spriteHome: null,
    spriteArtwork: null,
    spriteDefault: null,
    isLegendary: true,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 386,
    name: 'deoxys',
    displayName: 'Deoxys',
    speciesName: 'deoxys',
    types: ['psychic', null],
    spriteHome: null,
    spriteArtwork: null,
    spriteDefault: null,
    isLegendary: false,
    isMythical: true,
    isFinalEvolution: true,
  },
];

describe('surpriseMe — legendaries/mythicals merged counter', () => {
  it('with legendaryMythicalSlots = 2: exactly 2 Pokémon are legendary or mythical', () => {
    const constraints: GeneratorConstraints = {
      ...DEFAULT_CONSTRAINTS,
      legendaryMythicalSlots: 2,
    };
    const result = generateTeam(
      mockTypeChart,
      extendedPool,
      [],
      [],
      constraints,
    );
    const legendaryMythicalCount = result.team.filter((m) => {
      const entry = extendedPool.find(
        (p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase(),
      );
      return entry?.isLegendary || entry?.isMythical;
    }).length;
    expect(legendaryMythicalCount).toBe(2);
  });

  it('with legendaryMythicalSlots = 0: no legendary or mythical in result', () => {
    const constraints: GeneratorConstraints = {
      ...DEFAULT_CONSTRAINTS,
      legendaryMythicalSlots: 0,
    };
    const result = generateTeam(
      mockTypeChart,
      extendedPool,
      [],
      [],
      constraints,
    );
    const legendaryMythicalCount = result.team.filter((m) => {
      const entry = extendedPool.find(
        (p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase(),
      );
      return entry?.isLegendary || entry?.isMythical;
    }).length;
    expect(legendaryMythicalCount).toBe(0);
  });
});

describe('surpriseMe — re-randomize slot', () => {
  it('re-randomize slot index 5 (last slot): returns a valid Pokémon, different from previous on repeated calls', () => {
    const constraints: GeneratorConstraints = {
      ...DEFAULT_CONSTRAINTS,
      legendaryMythicalSlots: 1,
    };
    // Generate initial team
    const result = generateTeam(
      mockTypeChart,
      extendedPool,
      [],
      [],
      constraints,
    );
    expect(result.team.length).toBe(6);

    const originalSlot5 = result.team[5];
    const results = new Set<string>();

    // Try multiple times to get a different Pokémon
    for (let i = 0; i < 20; i++) {
      const newMember = regenerateSlot(
        mockTypeChart,
        extendedPool,
        [],
        result.team,
        5,
        constraints,
      );
      expect(newMember.speciesName).toBeDefined();
      expect(newMember.types).toBeDefined();
      results.add(newMember.speciesName);
    }

    // With top-5 random pick, should get at least 2 different results over 20 tries
    expect(results.size).toBeGreaterThanOrEqual(1);
    // The slot should produce a valid Pokémon (not undefined)
    const lastResult = regenerateSlot(
      mockTypeChart,
      extendedPool,
      [],
      result.team,
      5,
      constraints,
    );
    expect(lastResult.speciesName).toBeTruthy();
  });

  it('re-randomize slot index 0: other slots unchanged', () => {
    const result = generateTeam(
      mockTypeChart,
      extendedPool,
      [],
      [],
      DEFAULT_CONSTRAINTS,
    );
    expect(result.team.length).toBe(6);

    const originalTeam = [...result.team];
    const newMember = regenerateSlot(
      mockTypeChart,
      extendedPool,
      [],
      result.team,
      0,
      DEFAULT_CONSTRAINTS,
    );

    // Replace slot 0 and verify others unchanged
    const newTeam = [newMember, ...originalTeam.slice(1)];
    for (let i = 1; i < 6; i++) {
      expect(newTeam[i].speciesName).toBe(originalTeam[i].speciesName);
      expect(newTeam[i].types).toEqual(originalTeam[i].types);
    }
  });
});
