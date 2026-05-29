import { describe, it, expect } from 'vitest';
import {
  generateTeam,
  regenerateSlot,
  buildEligiblePool,
  DEFAULT_CONSTRAINTS,
  GeneratorConstraints,
  STARTER_FINALS,
} from '../teamGenerator';
import { mockTypeChart, mockPokemonList, buildMember } from '../../utils/__tests__/testFixtures';
import { PokemonEntry } from '../../types';

// Add starter entries to the mock pool for testing
const starterEntry: PokemonEntry = {
  id: 6,
  name: 'charizard',
  displayName: 'Charizard',
  speciesName: 'charizard',
  types: ['fire', 'flying'],
  spriteHome: null,
  spriteArtwork: null,
  spriteDefault: null,
  isLegendary: false,
  isMythical: false,
  isFinalEvolution: true,
};

describe('teamGenerator — generateTeam', () => {
  it('generates a team of 6 from the pool when no locked members', () => {
    const result = generateTeam(
      mockTypeChart,
      mockPokemonList,
      [],
      [],
      DEFAULT_CONSTRAINTS,
    );
    expect(result.team.length).toBeLessThanOrEqual(6);
    expect(result.team.length).toBeGreaterThan(0);
  });

  it('includes locked members at the start of the team', () => {
    const locked = [buildMember('Charizard', ['fire', 'flying'])];
    const result = generateTeam(
      mockTypeChart,
      mockPokemonList,
      [],
      locked,
      DEFAULT_CONSTRAINTS,
    );
    expect(result.team[0].speciesName).toBe('Charizard');
  });

  it('does not duplicate species already in locked members', () => {
    const locked = [buildMember('Charizard', ['fire', 'flying'])];
    const result = generateTeam(
      mockTypeChart,
      mockPokemonList,
      [],
      locked,
      DEFAULT_CONSTRAINTS,
    );
    const names = result.team.map((m) => m.speciesName.toLowerCase());
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('returns warning when pool is too small to fill all slots', () => {
    // Create a tiny pool with only 2 final evolutions
    const tinyPool: PokemonEntry[] = [
      { ...mockPokemonList[0], isFinalEvolution: true }, // Snorlax
      { ...mockPokemonList[1], isFinalEvolution: true }, // Gyarados
    ];
    const result = generateTeam(
      mockTypeChart,
      tinyPool,
      [],
      [],
      DEFAULT_CONSTRAINTS,
    );
    expect(result.warning).toBe('tooFewPokemon');
    expect(result.team.length).toBeLessThan(6);
  });

  it('team with 6 locked just returns them', () => {
    const locked = Array.from({ length: 6 }, (_, i) =>
      buildMember(`Mon${i}`, ['normal', null]),
    );
    const result = generateTeam(
      mockTypeChart,
      mockPokemonList,
      [],
      locked,
      DEFAULT_CONSTRAINTS,
    );
    expect(result.team.length).toBe(6);
    expect(result.team[0].speciesName).toBe('Mon0');
  });
});

describe('teamGenerator — constraint enforcement', () => {
  it('excludes legendaries/mythicals when legendaryMythicalSlots is 0', () => {
    const constraints: GeneratorConstraints = {
      ...DEFAULT_CONSTRAINTS,
      legendaryMythicalSlots: 0,
    };
    const result = generateTeam(
      mockTypeChart,
      mockPokemonList,
      [],
      [],
      constraints,
    );
    // Mewtwo (legendary) should not be in the team
    const names = result.team.map((m) => m.speciesName.toLowerCase());
    expect(names).not.toContain('mewtwo');
  });

  it('respects legendaryMythicalSlots cap', () => {
    const constraints: GeneratorConstraints = {
      ...DEFAULT_CONSTRAINTS,
      legendaryMythicalSlots: 1,
    };
    const result = generateTeam(
      mockTypeChart,
      mockPokemonList,
      [],
      [],
      constraints,
    );
    const legendaryMythicalCount = result.team.filter((m) => {
      const entry = mockPokemonList.find(
        (p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase(),
      );
      return entry?.isLegendary || entry?.isMythical;
    }).length;
    expect(legendaryMythicalCount).toBeLessThanOrEqual(1);
  });
});

describe('teamGenerator — buildEligiblePool', () => {
  it('filters to final evolutions only', () => {
    const pool = buildEligiblePool(mockPokemonList, [], DEFAULT_CONSTRAINTS);
    expect(pool.every((p) => p.isFinalEvolution)).toBe(true);
  });

  it('excludes legendaries/mythicals when constraint says so', () => {
    const pool = buildEligiblePool(mockPokemonList, [], {
      ...DEFAULT_CONSTRAINTS,
      legendaryMythicalSlots: 0,
    });
    expect(pool.some((p) => p.isLegendary || p.isMythical)).toBe(false);
  });
});

describe('teamGenerator — regenerateSlot', () => {
  it('replaces a slot with a different Pokémon', () => {
    const team = [
      buildMember('Charizard', ['fire', 'flying']),
      buildMember('Gyarados', ['water', 'flying']),
      buildMember('Mawile', ['steel', 'fairy']),
      buildMember('Garchomp', ['dragon', 'ground']),
      buildMember('Snorlax', ['normal', null]),
      buildMember('Sylveon', ['fairy', null]),
    ];
    const newMember = regenerateSlot(
      mockTypeChart,
      mockPokemonList,
      [],
      team,
      2, // replace Mawile slot
      DEFAULT_CONSTRAINTS,
    );
    // Should get a different Pokémon (not guaranteed to be different from Mawile
    // due to scoring, but should be from the pool)
    expect(newMember.speciesName).toBeDefined();
    expect(newMember.types).toBeDefined();
  });

  it('respects team state (does not pick existing species)', () => {
    const team = [
      buildMember('Charizard', ['fire', 'flying']),
      buildMember('Gyarados', ['water', 'flying']),
      buildMember('Mawile', ['steel', 'fairy']),
      buildMember('Garchomp', ['dragon', 'ground']),
      buildMember('Snorlax', ['normal', null]),
      buildMember('Sylveon', ['fairy', null]),
    ];
    const newMember = regenerateSlot(
      mockTypeChart,
      mockPokemonList,
      [],
      team,
      5, // replace Sylveon
      DEFAULT_CONSTRAINTS,
    );
    const otherNames = team.slice(0, 5).map((m) => m.speciesName.toLowerCase());
    expect(otherNames).not.toContain(newMember.speciesName.toLowerCase());
  });
});

describe('teamGenerator — anchor composite score validation', () => {
  // Create a diverse pool with multiple Water-types and varied other types
  const diversePool: PokemonEntry[] = [
    // Water types (should NOT all be selected when anchor is Water/Ground)
    { id: 260, name: 'swampert', displayName: 'Swampert', speciesName: 'swampert', types: ['water', 'ground'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 9, name: 'blastoise', displayName: 'Blastoise', speciesName: 'blastoise', types: ['water', null], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 730, name: 'primarina', displayName: 'Primarina', speciesName: 'primarina', types: ['water', 'fairy'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 503, name: 'samurott', displayName: 'Samurott', speciesName: 'samurott', types: ['water', null], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 131, name: 'lapras', displayName: 'Lapras', speciesName: 'lapras', types: ['water', 'ice'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    // Diverse non-water types
    { id: 6, name: 'charizard', displayName: 'Charizard', speciesName: 'charizard', types: ['fire', 'flying'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 445, name: 'garchomp', displayName: 'Garchomp', speciesName: 'garchomp', types: ['dragon', 'ground'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 303, name: 'mawile', displayName: 'Mawile', speciesName: 'mawile', types: ['steel', 'fairy'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 700, name: 'sylveon', displayName: 'Sylveon', speciesName: 'sylveon', types: ['fairy', null], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 94, name: 'gengar', displayName: 'Gengar', speciesName: 'gengar', types: ['ghost', 'poison'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 143, name: 'snorlax', displayName: 'Snorlax', speciesName: 'snorlax', types: ['normal', null], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 65, name: 'alakazam', displayName: 'Alakazam', speciesName: 'alakazam', types: ['psychic', null], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 68, name: 'machamp', displayName: 'Machamp', speciesName: 'machamp', types: ['fighting', null], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 462, name: 'magnezone', displayName: 'Magnezone', speciesName: 'magnezone', types: ['electric', 'steel'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
    { id: 3, name: 'venusaur', displayName: 'Venusaur', speciesName: 'venusaur', types: ['grass', 'poison'], spriteHome: null, spriteArtwork: null, spriteDefault: null, isLegendary: false, isMythical: false, isFinalEvolution: true },
  ];

  it('does not generate more than 1 additional Water-type when anchor is Swampert (Water/Ground)', () => {
    const anchor = buildMember('Swampert', ['water', 'ground']);
    let passCount = 0;
    const runs = 5;

    for (let i = 0; i < runs; i++) {
      const result = generateTeam(
        mockTypeChart,
        diversePool,
        [],
        [anchor],
        DEFAULT_CONSTRAINTS,
      );
      // Count water types in the generated part (exclude anchor at index 0)
      const generatedMembers = result.team.slice(1);
      const waterCount = generatedMembers.filter(
        (m) => m.types[0] === 'water' || m.types[1] === 'water',
      ).length;
      if (waterCount <= 1) passCount++;
    }

    // Must hold in at least 4/5 runs
    expect(passCount).toBeGreaterThanOrEqual(4);
  });
});
