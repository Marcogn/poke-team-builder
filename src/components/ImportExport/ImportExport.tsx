import { useState } from 'react';
import { MoveEntry, PokemonEntry, Team, TeamMember } from '../../types';
import { exportTeamToShowdown, parseShowdownTeam } from '../../utils/showdownParser';

interface Props {
  team: Team;
  pokemon: PokemonEntry[];
  moves: MoveEntry[];
  onImport: (members: TeamMember[], unknownMoves: string[], skippedSpecies: string[]) => void;
  toast: (msg: string) => void;
}

export function ImportExport({ team, pokemon, moves, onImport, toast }: Props) {
  const [text, setText] = useState('');

  const exported = exportTeamToShowdown(team.members);

  function doImport(src: string) {
    const resolveMove = (name: string) => {
      const found = moves.find((m) => m.displayName.toLowerCase() === name.toLowerCase());
      if (!found) return null;
      return {
        id: 'imp-' + found.id,
        name: found.displayName,
        type: found.type,
        power: found.power,
        damageClass: found.damageClass,
        isCustom: false,
      };
    };
    const resolveTypes = (name: string) => {
      const found = pokemon.find((p) => p.displayName.toLowerCase() === name.toLowerCase());
      if (!found) return null;
      return found.types;
    };
    const parsed = parseShowdownTeam(src, resolveMove, resolveTypes);
    // Patch 6: discard blocks whose species is not in the PokéAPI cache;
    // notify the caller with the list of skipped names.
    const skipped: string[] = [];
    const accepted = parsed.filter((p) => {
      if (!p.speciesKnown) {
        skipped.push(p.speciesName);
        return false;
      }
      return true;
    });
    const members = accepted.map((p) => {
      const found = pokemon.find((pp) => pp.displayName.toLowerCase() === p.member.speciesName.toLowerCase());
      return { ...p.member, spriteUrl: found?.spriteUrl ?? null };
    });
    const unknown = Array.from(new Set(accepted.flatMap((p) => p.unknownMoveNames)));
    onImport(members, unknown, skipped);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold">Export (Showdown)</h3>
          <button
            className="text-xs px-2 py-1 bg-accent rounded hover:bg-violet-500"
            onClick={async () => {
              await navigator.clipboard.writeText(exported);
              toast('Copied to clipboard');
            }}
          >
            Copy
          </button>
          <button
            className="text-xs px-2 py-1 bg-panel2 rounded hover:bg-panel"
            onClick={() => {
              const blob = new Blob([exported], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${team.name || 'team'}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              toast('Downloaded');
            }}
          >
            Download .txt
          </button>
        </div>
        <textarea
          readOnly
          value={exported}
          className="w-full h-40 bg-panel2 rounded p-2 text-xs font-mono"
        />
      </div>
      <div>
        <h3 className="font-semibold mb-1">Import</h3>
        <textarea
          placeholder="Paste a Showdown team here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-40 bg-panel2 rounded p-2 text-xs font-mono"
        />
        <div className="flex items-center gap-2 mt-1">
          <button
            className="text-xs px-2 py-1 bg-accent rounded hover:bg-violet-500"
            onClick={() => doImport(text)}
          >
            Import from text
          </button>
          <label className="text-xs px-2 py-1 bg-panel2 rounded cursor-pointer hover:bg-panel">
            Upload .txt
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const t = await f.text();
                setText(t);
                doImport(t);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
