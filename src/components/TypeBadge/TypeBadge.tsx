import { PokemonType } from '../../types';
import { getTypeSpriteUrl } from '../../data/typeSprites';

export function TypeBadge({ type, size = 'sm' }: { type: PokemonType; size?: 'sm' | 'md' }) {
  const spriteUrl = getTypeSpriteUrl(type);
  const imgSize = size === 'md' ? 'h-6' : 'h-5';
  return (
    <img
      src={spriteUrl}
      alt={type}
      title={type}
      className={`${imgSize} inline-block object-contain`}
      loading="lazy"
    />
  );
}
