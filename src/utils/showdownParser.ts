import { v4 as uuid } from 'uuid';
import { POKEMON_TYPES, PokemonMove, PokemonType, TeamMember } from '../types';

const TYPE_SET = new Set<string>(POKEMON_TYPES);

function makeUnknownMove(name: string): PokemonMove {
  return {
    id: uuid(),
    name,
    type: 'normal',
    power: null,
    damageClass: 'status',
    isCustom: true,
  };
}

/**
 * Convert a TeamMember to a Showdown-style block. Fields not tracked
 * (item, ability, EVs, nature) are emitted as placeholders that are valid
 * to re-import.
 */
export function exportMemberToShowdown(m: TeamMember): string {
  const lines: string[] = [];
  const itemLine = `${m.speciesName} @ `;
  lines.push(itemLine);
  lines.push('Ability: ');
  lines.push('EVs: ');
  lines.push(' Nature');
  for (const mv of m.moves) {
    if (mv) lines.push(`- ${mv.name}`);
  }
  // include the typing as a comment so a round-trip preserves type overrides
  const typesStr = m.types.filter(Boolean).join('/');
  lines.push(`# Types: ${typesStr}`);
  return lines.join('\n');
}

export function exportTeamToShowdown(members: (TeamMember | null)[]): string {
  return members
    .filter((m): m is TeamMember => m !== null)
    .map(exportMemberToShowdown)
    .join('\n\n');
}

export interface ImportedMember {
  member: TeamMember;
  unknownMoveNames: string[]; // moves user must define
  speciesKnown: boolean;      // false → caller should skip this block (Patch 6)
  speciesName: string;        // raw species name as parsed
}

/** Parse a single Showdown block into a TeamMember. */
export function parseShowdownBlock(
  block: string,
  resolveMove: (name: string) => PokemonMove | null,
  resolveTypes: (speciesName: string) => [PokemonType, PokemonType | null] | null,
): ImportedMember {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let speciesName = 'Unknown';
  let overrideTypes: [PokemonType, PokemonType | null] | null = null;
  const moves: (PokemonMove | null)[] = [null, null, null, null];
  let moveIdx = 0;
  const unknown: string[] = [];

  for (const line of lines) {
    if (line.startsWith('- ')) {
      const moveName = line.slice(2).trim();
      const known = resolveMove(moveName);
      let mv: PokemonMove;
      if (known) mv = { ...known, id: uuid(), isCustom: false };
      else {
        mv = makeUnknownMove(moveName);
        unknown.push(moveName);
      }
      if (moveIdx < 4) moves[moveIdx++] = mv;
    } else if (/Ability:|EVs:|IVs:|Nature/i.test(line)) {
      // ignored
    } else if (line.startsWith('# Types:')) {
      const parts = line.replace('# Types:', '').trim().split('/').map((p) => p.trim().toLowerCase());
      const t1 = parts[0] as PokemonType;
      const t2 = (parts[1] as PokemonType | undefined) ?? null;
      if (TYPE_SET.has(t1)) overrideTypes = [t1, t2 && TYPE_SET.has(t2) ? t2 : null];
    } else if (!line.startsWith('#')) {
      // Species line, possibly with "@ item"
      const speciesLine = line.split('@')[0].trim();
      if (speciesLine) speciesName = speciesLine;
    }
  }

  const resolved = resolveTypes(speciesName);
  const types =
    overrideTypes ?? resolved ?? (['normal', null] as [PokemonType, PokemonType | null]);

  const member: TeamMember = {
    id: uuid(),
    speciesName,
    spriteUrl: null,
    types,
    moves: moves as TeamMember['moves'],
    isCustomSaved: false,
  };
  return {
    member,
    unknownMoveNames: unknown,
    speciesKnown: resolved !== null,
    speciesName,
  };
}

export function parseShowdownTeam(
  text: string,
  resolveMove: (name: string) => PokemonMove | null,
  resolveTypes: (speciesName: string) => [PokemonType, PokemonType | null] | null,
): ImportedMember[] {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => parseShowdownBlock(b, resolveMove, resolveTypes));
}

export interface ImportError {
  kind: 'unknown_species';
  name: string;
}

export interface ImportResult {
  members: ImportedMember[];
  errors: ImportError[];
}

/**
 * Higher-level import that drops blocks whose species cannot be resolved
 * and surfaces them as `errors`. The UI should render an error toast and
 * leave the team slots untouched for the dropped entries.
 */
export function importShowdownTeam(
  text: string,
  resolveMove: (name: string) => PokemonMove | null,
  resolveTypes: (speciesName: string) => [PokemonType, PokemonType | null] | null,
): ImportResult {
  const blocks = parseShowdownTeam(text, resolveMove, resolveTypes);
  const members: ImportedMember[] = [];
  const errors: ImportError[] = [];
  for (const b of blocks) {
    if (b.speciesKnown) {
      members.push(b);
    } else {
      errors.push({ kind: 'unknown_species', name: b.speciesName });
    }
  }
  return { members, errors };
}
