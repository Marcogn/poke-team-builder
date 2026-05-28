import { MoveEntry, PokemonEntry, Team, TeamMember } from '../../types';
import { PokemonSlot } from '../PokemonSlot/PokemonSlot';

interface Props {
  team: Team;
  pokemon: PokemonEntry[];
  moves: MoveEntry[];
  customs: TeamMember[];
  showMoves: boolean;
  onShowMovesChange: (v: boolean) => void;
  onUpdateMember: (idx: number, m: TeamMember | null) => void;
  onSaveCustom: (m: TeamMember) => void;
  onRenameTeam: (name: string) => void;
}

export function TeamBuilder({
  team,
  pokemon,
  moves,
  customs,
  showMoves,
  onShowMovesChange,
  onUpdateMember,
  onSaveCustom,
  onRenameTeam,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          value={team.name}
          onChange={(e) => onRenameTeam(e.target.value)}
          className="text-lg font-semibold bg-transparent border-b border-panel2 px-1 py-0.5 outline-none focus:border-accent"
        />
        <span className="text-xs text-slate-400">
          {team.members.filter(Boolean).length}/6 filled
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none mb-4">
        <input
          type="checkbox"
          checked={showMoves}
          onChange={(e) => onShowMovesChange(e.target.checked)}
          className="w-4 h-4 accent-purple-500"
        />
        Enable move slots
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {team.members.map((m, i) => (
          <PokemonSlot
            key={i}
            member={m}
            pokemon={pokemon}
            moves={moves}
            customs={customs}
            showMoves={showMoves}
            onChange={(next) => onUpdateMember(i, next)}
            onSaveCustom={onSaveCustom}
            onClear={() => onUpdateMember(i, null)}
          />
        ))}
      </div>
    </div>
  );
}
