import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MoveEntry,
  MoveIndexEntry,
  POKEMON_TYPES,
  PokemonEntry,
  PokemonType,
  TypeChart,
} from '../types';

/**
 * All PokéAPI-derived data lives under a single, independent storage key.
 * User data (teams, custom roster) lives under `teamdex_userdata` in
 * App.tsx and is *never* touched by this module.
 */
export const POKEAPI_CACHE_KEY = 'teamdex_pokeapi_cache';

/** Cache schema version. Bump whenever the cached structure changes. */
export const CACHE_VERSION = 2;

/** Static mirror of PokéAPI on GitHub — no rate limiting, no auth. */
const API_BASE =
  'https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2';

/** Max concurrent fetches when populating the cache. */
const BATCH_SIZE = 50;
/** Pause between successive batches to be a polite client. */
const BATCH_DELAY_MS = 50;

interface PokeApiCachePayload {
  pokemon: PokemonEntry[];
  typeChart: TypeChart;
  moveIndex: MoveIndexEntry[];
  /** Lazily-populated map of `move name → MoveEntry` details. */
  moveDetails?: Record<string, MoveEntry>;
}

export interface PokeApiCache {
  version: number;
  data: PokeApiCachePayload;
}

export interface PokeDataState {
  pokemon: PokemonEntry[];
  moves: MoveEntry[];
  moveIndex: MoveIndexEntry[];
  typeChart: TypeChart | null;
  loading: boolean;
  /** 0–100 percentage suitable for a progress bar. */
  progress: number;
  /** Human-readable stage label (e.g. "types", "pokemon"). */
  stage: string;
  error: string | null;
}

function loadCache(): PokeApiCache | null {
  try {
    const raw = localStorage.getItem(POKEAPI_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PokeApiCache) : null;
  } catch {
    return null;
  }
}

function saveCache(c: PokeApiCache) {
  try {
    localStorage.setItem(POKEAPI_CACHE_KEY, JSON.stringify(c));
  } catch {
    // ignore quota errors
  }
}

function prettify(name: string): string {
  return name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('-');
}

/** Fetch JSON with a single retry on failure. Throws on the second failure. */
async function fetchJsonWithRetry<T>(url: string): Promise<T> {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } catch {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} (retry)`);
    return (await r.json()) as T;
  }
}

/** Run an async mapper over `items` with bounded concurrency and inter-batch delay. */
async function processInBatches<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      slice.map((item, j) => worker(item, i + j)),
    );
    results.push(...batchResults);
    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, items.length), items.length);
    if (i + BATCH_SIZE < items.length) {
      await new Promise<void>((res) => setTimeout(res, BATCH_DELAY_MS));
    }
  }
  return results;
}

interface PokeApiPokemon {
  id: number;
  name: string;
  sprites: {
    front_default: string | null;
    other?: {
      home?: { front_default: string | null } | null;
      'official-artwork'?: { front_default: string | null } | null;
    };
  };
  types: { slot: number; type: { name: string } }[];
  species: { name: string; url: string };
}

interface PokeApiSpecies {
  is_legendary: boolean;
  is_mythical: boolean;
  evolution_chain: { url: string } | null;
}

interface EvoNode {
  species: { name: string };
  evolves_to: EvoNode[];
}

function collectFinalEvolutions(node: EvoNode, out: Set<string>) {
  if (!node.evolves_to || node.evolves_to.length === 0) {
    out.add(node.species.name);
    return;
  }
  for (const child of node.evolves_to) collectFinalEvolutions(child, out);
}

function buildEmptyChart(): TypeChart {
  const chart = {} as TypeChart;
  for (const a of POKEMON_TYPES) {
    chart[a] = {} as Record<PokemonType, number>;
    for (const b of POKEMON_TYPES) chart[a][b] = 1;
  }
  return chart;
}

interface PokeApiType {
  damage_relations: {
    double_damage_to: { name: string }[];
    half_damage_to: { name: string }[];
    no_damage_to: { name: string }[];
  };
}

interface PokeApiMoveDetail {
  id: number;
  name: string;
  power: number | null;
  type: { name: string };
  damage_class: { name: 'physical' | 'special' | 'status' };
}

function extractSprites(p: PokeApiPokemon): {
  spriteHome: string | null;
  spriteArtwork: string | null;
  spriteDefault: string | null;
} {
  return {
    spriteHome: p.sprites.other?.home?.front_default ?? null,
    spriteArtwork: p.sprites.other?.['official-artwork']?.front_default ?? null,
    spriteDefault: p.sprites.front_default ?? null,
  };
}

/**
 * Build a `PokemonEntry` from a PokéAPI response, given pre-fetched
 * species flags and the set of final-evolution species names.
 */
function buildEntry(
  p: PokeApiPokemon,
  flags: { legendary: boolean; mythical: boolean } | undefined,
  finalEvolutions: Set<string>,
): PokemonEntry {
  const types: PokemonType[] = p.types
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name as PokemonType);
  const sprites = extractSprites(p);
  return {
    id: p.id,
    name: p.name,
    displayName: prettify(p.name),
    speciesName: p.species.name,
    types: [
      types[0] ?? 'normal',
      (types[1] as PokemonType | undefined) ?? null,
    ],
    spriteHome: sprites.spriteHome,
    spriteArtwork: sprites.spriteArtwork,
    spriteDefault: sprites.spriteDefault,
    isLegendary: flags?.legendary ?? false,
    isMythical: flags?.mythical ?? false,
    isFinalEvolution:
      finalEvolutions.size === 0 ? true : finalEvolutions.has(p.species.name),
  };
}

/**
 * Fetch all data from the static mirror and assemble the cache payload.
 *
 * Surfaces individual fetch failures via `console.warn` and skips the
 * affected resource so a single 404 does not abort the whole load.
 */
async function fetchAll(
  onProgress: (pct: number, stage: string) => void,
  isCancelled: () => boolean,
): Promise<PokeApiCachePayload> {
  // --- Type chart ---
  onProgress(0, 'types');
  const chart = buildEmptyChart();
  await processInBatches(
    POKEMON_TYPES.slice(),
    async (t) => {
      try {
        const data = await fetchJsonWithRetry<PokeApiType>(
          `${API_BASE}/type/${t}/index.json`,
        );
        for (const x of data.damage_relations.double_damage_to) {
          chart[t][x.name as PokemonType] = 2;
        }
        for (const x of data.damage_relations.half_damage_to) {
          chart[t][x.name as PokemonType] = 0.5;
        }
        for (const x of data.damage_relations.no_damage_to) {
          chart[t][x.name as PokemonType] = 0;
        }
      } catch (err) {
        console.warn(`PokéAPI: type "${t}" fetch failed`, err);
      }
    },
    (done, total) => onProgress((done / total) * 5, 'types'),
  );
  if (isCancelled()) return emptyPayload();

  // --- Pokémon index ---
  onProgress(5, 'pokemon-list');
  const list = await fetchJsonWithRetry<{ results: { name: string; url: string }[] }>(
    `${API_BASE}/pokemon/index.json`,
  );
  const total = list.results.length;
  if (isCancelled()) return emptyPayload();

  // --- Pokémon detail batches ---
  const speciesUrlBySpeciesName = new Map<string, string>();
  const pokemonRaw: PokeApiPokemon[] = [];
  await processInBatches(
    list.results,
    async (entry) => {
      try {
        const p = await fetchJsonWithRetry<PokeApiPokemon>(
          `${API_BASE}/pokemon/${entry.name}/index.json`,
        );
        pokemonRaw.push(p);
        if (!speciesUrlBySpeciesName.has(p.species.name)) {
          speciesUrlBySpeciesName.set(p.species.name, p.species.url);
        }
      } catch (err) {
        console.warn(`PokéAPI: pokemon "${entry.name}" fetch failed`, err);
      }
    },
    (done) => onProgress(5 + (done / total) * 50, 'pokemon'),
  );
  if (isCancelled()) return emptyPayload();

  // --- Species data (legendary/mythical + evolution chain url) ---
  const speciesNames = Array.from(speciesUrlBySpeciesName.keys());
  const speciesFlags = new Map<
    string,
    { legendary: boolean; mythical: boolean; evoChainUrl: string }
  >();
  await processInBatches(
    speciesNames,
    async (name) => {
      try {
        const sp = await fetchJsonWithRetry<PokeApiSpecies>(
          `${API_BASE}/pokemon-species/${name}/index.json`,
        );
        speciesFlags.set(name, {
          legendary: sp.is_legendary,
          mythical: sp.is_mythical,
          evoChainUrl: sp.evolution_chain?.url ?? '',
        });
      } catch (err) {
        console.warn(`PokéAPI: species "${name}" fetch failed`, err);
      }
    },
    (done, t) => onProgress(55 + (done / t) * 15, 'species'),
  );
  if (isCancelled()) return emptyPayload();

  // --- Evolution chains ---
  const uniqueChainUrls = Array.from(
    new Set(Array.from(speciesFlags.values()).map((v) => v.evoChainUrl)),
  ).filter(Boolean);
  const finalEvolutions = new Set<string>();
  await processInBatches(
    uniqueChainUrls,
    async (url) => {
      try {
        // The chain URL points at PokéAPI proper; rewrite to the static mirror.
        // URLs look like .../api/v2/evolution-chain/{id}/
        const m = url.match(/evolution-chain\/(\d+)/);
        const id = m ? m[1] : null;
        if (!id) return;
        const data = await fetchJsonWithRetry<{ chain: EvoNode }>(
          `${API_BASE}/evolution-chain/${id}/index.json`,
        );
        collectFinalEvolutions(data.chain, finalEvolutions);
      } catch (err) {
        console.warn(`PokéAPI: evolution chain "${url}" fetch failed`, err);
      }
    },
    (done, t) => onProgress(70 + (done / t) * 15, 'evolutions'),
  );
  if (isCancelled()) return emptyPayload();

  // --- Move index (details lazily fetched on demand) ---
  onProgress(85, 'moves-list');
  let moveIndex: MoveIndexEntry[] = [];
  try {
    const mList = await fetchJsonWithRetry<{
      results: { name: string; url: string }[];
    }>(`${API_BASE}/move/index.json`);
    moveIndex = mList.results.map((r) => ({
      name: r.name,
      displayName: prettify(r.name),
      url: r.url,
    }));
  } catch (err) {
    console.warn('PokéAPI: move index fetch failed', err);
  }
  if (isCancelled()) return emptyPayload();

  // --- Assemble final entries ---
  onProgress(95, 'assemble');
  const pokemon: PokemonEntry[] = pokemonRaw
    .map((p) => buildEntry(p, speciesFlags.get(p.species.name), finalEvolutions))
    .sort((a, b) => a.id - b.id);
  onProgress(100, 'done');

  return { pokemon, typeChart: chart, moveIndex, moveDetails: {} };
}

function emptyPayload(): PokeApiCachePayload {
  return {
    pokemon: [],
    typeChart: buildEmptyChart(),
    moveIndex: [],
    moveDetails: {},
  };
}

/**
 * Hook: load + cache PokéAPI-derived data, expose loading progress, and
 * provide a lazy `loadMoveDetails` for on-demand move metadata.
 */
export function usePokemonData() {
  const [state, setState] = useState<PokeDataState>({
    pokemon: [],
    moves: [],
    moveIndex: [],
    typeChart: null,
    loading: true,
    progress: 0,
    stage: 'init',
    error: null,
  });

  // Track the cached payload across renders for lazy move detail updates.
  const payloadRef = useRef<PokeApiCachePayload | null>(null);

  const resetCache = useCallback(() => {
    localStorage.removeItem(POKEAPI_CACHE_KEY);
    // `teamdex_userdata` is intentionally untouched.
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
    }
  }, []);

  const loadMoveDetails = useCallback(
    async (name: string): Promise<MoveEntry | null> => {
      const payload = payloadRef.current;
      if (!payload) return null;
      const cached = payload.moveDetails?.[name];
      if (cached) return cached;
      try {
        const m = await fetchJsonWithRetry<PokeApiMoveDetail>(
          `${API_BASE}/move/${name}/index.json`,
        );
        const detail: MoveEntry = {
          id: m.id,
          name: m.name,
          displayName: prettify(m.name),
          type: m.type.name as PokemonType,
          power: m.power,
          damageClass: m.damage_class.name,
        };
        payload.moveDetails = { ...(payload.moveDetails ?? {}), [name]: detail };
        saveCache({ version: CACHE_VERSION, data: payload });
        setState((s) => ({ ...s, moves: dedupeMoves([...s.moves, detail]) }));
        return detail;
      } catch (err) {
        console.warn(`PokéAPI: move "${name}" detail fetch failed`, err);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const cached = loadCache();
    if (cached && cached.version === CACHE_VERSION) {
      payloadRef.current = cached.data;
      const moves = Object.values(cached.data.moveDetails ?? {});
      setState({
        pokemon: cached.data.pokemon,
        moves,
        moveIndex: cached.data.moveIndex,
        typeChart: cached.data.typeChart,
        loading: false,
        progress: 100,
        stage: 'done',
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }

    // Cache miss or version mismatch — re-fetch the entire dataset.
    (async () => {
      try {
        const payload = await fetchAll(
          (pct, stage) => {
            if (cancelled) return;
            setState((s) => ({ ...s, progress: pct, stage }));
          },
          () => cancelled,
        );
        if (cancelled) return;
        payloadRef.current = payload;
        saveCache({ version: CACHE_VERSION, data: payload });
        setState({
          pokemon: payload.pokemon,
          moves: Object.values(payload.moveDetails ?? {}),
          moveIndex: payload.moveIndex,
          typeChart: payload.typeChart,
          loading: false,
          progress: 100,
          stage: 'done',
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: (e as Error).message,
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, resetCache, loadMoveDetails };
}

function dedupeMoves(moves: MoveEntry[]): MoveEntry[] {
  const map = new Map<string, MoveEntry>();
  for (const m of moves) map.set(m.name, m);
  return Array.from(map.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}
