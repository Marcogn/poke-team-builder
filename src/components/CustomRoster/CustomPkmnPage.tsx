import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { POKEMON_TYPES, PokemonType, TeamMember } from '../../types';
import { TypeBadge } from '../TypeBadge/TypeBadge';

interface Props {
  customs: TeamMember[];
  onAdd: (m: TeamMember) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function CustomPkmnPage({ customs, onAdd, onRename, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type1, setType1] = useState<PokemonType>('normal');
  const [type2, setType2] = useState<PokemonType | 'none'>('none');

  function handleSave() {
    if (!name.trim()) return;
    const member: TeamMember = {
      id: uuid(),
      speciesName: name.trim(),
      spriteUrl: null,
      types: [type1, type2 === 'none' ? null : type2],
      moves: [null, null, null, null],
      isCustomSaved: true,
    };
    onAdd(member);
    resetForm();
  }

  function resetForm() {
    setShowForm(false);
    setName('');
    setType1('normal');
    setType2('none');
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Custom Pokémon</h2>
        {!showForm && (
          <button
            className="text-xs px-3 py-1.5 rounded bg-accent hover:bg-violet-500 font-semibold"
            onClick={() => setShowForm(true)}
          >
            + Add custom Pokémon
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-panel border border-panel2 rounded p-4 flex flex-col gap-3">
          <input
            autoFocus
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-panel2 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              Type 1:
              <select
                value={type1}
                onChange={(e) => setType1(e.target.value as PokemonType)}
                className="bg-panel2 rounded px-2 py-1 text-sm"
              >
                {POKEMON_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Type 2:
              <select
                value={type2}
                onChange={(e) => setType2(e.target.value as PokemonType | 'none')}
                className="bg-panel2 rounded px-2 py-1 text-sm"
              >
                <option value="none">None</option>
                {POKEMON_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              className="text-xs px-3 py-1.5 rounded bg-accent hover:bg-violet-500 font-semibold"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded bg-panel2 hover:bg-panel"
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {customs.length === 0 && !showForm && (
        <div className="text-sm text-slate-400">No custom Pokémon saved yet.</div>
      )}

      <div className="flex flex-col gap-2">
        {customs.map((c) => (
          <div key={c.id} className="bg-panel border border-panel2 rounded p-3 flex items-center gap-3">
            {c.spriteUrl && <img src={c.spriteUrl} alt="" className="w-10 h-10 object-contain" />}
            <div className="flex-1 min-w-0">
              <input
                value={c.speciesName}
                onChange={(e) => onRename(c.id, e.target.value)}
                className="bg-transparent border-b border-panel2 outline-none focus:border-accent text-sm w-full"
              />
              <div className="flex gap-1 mt-1">
                {c.types[0] && <TypeBadge type={c.types[0]} />}
                {c.types[1] && <TypeBadge type={c.types[1]} />}
              </div>
              {c.moves.some(Boolean) && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {c.moves.filter(Boolean).map((m) => (
                    <span key={m!.id} className="text-[10px] bg-panel2 px-1.5 py-0.5 rounded">
                      {m!.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              className="text-xs text-red-300 hover:text-red-200 shrink-0"
              onClick={() => onDelete(c.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
