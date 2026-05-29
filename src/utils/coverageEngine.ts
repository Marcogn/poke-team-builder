import {
  POKEMON_TYPES,
  PokemonType,
  TeamMember,
  TypeChart,
} from '../types';
import { getAbilityEffects } from '../data/abilityEffects';

/**
 * Compute defensive effectiveness on a defender with one or two types.
 * Multiplies effectiveness across both defender types (stacking).
 * When an ability is provided, immunity and multiplier effects are applied.
 */
export function defensiveMultiplier(
  chart: TypeChart,
  attackingType: PokemonType,
  defenderTypes: [PokemonType, PokemonType | null],
  ability?: string,
): number {
  const t1 = chart[attackingType]?.[defenderTypes[0]] ?? 1;
  const t2 = defenderTypes[1] ? chart[attackingType]?.[defenderTypes[1]] ?? 1 : 1;
  let result = t1 * t2;

  // Apply ability effects
  const effects = getAbilityEffects(ability);
  if (effects) {
    for (const effect of effects) {
      if (effect.kind === 'immunity' && effect.type === attackingType) {
        return 0;
      }
      if (effect.kind === 'multiplier' && effect.side === 'defensive' && effect.type === attackingType) {
        result *= effect.factor;
      }
    }
  }

  return result;
}

/** Types this member can hit super-effectively (>=2x). */
export function offensiveCoverageForMember(
  chart: TypeChart,
  member: TeamMember,
  useMoves: boolean,
): Set<PokemonType> {
  const out = new Set<PokemonType>();
  const attackingTypes: PokemonType[] = [];
  if (useMoves) {
    for (const mv of member.moves) {
      if (mv && mv.damageClass !== 'status' && (mv.power ?? 0) > 0) {
        attackingTypes.push(mv.type);
      }
    }
  } else {
    attackingTypes.push(member.types[0]);
    if (member.types[1]) attackingTypes.push(member.types[1]);
  }
  for (const atk of attackingTypes) {
    for (const def of POKEMON_TYPES) {
      // For coverage we treat the defender as a single-type opponent.
      if ((chart[atk]?.[def] ?? 1) >= 2) {
        out.add(def);
      }
    }
  }
  return out;
}

/** True if this member has at least one damaging move entered. */
export function memberHasMoves(m: TeamMember): boolean {
  return m.moves.some((mv) => mv && mv.damageClass !== 'status' && (mv.power ?? 0) > 0);
}

export interface TeamCoverage {
  perMemberCovered: Map<string, Set<PokemonType>>;
  unionCovered: Set<PokemonType>;
  uncovered: PokemonType[];
  bestMultiplierByType: Record<PokemonType, number>; // best offensive multiplier on a generic mono-type defender
  modePerMember: Map<string, 'moves' | 'types'>;
  mixed: boolean;
}

export function analyseTeam(chart: TypeChart, members: TeamMember[]): TeamCoverage {
  const perMemberCovered = new Map<string, Set<PokemonType>>();
  const modePerMember = new Map<string, 'moves' | 'types'>();
  const allHaveMoves = members.length > 0 && members.every(memberHasMoves);
  const noneHaveMoves = members.every((m) => !memberHasMoves(m));
  const mixed = !allHaveMoves && !noneHaveMoves;

  for (const m of members) {
    const useMoves = memberHasMoves(m);
    modePerMember.set(m.id, useMoves ? 'moves' : 'types');
    perMemberCovered.set(m.id, offensiveCoverageForMember(chart, m, useMoves));
  }

  const union = new Set<PokemonType>();
  perMemberCovered.forEach((s) => s.forEach((t) => union.add(t)));
  const uncovered = POKEMON_TYPES.filter((t) => !union.has(t));

  const best = {} as Record<PokemonType, number>;
  for (const def of POKEMON_TYPES) best[def] = 0;
  for (const m of members) {
    const useMoves = modePerMember.get(m.id) === 'moves';
    const attackingTypes: PokemonType[] = useMoves
      ? m.moves
          .filter((mv) => mv && mv.damageClass !== 'status' && (mv.power ?? 0) > 0)
          .map((mv) => (mv as { type: PokemonType }).type)
      : [m.types[0], ...(m.types[1] ? [m.types[1]] : [])];
    for (const atk of attackingTypes) {
      for (const def of POKEMON_TYPES) {
        const mult = chart[atk]?.[def] ?? 1;
        if (mult > best[def]) best[def] = mult;
      }
    }
  }
  return { perMemberCovered, unionCovered: union, uncovered, bestMultiplierByType: best, modePerMember, mixed };
}

export interface DefensiveProfile {
  weaknesses: PokemonType[]; // >1x incoming
  resistances: PokemonType[]; // <1x and >0
  immunities: PokemonType[]; // 0x
}

export function defensiveProfile(chart: TypeChart, types: [PokemonType, PokemonType | null], ability?: string): DefensiveProfile {
  const w: PokemonType[] = [];
  const r: PokemonType[] = [];
  const im: PokemonType[] = [];
  for (const atk of POKEMON_TYPES) {
    const m = defensiveMultiplier(chart, atk, types, ability);
    if (m === 0) im.push(atk);
    else if (m > 1) w.push(atk);
    else if (m < 1) r.push(atk);
  }
  return { weaknesses: w, resistances: r, immunities: im };
}

/** Types that hit 2+ members for super-effective damage. */
export function sharedWeaknesses(chart: TypeChart, members: TeamMember[]): PokemonType[] {
  const result: PokemonType[] = [];
  for (const atk of POKEMON_TYPES) {
    let count = 0;
    for (const m of members) {
      if (defensiveMultiplier(chart, atk, m.types, m.ability) > 1) count++;
    }
    if (count >= 2) result.push(atk);
  }
  return result;
}
