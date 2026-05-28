import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  MoveEntry,
  POKEMON_TYPES,
  PokemonEntry,
  PokemonMove,
  PokemonType,
  TeamMember,
} from '../../types';
import { SearchableDropdown, DropdownOption } from '../SearchableDropdown/SearchableDropdown';
import { TypeBadge } from '../TypeBadge/TypeBadge';
import { MoveSlot } from '../MoveSlot/MoveSlot';
import { resolveSpriteUrl } from '../../utils/spriteUtils';

interface Props {
  member: TeamMember | null;
  pokemon: PokemonEntry[];
  moves: MoveEntry[];
  customs: TeamMember[];
  onChange: (m: TeamMember | null) => void;
  onSaveCustom: (m: TeamMember) => void;
  onClear: () => void;
}

export function PokemonSlot({
  member,
  pokemon,
  moves,
  customs,
  onChange,
  onSaveCustom,
  onClear,
}: Props) {
  // Per-slot "include saved custom Pokémon" toggle. Owned locally so that
  // toggling on one slot does *not* leak into the other five slots.
  const [includeCustoms, setIncludeCustoms] = useState(false);

  const options = useMemo<DropdownOption<PokemonEntry | TeamMember>[]>(() => {
    const customOpts: DropdownOption<TeamMember>[] = includeCustoms
      ? customs.map((c) => ({
          key: 'c-' + c.id,
          label: c.speciesName,
          value: c,
          // Custom Pokémon never carry a sprite — always placeholder.
          spriteUrl: null,
          group: 'CUSTOM',
        }))
      : [];
    const apiOpts: DropdownOption<PokemonEntry>[] = pokemon.map((p) => ({
      key: 'p-' + p.id + '-' + p.name,
      label: p.displayName,
      value: p,
      spriteUrl: resolveSpriteUrl(p, 'dropdown'),
    }));
    return [...customOpts, ...apiOpts] as DropdownOption<PokemonEntry | TeamMember>[];
  }, [pokemon, customs, includeCustoms]);

  function selectPokemon(_: unknown, opt: DropdownOption<PokemonEntry | TeamMember> | null) {
    if (!opt) {
      onChange(null);
      return;
    }
    const v = opt.value;
    if ((v as TeamMember).moves) {
      // It's a custom TeamMember
      const c = v as TeamMember;
      onChange({ ...c, id: uuid(), isCustomSaved: true });
    } else {
      const p = v as PokemonEntry;
      onChange({
        id: uuid(),
        speciesName: p.displayName,
        spriteUrl: resolveSpriteUrl(p, 'card'),
        types: p.types,
        moves: [null, null, null, null],
        isCustomSaved: false,
      });
    }
  }

  function setType(idx: 0 | 1, t: PokemonType | null) {
    if (!member) return;
    const next: [PokemonType, PokemonType | null] = [...member.types] as [PokemonType, PokemonType | null];
    if (idx === 0 && t) next[0] = t;
    if (idx === 1) next[1] = t;
    onChange({ ...member, types: next });
  }

  function setMove(i: number, mv: PokemonMove | null) {
    if (!member) return;
    const ms = [...member.moves] as TeamMember['moves'];
    ms[i] = mv;
    onChange({ ...member, moves: ms });
  }

  return (
    <div className="bg-panel rounded-lg p-3 flex flex-col gap-3 border border-panel2">
      <div className="flex items-center gap-2">
        <SearchableDropdown
          options={options}
          value={null}
          placeholder={member ? member.speciesName : 'Choose Pokémon…'}
          onChange={selectPokemon}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={includeCustoms}
          onChange={(e) => setIncludeCustoms(e.target.checked)}
        />
        Include saved custom Pokémon in search
      </label>

      {member ? (
        <>
          <div className="flex items-center gap-3">
            {member.spriteUrl && (
              <img src={member.spriteUrl} alt="" className="w-16 h-16 object-contain" />
            )}
            <div className="flex flex-col gap-1">
              <div className="font-semibold">{member.speciesName}</div>
              <div className="flex gap-1">
                {member.types[0] && <TypeBadge type={member.types[0]} />}
                {member.types[1] && <TypeBadge type={member.types[1]} />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs flex flex-col gap-1">
              Type 1
              <select
                value={member.types[0]}
                onChange={(e) => setType(0, e.target.value as PokemonType)}
                className="bg-panel2 rounded px-1 py-1 text-xs"
              >
                {POKEMON_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-xs flex flex-col gap-1">
              Type 2
              <select
                value={member.types[1] ?? ''}
                onChange={(e) => setType(1, e.target.value ? (e.target.value as PokemonType) : null)}
                className="bg-panel2 rounded px-1 py-1 text-xs"
              >
                <option value="">None</option>
                {POKEMON_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <MoveSlot
                key={i}
                move={member.moves[i]}
                moves={moves}
                onChange={(mv) => setMove(i, mv)}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              className="text-xs px-2 py-1 bg-accent rounded hover:bg-violet-500"
              onClick={() => onSaveCustom(member)}
            >
              Save as custom
            </button>
            <button
              className="text-xs px-2 py-1 bg-panel2 rounded hover:bg-panel"
              onClick={onClear}
            >
              Clear slot
            </button>
          </div>
        </>
      ) : (
        <div className="text-xs text-slate-400">Empty slot</div>
      )}
    </div>
  );
}
