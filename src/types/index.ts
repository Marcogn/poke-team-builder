export const POKEMON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export type DamageClass = 'physical' | 'special' | 'status';

export interface PokemonMove {
  id: string;
  name: string;
  type: PokemonType;
  power: number | null;
  damageClass: DamageClass;
  isCustom: boolean;
}

export interface TeamMember {
  id: string;
  speciesName: string;
  spriteUrl: string | null;
  types: [PokemonType, PokemonType | null];
  moves: [
    PokemonMove | null,
    PokemonMove | null,
    PokemonMove | null,
    PokemonMove | null,
  ];
  isCustomSaved: boolean;
}

export interface Team {
  id: string;
  name: string;
  members: (TeamMember | null)[]; // length 6
  createdAt: number;
}

export interface AppState {
  teams: Team[];
  customPokemon: TeamMember[];
  activeTeamId: string;
}

/** Catalogue entry for a Pokémon species/form pulled from PokéAPI. */
export interface PokemonEntry {
  id: number;
  name: string;            // form name (e.g. "rotom-heat")
  displayName: string;     // pretty display name
  speciesName: string;     // species name (e.g. "rotom")
  types: [PokemonType, PokemonType | null];
  spriteUrl: string | null;
  isLegendary: boolean;
  isMythical: boolean;
  isFinalEvolution: boolean;
}

export interface MoveEntry {
  id: number;
  name: string;
  displayName: string;
  type: PokemonType;
  power: number | null;
  damageClass: DamageClass;
}

export type TypeChart = Record<PokemonType, Record<PokemonType, number>>;
