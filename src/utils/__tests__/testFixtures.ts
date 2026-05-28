import {
  MoveEntry,
  PokemonEntry,
  PokemonType,
  POKEMON_TYPES,
  Team,
  TeamMember,
  TypeChart,
} from '../../types';

/**
 * Hardcoded canonical Gen 6+ type chart.
 * Rows are attacker, columns are defender, values in {0, 0.5, 1, 2}.
 */
function buildTypeChart(): TypeChart {
  const chart = {} as TypeChart;
  for (const a of POKEMON_TYPES) {
    chart[a] = {} as Record<PokemonType, number>;
    for (const d of POKEMON_TYPES) chart[a][d] = 1;
  }
  const set = (a: PokemonType, d: PokemonType, v: number) => {
    chart[a][d] = v;
  };

  // Normal
  set('normal', 'rock', 0.5);
  set('normal', 'ghost', 0);
  set('normal', 'steel', 0.5);
  // Fire
  set('fire', 'fire', 0.5);
  set('fire', 'water', 0.5);
  set('fire', 'grass', 2);
  set('fire', 'ice', 2);
  set('fire', 'bug', 2);
  set('fire', 'rock', 0.5);
  set('fire', 'dragon', 0.5);
  set('fire', 'steel', 2);
  // Water
  set('water', 'fire', 2);
  set('water', 'water', 0.5);
  set('water', 'grass', 0.5);
  set('water', 'ground', 2);
  set('water', 'rock', 2);
  set('water', 'dragon', 0.5);
  // Electric
  set('electric', 'water', 2);
  set('electric', 'electric', 0.5);
  set('electric', 'grass', 0.5);
  set('electric', 'ground', 0);
  set('electric', 'flying', 2);
  set('electric', 'dragon', 0.5);
  // Grass
  set('grass', 'fire', 0.5);
  set('grass', 'water', 2);
  set('grass', 'grass', 0.5);
  set('grass', 'poison', 0.5);
  set('grass', 'ground', 2);
  set('grass', 'flying', 0.5);
  set('grass', 'bug', 0.5);
  set('grass', 'rock', 2);
  set('grass', 'dragon', 0.5);
  set('grass', 'steel', 0.5);
  // Ice
  set('ice', 'fire', 0.5);
  set('ice', 'water', 0.5);
  set('ice', 'grass', 2);
  set('ice', 'ice', 0.5);
  set('ice', 'ground', 2);
  set('ice', 'flying', 2);
  set('ice', 'dragon', 2);
  set('ice', 'steel', 0.5);
  // Fighting
  set('fighting', 'normal', 2);
  set('fighting', 'ice', 2);
  set('fighting', 'poison', 0.5);
  set('fighting', 'flying', 0.5);
  set('fighting', 'psychic', 0.5);
  set('fighting', 'bug', 0.5);
  set('fighting', 'rock', 2);
  set('fighting', 'ghost', 0);
  set('fighting', 'dark', 2);
  set('fighting', 'steel', 2);
  set('fighting', 'fairy', 0.5);
  // Poison
  set('poison', 'grass', 2);
  set('poison', 'poison', 0.5);
  set('poison', 'ground', 0.5);
  set('poison', 'rock', 0.5);
  set('poison', 'ghost', 0.5);
  set('poison', 'steel', 0);
  set('poison', 'fairy', 2);
  // Ground
  set('ground', 'fire', 2);
  set('ground', 'electric', 2);
  set('ground', 'grass', 0.5);
  set('ground', 'poison', 2);
  set('ground', 'flying', 0);
  set('ground', 'bug', 0.5);
  set('ground', 'rock', 2);
  set('ground', 'steel', 2);
  // Flying
  set('flying', 'electric', 0.5);
  set('flying', 'grass', 2);
  set('flying', 'fighting', 2);
  set('flying', 'bug', 2);
  set('flying', 'rock', 0.5);
  set('flying', 'steel', 0.5);
  // Psychic
  set('psychic', 'fighting', 2);
  set('psychic', 'poison', 2);
  set('psychic', 'psychic', 0.5);
  set('psychic', 'dark', 0);
  set('psychic', 'steel', 0.5);
  // Bug
  set('bug', 'fire', 0.5);
  set('bug', 'grass', 2);
  set('bug', 'fighting', 0.5);
  set('bug', 'poison', 0.5);
  set('bug', 'flying', 0.5);
  set('bug', 'psychic', 2);
  set('bug', 'ghost', 0.5);
  set('bug', 'dark', 2);
  set('bug', 'steel', 0.5);
  set('bug', 'fairy', 0.5);
  // Rock
  set('rock', 'fire', 2);
  set('rock', 'ice', 2);
  set('rock', 'fighting', 0.5);
  set('rock', 'ground', 0.5);
  set('rock', 'flying', 2);
  set('rock', 'bug', 2);
  set('rock', 'steel', 0.5);
  // Ghost
  set('ghost', 'normal', 0);
  set('ghost', 'psychic', 2);
  set('ghost', 'ghost', 2);
  set('ghost', 'dark', 0.5);
  // Dragon
  set('dragon', 'dragon', 2);
  set('dragon', 'steel', 0.5);
  set('dragon', 'fairy', 0);
  // Dark
  set('dark', 'fighting', 0.5);
  set('dark', 'psychic', 2);
  set('dark', 'ghost', 2);
  set('dark', 'dark', 0.5);
  set('dark', 'fairy', 0.5);
  // Steel
  set('steel', 'fire', 0.5);
  set('steel', 'water', 0.5);
  set('steel', 'electric', 0.5);
  set('steel', 'ice', 2);
  set('steel', 'rock', 2);
  set('steel', 'steel', 0.5);
  set('steel', 'fairy', 2);
  // Fairy
  set('fairy', 'fire', 0.5);
  set('fairy', 'fighting', 2);
  set('fairy', 'poison', 0.5);
  set('fairy', 'dragon', 2);
  set('fairy', 'dark', 2);
  set('fairy', 'steel', 0.5);
  return chart;
}

export const mockTypeChart: TypeChart = buildTypeChart();

/**
 * 10 Pokémon entries covering diverse types and special cases.
 *
 * Must include:
 *  - one pure Normal             (Snorlax)
 *  - one dual Water/Flying       (Gyarados)
 *  - one pure Ghost              (Gengar — Ghost/Poison? we use a pure variant for tests)
 *  - one Steel/Fairy             (Mawile)
 *  - one legendary               (Mewtwo)
 */
export const mockPokemonList: PokemonEntry[] = [
  {
    id: 143,
    name: 'snorlax',
    displayName: 'Snorlax',
    speciesName: 'snorlax',
    types: ['normal', null],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/143.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/143.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 130,
    name: 'gyarados',
    displayName: 'Gyarados',
    speciesName: 'gyarados',
    types: ['water', 'flying'],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/130.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/130.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/130.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 92,
    name: 'gastly',
    displayName: 'Gastly',
    speciesName: 'gastly',
    types: ['ghost', null],
    spriteHome: null,
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/92.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/92.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: false,
  },
  {
    id: 9301,
    name: 'spectraform',
    displayName: 'Spectraform',
    speciesName: 'spectraform',
    types: ['ghost', null],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/9301.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/9301.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9301.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 303,
    name: 'mawile',
    displayName: 'Mawile',
    speciesName: 'mawile',
    types: ['steel', 'fairy'],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/303.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/303.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/303.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 6,
    name: 'charizard',
    displayName: 'Charizard',
    speciesName: 'charizard',
    types: ['fire', 'flying'],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/6.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 25,
    name: 'pikachu',
    displayName: 'Pikachu',
    speciesName: 'pikachu',
    types: ['electric', null],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/25.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: false,
  },
  {
    id: 445,
    name: 'garchomp',
    displayName: 'Garchomp',
    speciesName: 'garchomp',
    types: ['dragon', 'ground'],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/445.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/445.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/445.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 700,
    name: 'sylveon',
    displayName: 'Sylveon',
    speciesName: 'sylveon',
    types: ['fairy', null],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/700.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/700.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/700.png',
    isLegendary: false,
    isMythical: false,
    isFinalEvolution: true,
  },
  {
    id: 150,
    name: 'mewtwo',
    displayName: 'Mewtwo',
    speciesName: 'mewtwo',
    types: ['psychic', null],
    spriteHome: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/150.png',
    spriteArtwork: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png',
    spriteDefault: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png',
    isLegendary: true,
    isMythical: false,
    isFinalEvolution: true,
  },
];

export const mockMoveList: MoveEntry[] = [
  { id: 1, name: 'tackle', displayName: 'Tackle', type: 'normal', power: 40, damageClass: 'physical' },
  { id: 2, name: 'thunderbolt', displayName: 'Thunderbolt', type: 'electric', power: 90, damageClass: 'special' },
  { id: 3, name: 'flamethrower', displayName: 'Flamethrower', type: 'fire', power: 90, damageClass: 'special' },
  { id: 4, name: 'surf', displayName: 'Surf', type: 'water', power: 90, damageClass: 'special' },
  { id: 5, name: 'earthquake', displayName: 'Earthquake', type: 'ground', power: 100, damageClass: 'physical' },
  { id: 6, name: 'ice-beam', displayName: 'Ice Beam', type: 'ice', power: 90, damageClass: 'special' },
  { id: 7, name: 'shadow-ball', displayName: 'Shadow Ball', type: 'ghost', power: 80, damageClass: 'special' },
  { id: 8, name: 'play-rough', displayName: 'Play Rough', type: 'fairy', power: 90, damageClass: 'physical' },
  { id: 9, name: 'dragon-claw', displayName: 'Dragon Claw', type: 'dragon', power: 80, damageClass: 'physical' },
  { id: 10, name: 'leech-seed', displayName: 'Leech Seed', type: 'grass', power: null, damageClass: 'status' },
];

function buildMember(
  speciesName: string,
  types: [PokemonType, PokemonType | null],
  moveTypes: PokemonType[] = [],
): TeamMember {
  const moves: TeamMember['moves'] = [null, null, null, null];
  moveTypes.slice(0, 4).forEach((mt, i) => {
    moves[i] = {
      id: `mv-${speciesName}-${i}`,
      name: `${mt}-move`,
      type: mt,
      power: 80,
      damageClass: 'special',
      isCustom: false,
    };
  });
  return {
    id: `member-${speciesName}`,
    speciesName,
    spriteUrl: null,
    types,
    moves,
    isCustomSaved: false,
  };
}

export { buildMember };

export const mockTeam: Team = {
  id: 'team-mock',
  name: 'Mock Team',
  createdAt: 0,
  members: [
    buildMember('Charizard', ['fire', 'flying']),
    buildMember('Gyarados', ['water', 'flying']),
    buildMember('Mawile', ['steel', 'fairy']),
    buildMember('Garchomp', ['dragon', 'ground']),
    buildMember('Snorlax', ['normal', null]),
    buildMember('Sylveon', ['fairy', null]),
  ],
};

export const mockPartialTeam: Team = {
  id: 'team-partial',
  name: 'Partial Team',
  createdAt: 0,
  members: [
    buildMember('Charizard', ['fire', 'flying']),
    buildMember('Gyarados', ['water', 'flying']),
    null,
    null,
    null,
    null,
  ],
};

export const emptyTeam: Team = {
  id: 'team-empty',
  name: 'Empty Team',
  createdAt: 0,
  members: [null, null, null, null, null, null],
};
