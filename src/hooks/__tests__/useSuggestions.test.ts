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
    // Use a small pool so the custom isn't squeezed out of the top-5 ranking.
    const tinyPool = mockPokemonList.slice(0, 2);
    const team: TeamMember[] = [buildMember('Pikachu', ['electric', null])];
    const customs: TeamMember[] = [
      buildMember('MyCustomMon', ['ice', 'dragon']),
    ];
    const without = computeSuggestions(mockTypeChart, team, tinyPool, customs, {
      includeCustoms: false,
    });
    const withCustoms = computeSuggestions(
      mockTypeChart,
      team,
      tinyPool,
      customs,
      { includeCustoms: true },
    );
    expect(without.map((s) => s.candidateLabel)).not.toContain('MyCustomMon');
    expect(withCustoms.map((s) => s.candidateLabel)).toContain('MyCustomMon');
  });

  it('legendary inclusion: legendary appears in candidates by default', () => {
    // Scenario: team covers Fighting/Dark/etc but nothing else, leaving
    // Psychic-style targets (Fighting, Poison) uncovered. Use a pool that
    // forces Mewtwo to be top-ranked by restricting the candidate set.
    const pool = [
      mockPokemonList.find((p) => p.name === 'mewtwo')!,
      mockPokemonList.find((p) => p.name === 'snorlax')!,
    ];
    const team: TeamMember[] = [buildMember('Slot', ['normal', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, pool, [], {
      includeCustoms: false,
    });
    const names = suggestions.map((s) => s.candidateLabel);
    expect(names).toContain('Mewtwo');
  });

  it('mythical inclusion: mythical Pokémon are also included unconditionally', () => {
    const mythical = {
      id: 151,
      name: 'mew',
      displayName: 'Mew',
      speciesName: 'mew',
      types: ['psychic', null] as ['psychic', null],
      spriteHome: null,
      spriteArtwork: null,
      spriteDefault: null,
      isLegendary: false,
      isMythical: true,
      isFinalEvolution: true,
    };
    const pool = [mythical, mockPokemonList.find((p) => p.name === 'snorlax')!];
    const team: TeamMember[] = [buildMember('Slot', ['normal', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, pool, [], {
      includeCustoms: false,
    });
    const names = suggestions.map((s) => s.candidateLabel);
    expect(names).toContain('Mew');
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

describe('suggestionEngine — branched evolutions', () => {
  // Mock a tiny pool with one base species and two final-evolution branches
  // of different types.
  const branchedPool = [
    {
      id: 9001,
      name: 'splitbase',
      displayName: 'SplitBase',
      speciesName: 'splitbase',
      types: ['normal', null] as ['normal', null],
      spriteHome: null,
      spriteArtwork: null,
      spriteDefault: null,
      isLegendary: false,
      isMythical: false,
      isFinalEvolution: false,
    },
    {
      id: 9002,
      name: 'splitfinal-water',
      displayName: 'SplitFinal-Water',
      speciesName: 'splitfinal-water',
      types: ['water', null] as ['water', null],
      spriteHome: null,
      spriteArtwork: null,
      spriteDefault: null,
      isLegendary: false,
      isMythical: false,
      isFinalEvolution: true,
    },
    {
      id: 9003,
      name: 'splitfinal-electric',
      displayName: 'SplitFinal-Electric',
      speciesName: 'splitfinal-electric',
      types: ['electric', null] as ['electric', null],
      spriteHome: null,
      spriteArtwork: null,
      spriteDefault: null,
      isLegendary: false,
      isMythical: false,
      isFinalEvolution: true,
    },
  ];

  it('both final-evolution branches appear as separate candidates', () => {
    const team: TeamMember[] = [buildMember('Snorlax', ['normal', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, branchedPool, [], {
      includeCustoms: false,
    });
    const names = suggestions.map((s) => s.candidateLabel);
    expect(names).toContain('SplitFinal-Water');
    expect(names).toContain('SplitFinal-Electric');
    // Mid-evolution must not appear.
    expect(names).not.toContain('SplitBase');
  });

  it('when Water is already covered, Electric branch ranks higher but Water still appears if it offers any gain', () => {
    // Member offers Water-typical coverage via Water/Ground types (water covers fire/ground/rock).
    const team: TeamMember[] = [buildMember('AquaBeast', ['water', 'ground'])];
    const suggestions = computeSuggestions(mockTypeChart, team, branchedPool, [], {
      includeCustoms: false,
    });
    const idxElectric = suggestions.findIndex(
      (s) => s.candidateLabel === 'SplitFinal-Electric',
    );
    const idxWater = suggestions.findIndex(
      (s) => s.candidateLabel === 'SplitFinal-Water',
    );
    expect(idxElectric).toBeGreaterThanOrEqual(0);
    // Electric branch must rank ahead of (or equal to in case of tie-breaking)
    // the Water branch — but per the brief Electric ranks higher strictly.
    if (idxWater >= 0) {
      expect(idxElectric).toBeLessThan(idxWater);
    }
  });
});

describe('suggestionEngine — alternate forms', () => {
  const formsPool = [
    {
      id: 7001,
      name: 'rotom',
      displayName: 'Rotom',
      speciesName: 'rotom',
      types: ['electric', 'ghost'] as ['electric', 'ghost'],
      spriteHome: null,
      spriteArtwork: null,
      spriteDefault: null,
      isLegendary: false,
      isMythical: false,
      isFinalEvolution: true,
    },
    {
      id: 7002,
      name: 'rotom-heat',
      displayName: 'Rotom-Heat',
      speciesName: 'rotom',
      types: ['electric', 'fire'] as ['electric', 'fire'],
      spriteHome: null,
      spriteArtwork: null,
      spriteDefault: null,
      isLegendary: false,
      isMythical: false,
      isFinalEvolution: true,
    },
  ];

  it('alternate forms are treated as distinct candidates and never deduplicated against each other', () => {
    const team: TeamMember[] = [buildMember('Snorlax', ['normal', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, formsPool, [], {
      includeCustoms: false,
    });
    const names = suggestions.map((s) => s.candidateLabel);
    expect(names).toContain('Rotom');
    expect(names).toContain('Rotom-Heat');
  });

  it('suggestion display name includes the full form name (e.g. Rotom-Heat)', () => {
    const team: TeamMember[] = [buildMember('Snorlax', ['normal', null])];
    const suggestions = computeSuggestions(mockTypeChart, team, formsPool, [], {
      includeCustoms: false,
    });
    const heat = suggestions.find((s) => s.candidateLabel === 'Rotom-Heat');
    expect(heat).toBeDefined();
    expect(heat!.candidateLabel).toBe('Rotom-Heat');
    // Must not be collapsed to the bare species name.
    expect(heat!.candidateLabel).not.toBe('Rotom');
  });
});

describe('suggestionEngine — custom Pokémon evaluated by types only', () => {
  it('custom Pokémon with Dragon/Steel types appears, gain computed from types not from moves', () => {
    // Team missing Dragon and Steel coverage entirely.
    const team: TeamMember[] = [buildMember('Snorlax', ['normal', null])];
    const custom: TeamMember = buildMember('MyDragoSteel', ['dragon', 'steel']);
    custom.moves = [
      {
        id: 'm1',
        name: 'flamethrower',
        type: 'fire',
        power: 90,
        damageClass: 'special',
        isCustom: false,
      },
      {
        id: 'm2',
        name: 'ice-beam',
        type: 'ice',
        power: 90,
        damageClass: 'special',
        isCustom: false,
      },
      null,
      null,
    ];
    const suggestions = computeSuggestions(
      mockTypeChart,
      team,
      mockPokemonList,
      [custom],
      { includeCustoms: true },
    );
    const found = suggestions.find((s) => s.candidateLabel === 'MyDragoSteel');
    expect(found).toBeDefined();
    // Newly covered types must come from Dragon/Steel evaluation only.
    // Dragon covers: dragon. Steel covers: ice, rock, fairy.
    // Fire/Ice (the move types) would have additionally covered: grass, bug,
    // steel, dragon, etc. — but those must not appear unless the type-based
    // calculation produced them.
    const newly = new Set(found!.newlyCovered);
    // Steel→ice and Steel→fairy are present (Snorlax covers neither).
    expect(newly.has('ice')).toBe(true);
    expect(newly.has('fairy')).toBe(true);
    // grass is only covered by Fire (move) or Ice (move); types Dragon/Steel
    // do not cover grass 2x → must NOT appear.
    expect(newly.has('grass')).toBe(false);
  });
});
