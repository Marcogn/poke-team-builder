import { PokemonType } from '../../types';

const TYPE_CLASS: Record<PokemonType, string> = {
  normal: 'bg-type-normal',
  fire: 'bg-type-fire',
  water: 'bg-type-water',
  electric: 'bg-type-electric text-black',
  grass: 'bg-type-grass',
  ice: 'bg-type-ice text-black',
  fighting: 'bg-type-fighting',
  poison: 'bg-type-poison',
  ground: 'bg-type-ground text-black',
  flying: 'bg-type-flying',
  psychic: 'bg-type-psychic',
  bug: 'bg-type-bug',
  rock: 'bg-type-rock',
  ghost: 'bg-type-ghost',
  dragon: 'bg-type-dragon',
  dark: 'bg-type-dark',
  steel: 'bg-type-steel text-black',
  fairy: 'bg-type-fairy',
};

export function TypeBadge({ type, size = 'sm' }: { type: PokemonType; size?: 'sm' | 'md' }) {
  const cls = TYPE_CLASS[type] ?? 'bg-slate-600';
  const pad = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`${cls} ${pad} rounded-full font-semibold uppercase tracking-wide text-white inline-block`}>
      {type}
    </span>
  );
}
