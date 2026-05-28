import { PokemonEntry } from '../types';

/**
 * Minimum shape needed for sprite resolution. Real `PokemonEntry` values
 * satisfy this trivially; consumers can also pass plain objects in tests.
 */
export interface SpriteSource {
  spriteHome?: string | null;
  spriteArtwork?: string | null;
  spriteDefault?: string | null;
}

export type SpriteContext = 'card' | 'dropdown';

/**
 * Resolve the sprite URL for a Pokémon entry given a display context.
 *
 * Card context (team slots, suggestion cards):
 *   HOME render → official artwork → pixel sprite → null
 *
 * Dropdown context (searchable dropdown thumbnails):
 *   pixel sprite only (HOME renders are too large for list items).
 *
 * Custom Pokémon (saved roster entries) never carry sprite URLs, so they
 * resolve to `null` and callers render the placeholder.
 *
 * Invariant: returns `null` rather than throwing when fields are missing
 * or the input is undefined.
 */
export function resolveSpriteUrl(
  pokemon: SpriteSource | PokemonEntry | null | undefined,
  context: SpriteContext,
): string | null {
  if (!pokemon) return null;
  if (context === 'dropdown') {
    return pokemon.spriteDefault ?? null;
  }
  // card context
  return pokemon.spriteHome ?? pokemon.spriteArtwork ?? pokemon.spriteDefault ?? null;
}
