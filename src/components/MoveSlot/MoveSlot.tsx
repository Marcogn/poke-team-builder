import { v4 as uuid } from 'uuid';
import { MoveEntry, POKEMON_TYPES, PokemonMove, PokemonType } from '../../types';
import { SearchableDropdown, DropdownOption } from '../SearchableDropdown/SearchableDropdown';

interface Props {
  move: PokemonMove | null;
  moves: MoveEntry[];
  onChange: (mv: PokemonMove | null) => void;
}

export function MoveSlot({ move, moves, onChange }: Props) {
  const options: DropdownOption<MoveEntry>[] = moves.map((m) => ({
    key: 'm-' + m.id,
    label: `${m.displayName} · ${m.type}${m.power ? ` · ${m.power}` : ''}`,
    value: m,
  }));

  function selectMove(_: MoveEntry | null, opt: DropdownOption<MoveEntry> | null) {
    if (!opt) {
      onChange(null);
      return;
    }
    const m = opt.value;
    onChange({
      id: uuid(),
      name: m.displayName,
      type: m.type,
      power: m.power,
      damageClass: m.damageClass,
      isCustom: false,
    });
  }

  return (
    <div className="bg-panel2 rounded p-2 flex flex-col gap-2">
      <SearchableDropdown<MoveEntry>
        options={options}
        value={null}
        placeholder={move ? move.name : 'Pick or type a move'}
        onChange={selectMove}
      />
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Custom move name"
          value={move?.isCustom ? move.name : ''}
          onChange={(e) => {
            const name = e.target.value;
            if (!name) {
              onChange(null);
              return;
            }
            onChange({
              id: move?.id ?? uuid(),
              name,
              type: move?.type ?? 'normal',
              power: move?.power ?? null,
              damageClass: move?.damageClass ?? 'physical',
              isCustom: true,
            });
          }}
          className="flex-1 bg-panel rounded px-2 py-1 text-xs outline-none"
        />
      </div>
      {move?.isCustom && (
        <div className="grid grid-cols-3 gap-1">
          <select
            value={move.type}
            onChange={(e) => onChange({ ...move, type: e.target.value as PokemonType })}
            className="bg-panel rounded px-1 py-1 text-xs"
          >
            {POKEMON_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Power"
            value={move.power ?? ''}
            onChange={(e) => onChange({ ...move, power: e.target.value ? Number(e.target.value) : null })}
            className="bg-panel rounded px-1 py-1 text-xs"
          />
          <select
            value={move.damageClass}
            onChange={(e) => onChange({ ...move, damageClass: e.target.value as PokemonMove['damageClass'] })}
            className="bg-panel rounded px-1 py-1 text-xs"
          >
            <option value="physical">physical</option>
            <option value="special">special</option>
            <option value="status">status</option>
          </select>
        </div>
      )}
      {move && (
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>
            {move.type} · {move.damageClass} · {move.power ?? '—'}
          </span>
          <button className="text-red-300 hover:text-red-200" onClick={() => onChange(null)}>
            remove
          </button>
        </div>
      )}
    </div>
  );
}
