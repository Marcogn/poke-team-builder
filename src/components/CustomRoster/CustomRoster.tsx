import { TeamMember } from '../../types';
import { TypeBadge } from '../TypeBadge/TypeBadge';

interface Props {
  customs: TeamMember[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function CustomRoster({ customs, onRename, onDelete }: Props) {
  if (customs.length === 0) {
    return <div className="text-sm text-slate-400">No custom Pokémon saved yet.</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
      {customs.map((c) => (
        <div key={c.id} className="bg-panel rounded p-2 flex items-center gap-2">
          {c.spriteUrl && <img src={c.spriteUrl} alt="" className="w-10 h-10 object-contain" />}
          <div className="flex-1">
            <input
              value={c.speciesName}
              onChange={(e) => onRename(c.id, e.target.value)}
              className="bg-transparent border-b border-panel2 outline-none focus:border-accent text-sm w-full"
            />
            <div className="flex gap-1 mt-1">
              {c.types[0] && <TypeBadge type={c.types[0]} />}
              {c.types[1] && <TypeBadge type={c.types[1]} />}
            </div>
          </div>
          <button
            className="text-xs text-red-300 hover:text-red-200"
            onClick={() => onDelete(c.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
