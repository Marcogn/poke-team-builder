import { PokemonType } from '../types';

export type AbilityEffect =
  | { kind: 'immunity'; type: PokemonType }
  | { kind: 'multiplier'; type: PokemonType; factor: number; side: 'offensive' | 'defensive' }
  | { kind: 'badge-only'; note: string };

/**
 * Canonical list of abilities with known coverage effects, used by the
 * ability picker UI. Names are in display format (lowercase, space-separated).
 */
export const KNOWN_ABILITIES_WITH_EFFECTS: string[] = [
  'volt absorb',
  'lightning rod',
  'motor drive',
  'water absorb',
  'storm drain',
  'dry skin',
  'flash fire',
  'sap sipper',
  'levitate',
  'earth eater',
  'well-baked body',
  'thick fat',
  'fluffy',
  'wonder guard',
];

/**
 * Hardcoded map of ability slugs (lowercase, hyphenated, matching PokeAPI) to
 * their coverage-relevant effects. Only abilities that alter defensive
 * multipliers or warrant a UI badge are included here.
 */
export const ABILITY_EFFECTS: Record<string, AbilityEffect[]> = {
  // Immunities (defensive — incoming moves of that type deal 0)
  'volt-absorb': [{ kind: 'immunity', type: 'electric' }],
  'lightning-rod': [{ kind: 'immunity', type: 'electric' }],
  'motor-drive': [{ kind: 'immunity', type: 'electric' }],
  'water-absorb': [{ kind: 'immunity', type: 'water' }],
  'storm-drain': [{ kind: 'immunity', type: 'water' }],
  'dry-skin': [{ kind: 'immunity', type: 'water' }],
  'flash-fire': [{ kind: 'immunity', type: 'fire' }],
  'sap-sipper': [{ kind: 'immunity', type: 'grass' }],
  'levitate': [{ kind: 'immunity', type: 'ground' }],
  'earth-eater': [{ kind: 'immunity', type: 'ground' }],
  'well-baked-body': [{ kind: 'immunity', type: 'fire' }],

  // Multiplier (defensive — modifies effective damage multiplier received)
  'thick-fat': [
    { kind: 'multiplier', type: 'fire', factor: 0.5, side: 'defensive' },
    { kind: 'multiplier', type: 'ice', factor: 0.5, side: 'defensive' },
  ],
  'fluffy': [
    { kind: 'multiplier', type: 'fire', factor: 2, side: 'defensive' },
  ],

  // Badge-only (no calculation change)
  'wonder-guard': [{ kind: 'badge-only', note: 'Only super-effective moves deal damage' }],
};

/**
 * Normalize an ability name to the slug format used as keys in ABILITY_EFFECTS.
 */
export function normalizeAbilityName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Look up the effects for a given ability name (case-insensitive, handles spaces).
 */
export function getAbilityEffects(ability: string | undefined): AbilityEffect[] | null {
  if (!ability) return null;
  const slug = normalizeAbilityName(ability);
  return ABILITY_EFFECTS[slug] ?? null;
}
