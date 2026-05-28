import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  CACHE_VERSION,
  POKEAPI_CACHE_KEY,
  usePokemonData,
} from '../usePokemonData';

const USER_DATA_KEY = 'teamdex_userdata';

/**
 * Minimal fetch mock that returns canned JSON for the API endpoints touched
 * by the hook. Network is *never* hit. Endpoints not explicitly handled
 * resolve to an empty `results: []` payload so the load completes quickly.
 */
function installFetchMock(extra?: Record<string, unknown>) {
  const handlers: Record<string, unknown> = {
    // Type chart entries. The static mirror is id-indexed, so the type index
    // must expose a numeric url segment.
    type_index: { results: [{ name: 'normal', url: 'https://pokeapi.co/api/v2/type/1/' }] },
    type_detail: {
      damage_relations: {
        double_damage_to: [],
        half_damage_to: [],
        no_damage_to: [],
      },
    },
    // Pokémon index: a single Pokémon, referenced by id.
    pokemon_index: { results: [{ name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon/1/' }] },
    pokemon_detail: {
      id: 1,
      name: 'bulbasaur',
      sprites: {
        front_default: 'pixel.png',
        other: {
          home: { front_default: 'home.png' },
          'official-artwork': { front_default: 'art.png' },
        },
      },
      types: [{ slot: 1, type: { name: 'grass' } }],
      species: {
        name: 'bulbasaur',
        url: 'https://pokeapi.co/api/v2/pokemon-species/1/',
      },
    },
    species_detail: {
      is_legendary: false,
      is_mythical: false,
      evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/1/' },
    },
    evo_detail: {
      chain: { species: { name: 'bulbasaur' }, evolves_to: [] },
    },
    move_index: { results: [{ name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' }] },
    ...extra,
  };

  const callLog: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    callLog.push(url);
    let body: unknown = { results: [] };
    if (url.endsWith('/type/index.json')) body = handlers.type_index;
    else if (/\/type\/\d+\/index\.json$/.test(url)) body = handlers.type_detail;
    else if (url.endsWith('/pokemon/index.json')) body = handlers.pokemon_index;
    else if (/\/pokemon\/\d+\/index\.json$/.test(url)) body = handlers.pokemon_detail;
    else if (/pokemon-species\/\d+\/index\.json$/.test(url)) body = handlers.species_detail;
    else if (/evolution-chain\/\d+\/index\.json$/.test(url)) body = handlers.evo_detail;
    else if (url.endsWith('/move/index.json')) body = handlers.move_index;
    if (extra?.['__failUrl'] && url.includes(String(extra['__failUrl']))) {
      return { ok: false, status: 500, json: async () => ({}) } as Response;
    }
    return { ok: true, status: 200, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, callLog };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePokemonData — cache miss on boot', () => {
  it('fetches the index endpoint, advances progress, and writes a v2 cache', async () => {
    const { callLog } = installFetchMock();
    const { result } = renderHook(() => usePokemonData());
    expect(result.current.loading).toBe(true);
    expect(result.current.progress).toBe(0);
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.progress).toBe(100);
    expect(callLog.some((u) => u.endsWith('/pokemon/index.json'))).toBe(true);
    const raw = localStorage.getItem(POKEAPI_CACHE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(CACHE_VERSION);
    expect(parsed.data.pokemon.length).toBeGreaterThan(0);
  });
});

describe('usePokemonData — cache hit on boot', () => {
  it('reads from localStorage and does not call fetch', async () => {
    const cached = {
      version: CACHE_VERSION,
      data: {
        pokemon: [
          {
            id: 1,
            name: 'bulbasaur',
            displayName: 'Bulbasaur',
            speciesName: 'bulbasaur',
            types: ['grass', null],
            spriteHome: 'home.png',
            spriteArtwork: 'art.png',
            spriteDefault: 'pixel.png',
            isLegendary: false,
            isMythical: false,
            isFinalEvolution: true,
          },
        ],
        typeChart: {},
        moveIndex: [{ name: 'tackle', displayName: 'Tackle', url: '' }],
        moveDetails: {},
      },
    };
    localStorage.setItem(POKEAPI_CACHE_KEY, JSON.stringify(cached));
    const { fetchMock } = installFetchMock();
    const { result } = renderHook(() => usePokemonData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.pokemon).toHaveLength(1);
    expect(result.current.pokemon[0].name).toBe('bulbasaur');
  });
});

describe('usePokemonData — version mismatch', () => {
  it('re-fetches when stored cache has an old version and does not touch userdata', async () => {
    localStorage.setItem(
      POKEAPI_CACHE_KEY,
      JSON.stringify({ version: 1, data: { pokemon: [], typeChart: {}, moveIndex: [] } }),
    );
    const userData = JSON.stringify({ teams: [], customPokemon: [], activeTeamId: '' });
    localStorage.setItem(USER_DATA_KEY, userData);
    const { fetchMock } = installFetchMock();
    const { result } = renderHook(() => usePokemonData());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(fetchMock).toHaveBeenCalled();
    expect(localStorage.getItem(USER_DATA_KEY)).toBe(userData);
  });
});

describe('usePokemonData — resetCache action', () => {
  it('removes the pokeapi cache key and never touches userdata', async () => {
    const cached = { version: CACHE_VERSION, data: { pokemon: [], typeChart: {}, moveIndex: [] } };
    localStorage.setItem(POKEAPI_CACHE_KEY, JSON.stringify(cached));
    const userData = JSON.stringify({ teams: [], customPokemon: [], activeTeamId: '' });
    localStorage.setItem(USER_DATA_KEY, userData);
    installFetchMock();
    // Stub window.location.reload so the test does not navigate.
    const originalLocation = window.location;
    // @ts-expect-error — replacing location for test
    delete window.location;
    // @ts-expect-error — installing partial location stub
    window.location = { ...originalLocation, reload: vi.fn() };
    const { result } = renderHook(() => usePokemonData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.resetCache();
    });
    expect(localStorage.getItem(POKEAPI_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(USER_DATA_KEY)).toBe(userData);
    // Restore.
    // @ts-expect-error — restoring location
    window.location = originalLocation;
  });
});

describe('usePokemonData — individual fetch failure', () => {
  it('logs a console.warn and completes the rest of the load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installFetchMock({ __failUrl: '/pokemon/1/index.json' });
    const { result } = renderHook(() => usePokemonData());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.error).toBeNull();
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes('bulbasaur'))).toBe(true);
  });
});

describe('usePokemonData — lazy move details', () => {
  it('fetches move details on demand and caches them', async () => {
    installFetchMock({
      move_detail: {
        id: 33,
        name: 'tackle',
        power: 40,
        type: { name: 'normal' },
        damage_class: { name: 'physical' },
      },
    });
    // Add move detail handler.
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (/\/move\/\d+\/index\.json$/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 33,
            name: 'tackle',
            power: 40,
            type: { name: 'normal' },
            damage_class: { name: 'physical' },
          }),
        } as Response;
      }
      if (url.endsWith('/pokemon/index.json'))
        return { ok: true, status: 200, json: async () => ({ results: [] }) } as Response;
      if (url.endsWith('/move/index.json'))
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [{ name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' }],
          }),
        } as Response;
      if (url.endsWith('/type/index.json'))
        return { ok: true, status: 200, json: async () => ({ results: [] }) } as Response;
      if (/\/type\/\d+\/index\.json$/.test(url))
        return {
          ok: true,
          status: 200,
          json: async () => ({
            damage_relations: { double_damage_to: [], half_damage_to: [], no_damage_to: [] },
          }),
        } as Response;
      return { ok: true, status: 200, json: async () => ({ results: [] }) } as Response;
    });
    const { result } = renderHook(() => usePokemonData());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    const detail = await act(async () => result.current.loadMoveDetails('tackle'));
    expect(detail).not.toBeNull();
    expect(detail!.displayName).toBe('Tackle');
    expect(detail!.power).toBe(40);
    expect(detail!.type).toBe('normal');
    // Second call hits the in-memory cache (no extra fetch).
    const beforeCalls = fetchSpy.mock.calls.length;
    const again = await act(async () => result.current.loadMoveDetails('tackle'));
    expect(again).toEqual(detail);
    expect(fetchSpy.mock.calls.length).toBe(beforeCalls);
  });
});
