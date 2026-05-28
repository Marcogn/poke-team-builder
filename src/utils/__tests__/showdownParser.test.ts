import { describe, it, expect } from 'vitest';
import {
  exportMemberToShowdown,
  exportTeamToShowdown,
  parseShowdownBlock,
  parseShowdownTeam,
} from '../showdownParser';
import { PokemonMove, PokemonType, TeamMember } from '../../types';
import { buildMember, mockMoveList } from './testFixtures';

const resolveMove = (name: string): PokemonMove | null => {
  const key = name.toLowerCase().replace(/\s+/g, '-');
  const found = mockMoveList.find((m) => m.name === key);
  if (!found) return null;
  return {
    id: 'r-' + found.id,
    name: found.name,
    type: found.type,
    power: found.power,
    damageClass: found.damageClass,
    isCustom: false,
  };
};

const resolveTypes = (
  speciesName: string,
): [PokemonType, PokemonType | null] | null => {
  switch (speciesName.toLowerCase()) {
    case 'pikachu':
      return ['electric', null];
    case 'charizard':
      return ['fire', 'flying'];
    case 'snorlax':
      return ['normal', null];
    default:
      return null;
  }
};

describe('showdownParser — export', () => {
  it('exports a complete team member with all fields', () => {
    const m: TeamMember = buildMember(
      'Charizard',
      ['fire', 'flying'],
      ['fire', 'ground', 'dragon', 'fire'],
    );
    const out = exportMemberToShowdown(m);
    expect(out).toMatch(/^Charizard @/);
    expect(out).toMatch(/Ability:/);
    expect(out).toMatch(/EVs:/);
    expect(out).toMatch(/Nature/);
    expect(out).toMatch(/- fire-move/);
    expect(out).toMatch(/# Types: fire\/flying/);
  });

  it('exports a member with null moves (placeholders skipped)', () => {
    const m = buildMember('Snorlax', ['normal', null]);
    const out = exportMemberToShowdown(m);
    expect(out).not.toMatch(/^- /m);
    expect(out).toMatch(/# Types: normal/);
  });

  it('exports a full team separated by blank lines', () => {
    const m1 = buildMember('Charizard', ['fire', 'flying']);
    const m2 = buildMember('Snorlax', ['normal', null]);
    const out = exportTeamToShowdown([m1, null, m2, null, null, null]);
    expect(out.split(/\n\s*\n/).length).toBe(2);
  });
});

describe('showdownParser — import', () => {
  it('imports a standard Showdown paste with all fields', () => {
    const paste = [
      'Charizard @ Charcoal',
      'Ability: Blaze',
      'EVs: 4 HP / 252 SpA / 252 Spe',
      'Modest Nature',
      '- Flamethrower',
      '- Earthquake',
      '- Dragon Claw',
      '- Surf',
    ].join('\n');
    const imp = parseShowdownBlock(paste, resolveMove, resolveTypes);
    expect(imp.speciesKnown).toBe(true);
    expect(imp.member.speciesName).toBe('Charizard');
    expect(imp.member.types).toEqual(['fire', 'flying']);
    expect(imp.member.moves.filter(Boolean)).toHaveLength(4);
    expect(imp.unknownMoveNames).toEqual([]);
  });

  it('imports with missing optional fields (no item, no EVs)', () => {
    const paste = ['Pikachu', '- Thunderbolt', '- Tackle'].join('\n');
    const imp = parseShowdownBlock(paste, resolveMove, resolveTypes);
    expect(imp.member.speciesName).toBe('Pikachu');
    expect(imp.member.types).toEqual(['electric', null]);
    expect(imp.member.moves[0]?.name).toBe('thunderbolt');
    expect(imp.member.moves[2]).toBeNull();
  });

  it('flags an unknown/custom move', () => {
    const paste = ['Pikachu', '- Made Up Move'].join('\n');
    const imp = parseShowdownBlock(paste, resolveMove, resolveTypes);
    expect(imp.unknownMoveNames).toEqual(['Made Up Move']);
    expect(imp.member.moves[0]?.isCustom).toBe(true);
  });

  it('imports a 6-member block', () => {
    const block = (name: string, move: string) =>
      [`${name} @ `, 'Ability: ', `- ${move}`].join('\n');
    const text =
      block('Pikachu', 'Thunderbolt') +
      '\n\n' +
      block('Charizard', 'Flamethrower') +
      '\n\n' +
      block('Snorlax', 'Tackle') +
      '\n\n' +
      block('Pikachu', 'Thunderbolt') +
      '\n\n' +
      block('Charizard', 'Flamethrower') +
      '\n\n' +
      block('Snorlax', 'Tackle');
    const imps = parseShowdownTeam(text, resolveMove, resolveTypes);
    expect(imps).toHaveLength(6);
  });

  it('round-trip: export then re-import preserves species, types, and move names', () => {
    const original = buildMember('Charizard', ['fire', 'flying'], [
      'fire',
      'ground',
    ]);
    const text = exportMemberToShowdown(original);
    const imp = parseShowdownBlock(text, resolveMove, resolveTypes);
    expect(imp.member.speciesName).toBe('Charizard');
    expect(imp.member.types).toEqual(['fire', 'flying']);
    const moveNames = imp.member.moves.filter(Boolean).map((m) => m!.name);
    expect(moveNames).toEqual(['fire-move', 'ground-move']);
  });

  it('handles empty string without crashing', () => {
    const result = parseShowdownTeam('', resolveMove, resolveTypes);
    expect(result).toEqual([]);
  });

  it('handles garbage text by yielding an unknown-species block', () => {
    const result = parseShowdownTeam(
      'asdf qwer\nzxcv',
      resolveMove,
      resolveTypes,
    );
    expect(result).toHaveLength(1);
    expect(result[0].speciesKnown).toBe(false);
  });

  it('handles partial block (species only) without crashing', () => {
    const result = parseShowdownTeam('Pikachu', resolveMove, resolveTypes);
    expect(result).toHaveLength(1);
    expect(result[0].speciesKnown).toBe(true);
    expect(result[0].member.moves.every((m) => m === null)).toBe(true);
  });
});

describe('showdownParser — unknown species handling', () => {
  // Import the higher-level API lazily so we don't break the older import line.
  it('importShowdownTeam: unknown species yields no slot but an error entry', async () => {
    const { importShowdownTeam } = await import('../showdownParser');
    const text = ['Fakemon @ ', 'Ability: ', '- Tackle'].join('\n');
    const result = importShowdownTeam(text, resolveMove, resolveTypes);
    expect(result.members).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ kind: 'unknown_species', name: 'Fakemon' });
  });

  it('importShowdownTeam: 3-block paste with one unknown — slots 1 and 3 imported, slot 2 dropped', async () => {
    const { importShowdownTeam } = await import('../showdownParser');
    const block = (name: string, move: string) =>
      [`${name} @ `, 'Ability: ', `- ${move}`].join('\n');
    const text = [
      block('Pikachu', 'Thunderbolt'),
      block('Fakemon', 'Tackle'),
      block('Charizard', 'Flamethrower'),
    ].join('\n\n');
    const result = importShowdownTeam(text, resolveMove, resolveTypes);
    expect(result.members.map((m) => m.member.speciesName)).toEqual([
      'Pikachu',
      'Charizard',
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe('Fakemon');
  });
});
